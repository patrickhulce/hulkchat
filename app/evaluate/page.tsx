import { type Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { formatDate } from '@/lib/utils'
import { getEvaluations, getSharedChat } from '@/app/actions'
import { ChatList } from '@/components/chat-list'
import { FooterText } from '@/components/footer'
import { auth } from '@/auth'
import { EvaluateButton } from '../components/evaluate-button'

export const runtime = 'edge'

export default async function EvaluatePage() {
  const session = await auth()
  if (!session.user) {
    redirect(`/sign-in?next=/evaluate`)
  }

  const evaluations = await getEvaluations(session.user.id)

  return (
    <>
      Hello {session.user?.name}! <EvaluateButton />
      <pre>{JSON.stringify(evaluations, null, 2)}</pre>
    </>
  )
}
