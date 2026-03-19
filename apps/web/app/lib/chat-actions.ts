type ChatActionPayload =
  | {
      chatId: string
      action: 'pin' | 'unpin' | 'delete'
    }
  | {
      chatId: string
      action: 'rename'
      title: string
    }
  | {
      chatId: string
      action: 'branch'
      messageId: string
    }

type ChatActionResponse = {
  error?: string
  success?: boolean
  chatId?: string
}

export async function performChatAction(payload: ChatActionPayload) {
  let response: Response

  try {
    response = await fetch('/api/chat/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error("Couldn't update chat. Please try again.")
  }

  let body: ChatActionResponse | null = null

  try {
    body = (await response.json()) as ChatActionResponse
  } catch {
    body = null
  }

  if (!response.ok) {
    throw new Error(body?.error || "Couldn't update chat. Please try again.")
  }

  return body
}
