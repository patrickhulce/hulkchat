import { inngest } from '../inngest'
import { kv } from '@vercel/kv'
import { Configuration, OpenAIApi } from 'openai-edge'

import { nanoid } from '@/lib/utils'
import {
  TaskModelResponseRequest,
  TaskModelEvaluationRequest,
  JobStatus,
  FunctionEvent,
  Message,
  ModelOptions,
  TaskEvaluationRequest
} from '@/lib/types'
import { CreateChatCompletionResponse } from 'openai-edge/types/types/chat'

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
)

async function getGptResponse(
  prompt: string | Message[],
  options: ModelOptions
): Promise<string> {
  const response = await openai.createChatCompletion({
    model: options.model,
    messages:
      typeof prompt === 'string'
        ? [
            { role: 'system', content: 'Act as a helpful assistant.' },
            { role: 'user', content: prompt }
          ]
        : prompt,
    temperature: options.temperature
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status}\n${await response.text()}`
    )
  }

  const body: CreateChatCompletionResponse = await response.json()
  const completion = body.choices[0].message?.content
  if (!completion) {
    throw new Error(
      `OpenAI API error: no response content\n${JSON.stringify(body)}`
    )
  }

  return completion
}

async function checkForCompletionOfAllTaskEvaluationRequests(
  evaluationId: string
) {
  const requestIds = await kv.zrange<string[]>(
    `eval:${evaluationId}:requests:active`,
    0,
    -1
  )

  if (requestIds.length === 0) {
    await kv.hset(`eval:${evaluationId}`, {
      status: JobStatus.Completed
    })
  }
}

async function getGptJsonResponse<T>(
  prompt: string | Message[],
  options: ModelOptions
): Promise<T> {
  return JSON.parse(await getGptResponse(prompt, options))
}

export const startTaskEvaluation = inngest.createFunction(
  { name: 'Start Task Evaluation' },
  { event: FunctionEvent.StartEvaluation },
  async ({ event, step }) => {
    const json: TaskEvaluationRequest = event.data

    const { userId, rubric, task, models, evaluationId, repetitions } = json

    await kv.hset(`eval:${evaluationId}`, { status: JobStatus.Active })

    for (const { model, temperature } of models) {
      for (let i = 0; i < repetitions + 1; i++) {
        const request: TaskModelResponseRequest = {
          evaluationId,
          userId,
          requestId: nanoid(),

          rubric,
          task,
          model,
          temperature
        }

        await kv.hset(`eval:${evaluationId}:requests:${request.requestId}`, {
          ...request,
          status: JobStatus.Queued
        })
        await kv.zadd(`eval:${evaluationId}:requests`, {
          score: Date.now(),
          member: request.requestId
        })
        await kv.zadd(`eval:${evaluationId}:requests:active`, {
          score: Date.now(),
          member: request.requestId
        })

        await step.sendEvent({
          name: FunctionEvent.CreateResponse,
          data: request
        })
      }
    }
  }
)

function stringifyTask(task: string | Message[]): string {
  if (typeof task === 'string') {
    return task
  }

  return task.map(item => item.content).join('\n')
}

export const getModelResponseForTask = inngest.createFunction(
  { name: 'Get Model Response for Task' },
  { event: FunctionEvent.CreateResponse },
  async ({ event, step }) => {
    const json: TaskModelResponseRequest = event.data

    const {
      userId,
      rubric,
      evaluationId,
      model,
      task,
      temperature,
      requestId
    } = json

    await kv.hset(`eval:${evaluationId}:requests:${requestId}`, {
      status: JobStatus.Active
    })

    const response = await getGptResponse(task, {
      model,
      temperature
    })

    const request: TaskModelEvaluationRequest = {
      userId,
      evaluationId,
      requestId,

      rubric,
      candidate: {
        task,
        content: response,
        model
      }
    }

    await kv.hset(`eval:${evaluationId}:requests:${requestId}`, {
      ...request,
      status: JobStatus.Active
    })

    await step.sendEvent({
      name: FunctionEvent.EvaluateResponse,
      data: request
    })
  }
)

export const evaluateTaskModel = inngest.createFunction(
  { name: 'Evaluate Task-Model Response' },
  { event: FunctionEvent.EvaluateResponse },
  async ({ event, step }) => {
    const json: TaskModelEvaluationRequest = event.data

    const { userId, candidate, rubric, evaluationId, requestId } = json

    const rubricText = rubric.criteria
      .map(item => `- ${item.name}: "${item.description}"`)
      .join('\n')

    const rubricInterface = rubric.criteria
      .flatMap(item => [
        `  /** An explanation of the response's performance on the "${item.name}" dimension. */`,
        `  '${item.name}-explanation': string;`,
        `  /** A number in the range 1-10 representing the quality along the "${item.name}" dimension. */`,
        `  '${item.name}': number;`
      ])
      .join('\n')

    const evaluation = await getGptJsonResponse<Record<string, number>>(
      [
        `Evaluate the quality of a response from an AI model in response to a task`,
        `Rubric: \n\n"""${rubricText}"""`,
        `Task: \n\n"""${stringifyTask(candidate.task)}"""`,
        `Response: \n\n"""${candidate.content}"""`,
        `\nYou MUST reply with a JSON object (just JSON no natural language preamble, postamble, or explanations) that matches the following interface:`,
        `\n\n"""interface Evaluation {\n${rubricInterface}\n}"""`
      ].join('\n'),
      { temperature: 0, model: 'gpt-3.5-turbo' }
    )

    let totalWeight = 0
    let cumulativeWeightedScore =
      rubric.aggregation === 'geometric-mean' ? 1 : 0

    for (const { name, weight } of rubric.criteria) {
      const score = evaluation[name]
      if (typeof score !== 'number') {
        throw new Error(
          `OpenAI API failure: missing "${name}" score from response\n${JSON.stringify(
            evaluation
          )}`
        )
      }

      totalWeight += weight
      if (rubric.aggregation === 'geometric-mean') {
        cumulativeWeightedScore *= score ** weight
      } else {
        cumulativeWeightedScore += score * weight
      }
    }

    const aggregateScore =
      rubric.aggregation === 'geometric-mean'
        ? cumulativeWeightedScore ** (1 / totalWeight)
        : cumulativeWeightedScore / totalWeight
    const result = { evaluation, score: aggregateScore }

    await kv.hset(`eval:${evaluationId}:requests:${requestId}`, {
      status: JobStatus.Completed,
      result
    })
    await kv.zrem(`eval:${evaluationId}:requests:active`, requestId)

    await checkForCompletionOfAllTaskEvaluationRequests(json.evaluationId)
  }
)
