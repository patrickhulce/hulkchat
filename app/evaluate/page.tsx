import { type Metadata } from 'next'
import { notFound } from 'next/navigation'

import { formatDate } from '@/lib/utils'
import { getSharedChat } from '@/app/actions'
import { ChatList } from '@/components/chat-list'
import { FooterText } from '@/components/footer'
import { auth } from '@/auth'
import { EvaluateButton } from '../components/evaluate-button'

export const runtime = 'edge'

export default async function EvaluatePage() {
  const session = await auth()

  return (
    <>
      Hello {session.user?.name}! <EvaluateButton />
    </>
  )
}
