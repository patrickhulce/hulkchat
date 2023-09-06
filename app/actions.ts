'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { kv } from '@vercel/kv'

import { auth } from '@/auth'
import { TaskEvaluation, type Chat, TaskModelEvaluation } from '@/lib/types'

export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  try {
    const pipeline = kv.pipeline()
    const chats: string[] = await kv.zrange(`user:chat:${userId}`, 0, -1, {
      rev: true
    })

    for (const chat of chats) {
      pipeline.hgetall(chat)
    }

    const results = await pipeline.exec()

    return results as Chat[]
  } catch (error) {
    return []
  }
}

export async function getChat(id: string, userId: string) {
  const chat = await kv.hgetall<Chat>(`chat:${id}`)

  if (!chat || (userId && chat.userId !== userId)) {
    return null
  }

  return chat
}

export async function removeChat({ id, path }: { id: string; path: string }) {
  const session = await auth()

  if (!session) {
    return {
      error: 'Unauthorized'
    }
  }

  const uid = await kv.hget<string>(`chat:${id}`, 'userId')

  if (uid !== session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  await kv.del(`chat:${id}`)
  await kv.zrem(`user:chat:${session.user.id}`, `chat:${id}`)

  revalidatePath('/')
  return revalidatePath(path)
}

export async function clearChats() {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  const chats: string[] = await kv.zrange(`user:chat:${session.user.id}`, 0, -1)
  if (!chats.length) {
    return redirect('/')
  }
  const pipeline = kv.pipeline()

  for (const chat of chats) {
    pipeline.del(chat)
    pipeline.zrem(`user:chat:${session.user.id}`, chat)
  }

  await pipeline.exec()

  revalidatePath('/')
  return redirect('/')
}

export async function getSharedChat(id: string) {
  const chat = await kv.hgetall<Chat>(`chat:${id}`)

  if (!chat || !chat.sharePath) {
    return null
  }

  return chat
}

export async function shareChat(chat: Chat) {
  const session = await auth()

  if (!session?.user?.id || session.user.id !== chat.userId) {
    return {
      error: 'Unauthorized'
    }
  }

  const payload = {
    ...chat,
    sharePath: `/share/${chat.id}`
  }

  await kv.hmset(`chat:${chat.id}`, payload)

  return payload
}

export async function getEvaluations(
  userId: string
): Promise<TaskEvaluation[]> {
  let pipeline = kv.pipeline()

  const evaluationIds = await kv.zrange<string[]>(
    `user:eval:${userId}`,
    0,
    -1,
    {
      rev: true
    }
  )

  if (!evaluationIds.length) {
    return []
  }

  for (const evaluationId of evaluationIds) {
    pipeline.hgetall(`eval:${evaluationId}`)
  }

  const results: TaskEvaluation[] = await pipeline.exec()

  pipeline = kv.pipeline()
  for (const evaluation of results) {
    const requestIds = await kv.zrange<string[]>(
      `eval:${evaluation.evaluationId}:requests`,
      0,
      -1
    )
    for (const requestId of requestIds) {
      pipeline.hgetall(`eval:${evaluation.evaluationId}:requests:${requestId}`)
    }
  }

  const taskEvals: TaskModelEvaluation[] = await pipeline.exec()
  for (const taskEval of taskEvals) {
    const evaluation = results.find(
      e => e.evaluationId === taskEval.evaluationId
    )
    if (evaluation) {
      const tasks = evaluation.tasks || []
      tasks.push(taskEval)
      evaluation.tasks = tasks
    }
  }

  return results
}
