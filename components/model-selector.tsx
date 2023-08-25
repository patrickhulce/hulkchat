'use client'

import { Suspense, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ModelName, useModels } from '@/lib/hooks/use-models'

function ModelSelector_() {
  const pathname = usePathname()
  const [selectedModels, setSelectedModels] = useModels()
  const [isOpen, setIsOpen] = useState(false)

  const isChat = pathname.includes('/chat') || pathname === '/'
  if (!isChat) return null

  const modelOptions: ModelName[] = ['gpt-3.5-turbo', 'gpt-4', 'claude-2']

  const setModel = (option: ModelName) => {
    setSelectedModels([option])
    setIsOpen(false)
  }

  return (
    <div className="relative inline-block w-64 text-left">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex h-8 w-full items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium shadow ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Model ({selectedModels.join(',').toUpperCase()})
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 origin-top-right rounded-md bg-background text-gray-200 shadow-lg ring-1 ring-black ring-opacity-5">
          <div
            className="py-1"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {modelOptions.map(option => (
              <div
                key={option}
                onClick={() => setModel(option)}
                className="block cursor-pointer px-4 py-2 text-sm text-gray-200 hover:bg-accent hover:text-gray-50"
                role="menuitem"
              >
                {option.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ModelSelector() {
  return (
    <Suspense fallback={null}>
      <ModelSelector_ />
    </Suspense>
  )
}
