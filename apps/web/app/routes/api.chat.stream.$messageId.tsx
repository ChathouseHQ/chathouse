import type { LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { redis } from '~/lib/redis.server'
import { requireAuth } from '~/lib/session.server'

// (must match worker)
function getStreamChannel(messageId: string): string {
  return `stream:${messageId}`
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const messageId = params.messageId
  if (!messageId) {
    return new Response('Message ID required', { status: 400 })
  }

  const message = await db.message.findUnique({
    where: { id: messageId },
    include: {
      chat: {
        select: { userId: true },
      },
    },
  })

  if (!message || message.chat.userId !== user.id) {
    return new Response('Message not found', { status: 404 })
  }

  if (message.status === 'complete') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'content', content: message.content })}\n\n`,
          ),
        )
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  if (message.status === 'error') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: message.error || 'Unknown error' })}\n\n`,
          ),
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  const subscriber = redis.duplicate()
  const channel = getStreamChannel(messageId)
  let isCleanedUp = false

  const cleanup = async () => {
    if (isCleanedUp) return
    isCleanedUp = true
    try {
      await subscriber.unsubscribe(channel)
      await subscriber.quit()
    } catch {
      // Ignore cleanup errors
    }
  }

  request.signal.addEventListener('abort', cleanup)

  const encoder = new TextEncoder()
  let currentContent = message.content || ''
  let isStreamClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const closeStream = async () => {
        if (isStreamClosed) return
        isStreamClosed = true
        await cleanup()
        controller.close()
      }

      if (currentContent) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'content', content: currentContent })}\n\n`,
          ),
        )
      }

      await subscriber.subscribe(channel)

      subscriber.on('message', async (ch, data) => {
        if (ch !== channel || isStreamClosed) return

        try {
          const chunk = JSON.parse(data)

          if (chunk.type === 'delta' && chunk.content) {
            currentContent += chunk.content
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`,
              ),
            )
          } else if (chunk.type === 'done') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
            await closeStream()
          } else if (chunk.type === 'error') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`),
            )
            await closeStream()
          }
        } catch {
          /* ignore parse errors */
        }
      })

      // Set a timeout to close the connection if no updates for 60 seconds
      const timeout = setTimeout(async () => {
        await closeStream()
      }, 60000)

      request.signal.addEventListener('abort', () => clearTimeout(timeout))
    },
    async cancel() {
      isStreamClosed = true
      await cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
