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

/** Types for evaluation models */

export interface EvaluationRubric {
  criteria: Array<{ name: string; description: string; weight: number }>
  aggregation: 'geometric-mean' | 'arithmetic-mean'
}

export interface TaskModelEvaluationCandidate {
  task: string | Message[]
  content: string
  model: ModelName
}

export interface TaskEvaluationRequest {
  userId: string
  evaluationId: string

  task: string | Message[]
  models: ModelOptions[]
  rubric: EvaluationRubric
  /** The number of _additional_ responses to collect from each model. Defaults to 0. */
  repetitions: number
}

export interface TaskEvaluation extends TaskEvaluationRequest {
  status: JobStatus
  tasks?: TaskModelEvaluation[]
}

export interface TaskModelResponseRequest {
  userId: string
  evaluationId: string
  requestId: string

  task: string | Message[]
  model: ModelName
  temperature: number
  rubric: EvaluationRubric
}

export interface TaskModelEvaluationRequest {
  userId: string
  evaluationId: string
  requestId: string

  candidate: TaskModelEvaluationCandidate
  rubric: EvaluationRubric
}

export interface TaskModelEvaluation
  extends TaskModelResponseRequest,
    Partial<Omit<TaskModelEvaluationRequest, keyof TaskModelResponseRequest>> {
  status: JobStatus
  result?: {
    score: number
    evaluation: Record<string, number | string>
  }
}

export enum JobStatus {
  Queued = 'queued',
  Active = 'active',
  Completed = 'completed'
}

export enum FunctionEvent {
  StartEvaluation = 'start-evaluation',
  CreateResponse = 'create-response',
  EvaluateResponse = 'evaluate-response'
}

export interface ModelOptions {
  model: ModelName
  temperature: number
}
