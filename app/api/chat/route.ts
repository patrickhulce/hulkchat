import { kv } from '@vercel/kv'
import { OpenAIStream, AnthropicStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'
import { Chat, Message } from '@/lib/types'
import { ModelName } from '@/lib/hooks/use-models'

export const runtime = 'edge'

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
)

function buildPromptForAnthropic(messages: Message[]) {
  return (
    messages
      .map(({ content, role }) => {
        if (role === 'user') {
          return `Human: ${content}`
        } else {
          return `Assistant: ${content}`
        }
      })
      .join('\n\n') + 'Assistant:'
  )
}

interface DataForChat {
  id: string
  userId: string
  messages: Message[]
  model: ModelName
}

async function saveChat(data: DataForChat, completion: string) {
  const title = data.messages[0].content.substring(0, 100)
  const id = data.id
  const createdAt = Date.now()
  const path = `/chat/${id}`
  const chat: Chat = {
    id,
    title,
    userId: data.userId,
    createdAt,
    path,
    messages: [
      ...data.messages,
      {
        id: nanoid(),
        model: data.model,
        content: completion,
        role: 'assistant'
      }
    ]
  }
  await kv.hmset(`chat:${id}`, chat)
  await kv.zadd(`user:chat:${data.userId}`, {
    score: createdAt,
    member: `chat:${id}`
  })
}

async function respondViaOpenAI(data: DataForChat) {
  const res = await openai.createChatCompletion({
    model: data.model,
    messages: data.messages,
    temperature: 0.7,
    stream: true
  })

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
      console.log('OpenAI Completion:', completion)
      await saveChat(data, completion)
    }
  })

  return new StreamingTextResponse(stream)
}

async function respondViaAnthropic(data: DataForChat) {
  const response = await fetch('https://api.anthropic.com/v1/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-01-01',
      'x-api-key': process.env.ANTHROPIC_API_KEY || ''
    },
    body: JSON.stringify({
      prompt: buildPromptForAnthropic(data.messages),
      model: data.model,
      max_tokens_to_sample: 1000,
      temperature: 0.7,
      stream: true
    })
  })

  // Check for errors
  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status
    })
  }

  // Convert the response into a friendly text-stream
  const stream = AnthropicStream(response, {
    async onCompletion(completion) {
      console.log('Anthropic Completion:', completion)
      await saveChat(data, completion)
    }
  })

  // Respond with the stream
  return new StreamingTextResponse(stream)
}

export async function POST(req: Request) {
  const json = await req.json()
  const { id = nanoid(), messages, model } = json
  const session = await auth()
  const userId = session?.user.id

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  const data: DataForChat = {
    id,
    userId,
    messages,
    model
  }

  if (model.startsWith('gpt-')) {
    return respondViaOpenAI(data)
  } else if (model.startsWith('claude-')) {
    return respondViaAnthropic(data)
  } else {
    return new Response('Invalid Model', {
      status: 400
    })
  }
}
