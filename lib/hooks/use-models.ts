import { useRouter, useSearchParams } from 'next/navigation'

const ALLOWED_MODELS = new Set<ModelName>(['gpt-3.5-turbo', 'gpt-4'])

type ModelName = 'gpt-3.5-turbo' | 'gpt-4'

export function useModels(): [ModelName[], (models: ModelName[]) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const models = searchParams
    .getAll('model')
    .filter((model: string): model is ModelName =>
      ALLOWED_MODELS.has(model as ModelName)
    )

  const setModels = (nextModels: ModelName[]) => {
    const href = new URL(window.location.href)

    href.searchParams.delete('model')
    for (const model of nextModels) href.searchParams.append('model', model)

    router.replace(`${href.pathname}${href.search}`)
  }

  if (!models.length) return [['gpt-3.5-turbo'], setModels]
  return [models, setModels]
}
