import { useRouter, useSearchParams } from 'next/navigation'

const LOCAL_STORAGE_KEY = 'openchat_model'

const ALLOWED_MODELS = new Set<ModelName>([
  'gpt-3.5-turbo',
  'gpt-4',
  'claude-2'
])

const localStorage = global.localStorage || {
  getItem: () => '',
  setItem: () => ''
}

export type ModelName = 'gpt-3.5-turbo' | 'gpt-4' | 'claude-2'

export function useModels(): [ModelName[], (models: ModelName[]) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryModels = searchParams.getAll('model')
  const localModels = (localStorage.getItem(LOCAL_STORAGE_KEY) || '').split(',')

  const models = Array.from(new Set([...queryModels, ...localModels])).filter(
    (model: string): model is ModelName =>
      ALLOWED_MODELS.has(model as ModelName)
  )

  const setModels = (nextModels: ModelName[]) => {
    const href = new URL(window.location.href)

    href.searchParams.delete('model')
    for (const model of nextModels) href.searchParams.append('model', model)

    localStorage.setItem(LOCAL_STORAGE_KEY, nextModels.join(','))
    router.replace(`${href.pathname}${href.search}`)
  }

  if (!models.length) return [['gpt-3.5-turbo'], setModels]
  return [models, setModels]
}
