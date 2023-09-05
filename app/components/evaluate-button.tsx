'use client'

import React from 'react'

export function EvaluateButton() {
  return (
    <button
      className="bg-primary text-background"
      onClick={async () =>
        fetch(`/api/evaluations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content:
                  'Write a social media post as a real estate agent welcoming parents back to school.'
              }
            ]
          })
        })
      }
    >
      Evaluate!
    </button>
  )
}
