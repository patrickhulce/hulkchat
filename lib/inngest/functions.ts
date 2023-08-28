import { inngest } from '../inngest'
import { kv } from '@vercel/kv'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'
import { Chat, Message } from '@/lib/types'
import { ModelName } from '@/lib/hooks/use-models'
import { CreateChatCompletionResponse } from 'openai-edge/types/types/chat'

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
)

interface EvaluationRubric {
  criteria: Array<{ name: string; description: string; weight: number }>
  aggregation: 'geometric-mean' | 'arithmetic-mean'
}

interface ModelEvaluationCandidate {
  task: string | Message[]
  content: string
  model: ModelName
}

export interface StartEvaluationRequest {
  userId: string
  task: string | Message[]
  models: ModelOptions[]
  rubric: EvaluationRubric
}

interface CreationRequest {
  userId: string
  task: string | Message[]
  model: ModelName
  temperature: number
  rubric: EvaluationRubric
}

interface EvaluationRequest {
  userId: string
  candidate: ModelEvaluationCandidate
  rubric: EvaluationRubric
}

export enum FunctionEvent {
  StartEvaluation = 'start-evaluation',
  CreateResponse = 'create-response',
  EvaluateResponse = 'evaluate-response'
}

interface ModelOptions {
  model: ModelName
  temperature: number
}

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

async function getGptJsonResponse<T>(
  prompt: string | Message[],
  options: ModelOptions
): Promise<T> {
  return JSON.parse(await getGptResponse(prompt, options))
}

export const startEvaluation = inngest.createFunction(
  { name: 'Start Evaluation' },
  { event: FunctionEvent.StartEvaluation },
  async ({ event, step }) => {
    const json: StartEvaluationRequest = event.data

    const { userId, rubric } = json

    for (const { model, temperature } of json.models) {
      const request: CreationRequest = {
        userId,
        rubric,
        task: json.task,
        model,
        temperature
      }

      await step.sendEvent({
        name: FunctionEvent.CreateResponse,
        data: request
      })
    }
  }
)

function stringifyTask(task: string | Message[]): string {
  if (typeof task === 'string') {
    return task
  }

  return task.map(item => item.content).join('\n')
}

export const createResponse = inngest.createFunction(
  { name: 'Create Response' },
  { event: FunctionEvent.CreateResponse },
  async ({ event, step }) => {
    const json: CreationRequest = event.data

    const { userId, rubric } = json

    const response = await getGptResponse(json.task, {
      model: json.model,
      temperature: json.temperature
    })

    const request: EvaluationRequest = {
      userId,
      rubric,
      candidate: {
        task: json.task,
        content: response,
        model: json.model
      }
    }

    await step.sendEvent({
      name: FunctionEvent.EvaluateResponse,
      data: request
    })
  }
)

export const evaluateResponse = inngest.createFunction(
  { name: 'Evaluate Response' },
  { event: FunctionEvent.EvaluateResponse },
  async ({ event, step }) => {
    const json: EvaluationRequest = event.data

    const { userId, candidate, rubric } = json

    const rubricText = rubric.criteria
      .map(item => `- ${item.name}: "${item.description}"`)
      .join('\n')

    const rubricInterface = rubric.criteria
      .flatMap(item => [
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
    console.log(result)
    return result
  }
)
