import { type Message as AiMessage } from 'ai'
import { ModelName } from './hooks/use-models'

export interface Message extends AiMessage {
  model?: ModelName
}

export interface Chat extends Record<string, any> {
  id: string
  title: string
  createdAt: Date | number
  userId: string
  path: string
  messages: Message[]
  sharePath?: string
}

export type ServerActionResult<Result> = Promise<
  | Result
  | {
      error: string
    }
>
