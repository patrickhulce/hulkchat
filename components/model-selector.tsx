'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useModels } from '@/lib/hooks/use-models'

function ModelSelector_() {
  const pathname = usePathname()
  const [models, setModels] = useModels()

  const isChat = pathname.includes('/chat') || pathname === '/'
  if (!isChat) return null

  return (
    <button
      onClick={() => {
        const nextModel =
          models[0] === 'gpt-3.5-turbo' ? 'gpt-4' : 'gpt-3.5-turbo'
        setModels([nextModel])
      }}
    >
      {models.join(',')}
    </button>
  )
}

export function ModelSelector() {
  return (
    <Suspense fallback={null}>
      <ModelSelector_ />
    </Suspense>
  )
}
