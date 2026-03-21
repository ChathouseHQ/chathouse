import {
  CopyIcon,
  CheckIcon,
  ArrowCounterClockwiseIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  PencilSimpleIcon,
  FileTextIcon,
  DownloadSimpleIcon,
  GitBranchIcon,
} from '@phosphor-icons/react'
import { marked } from 'marked'
import { useEffect, useMemo, useState } from 'react'

import { trackEvent } from '~/components/Analytics'
import { cn, formatFileSize } from '~/lib/utils'
import { Alert, Modal, Text } from '~/ui'

interface MessageFile {
  id: string
  filename: string
  mimeType: string
  size: number
}

interface ChatMessageProps {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status?: 'pending' | 'processing' | 'complete' | 'error'
  error?: string | null
  model?: string | null
  isLatest?: boolean
  isStreaming?: boolean
  onCopy?: () => void
  onRetry?: (messageId: string) => void
  onEdit?: (messageId: string, content: string) => void
  onBranch?: (messageId: string) => void
  files?: MessageFile[]
}

type ResponseFeedback = 'good' | 'bad'

marked.setOptions({
  breaks: true,
  gfm: true,
})

function FileAttachments({ files }: { files: MessageFile[] }) {
  const [previewFile, setPreviewFile] = useState<MessageFile | null>(null)

  if (files.length === 0) return null

  const images = files.filter((f) => f.mimeType.startsWith('image/'))
  const others = files.filter((f) => !f.mimeType.startsWith('image/'))

  return (
    <>
      <div className="flex flex-col gap-2">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setPreviewFile(file)}
                className="block overflow-hidden rounded-lg border border-stone-200 transition-shadow hover:shadow-md"
              >
                <img
                  src={`/api/files/${file.id}`}
                  alt={file.filename}
                  className="max-h-48 max-w-[280px] object-cover"
                />
              </button>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {others.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setPreviewFile(file)}
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left transition-colors hover:bg-stone-50"
              >
                <FileTextIcon className="h-4 w-4 shrink-0 text-stone-500" />
                <div className="min-w-0">
                  <span className="block max-w-[180px] truncate text-sm font-medium text-stone-700">
                    {file.filename}
                  </span>
                  <span className="block text-xs text-stone-400">{formatFileSize(file.size)}</span>
                </div>
                <DownloadSimpleIcon className="h-3.5 w-3.5 shrink-0 text-stone-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)}>
        {previewFile && (
          <div className="flex flex-col items-center">
            {previewFile.mimeType.startsWith('image/') ? (
              <img
                src={`/api/files/${previewFile.id}`}
                alt={previewFile.filename}
                className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-10 py-8">
                <FileTextIcon className="h-12 w-12 text-stone-400" />
                <Text weight="medium">{previewFile.filename}</Text>
                <Text size="sm" colour="muted">
                  {formatFileSize(previewFile.size)}
                </Text>
                <a
                  href={`/api/files/${previewFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary-600 hover:bg-primary-700 mt-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Open file
                </a>
              </div>
            )}
            <div className="mt-3 rounded-lg bg-black/40 px-3 py-1.5 text-center">
              <Text size="xs" className="text-white">
                {previewFile.filename} &middot; {formatFileSize(previewFile.size)}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export function ChatMessage({
  id,
  role,
  content,
  status = 'complete',
  error,
  model,
  isLatest = false,
  isStreaming = false,
  onCopy,
  onRetry,
  onEdit,
  onBranch,
  files = [],
}: ChatMessageProps) {
  const isUser = role === 'user'
  const isPending = status === 'pending' || status === 'processing'
  const isError = status === 'error'
  const [copySuccess, setCopySuccess] = useState(false)
  const [responseFeedback, setResponseFeedback] = useState<ResponseFeedback | null>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  const renderedContent = useMemo(() => {
    if (isStreaming && content) {
      try {
        return marked.parse(content)
      } catch {
        return content
      }
    }
    if (isUser || (isPending && !isStreaming) || isError || !content) return null
    try {
      return marked.parse(content)
    } catch {
      return content
    }
  }, [content, isUser, isPending, isError, isStreaming])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
      onCopy?.()
    } catch (reason) {
      console.error('Failed to copy:', reason)
    }
  }

  const handleRetry = () => {
    onRetry?.(id)
  }

  const handleEdit = () => {
    onEdit?.(id, content)
  }

  const handleBranch = () => {
    onBranch?.(id)
  }

  const handleResponseFeedback = async (feedback: ResponseFeedback) => {
    if (isUser || isPending || isError || isStreaming || responseFeedback || isSubmittingFeedback) {
      return
    }

    setIsSubmittingFeedback(true)

    const didTrack = await trackEvent('Response feedback', {
      feedback,
      message_id: id,
      model: model ?? 'unknown',
      message_status: status,
      is_latest: isLatest,
      response_length: content.length,
      response_word_count: content.trim() ? content.trim().split(/\s+/).length : 0,
      attachment_count: files.length,
    })

    if (didTrack) {
      setResponseFeedback(feedback)
    }

    setIsSubmittingFeedback(false)
  }

  useEffect(() => {
    setResponseFeedback(null)
    setIsSubmittingFeedback(false)
  }, [id, content, model])

  if (isUser) {
    return (
      <div className="group message-animate flex justify-end px-4 py-3">
        <div className="flex w-full max-w-full min-w-0 flex-col items-end gap-1 md:max-w-[85%]">
          {files.length > 0 && (
            <div className="mb-1">
              <FileAttachments files={files} />
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-zinc-100 px-4 py-3 text-stone-800">
            <div className="text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">
              {content}
            </div>
          </div>

          <div
            className={cn(
              'flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100',
            )}
          >
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Copy message"
            >
              {copySuccess ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Edit message"
            >
              <PencilSimpleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group message-animate flex justify-start px-4 py-3">
      <div className="flex w-full max-w-full min-w-0 flex-col items-start gap-1 md:max-w-[85%]">
        {isPending && isLatest && !isStreaming ? (
          <div className="flex items-center gap-2 text-stone-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
            <span className="text-sm">Thinking...</span>
          </div>
        ) : isError ? (
          <Alert variant="error" title="Error generating response">
            {error && <p className="mt-1 opacity-75">{error}</p>}
          </Alert>
        ) : (
          <div className="prose prose-stone prose-sm w-full max-w-none min-w-0 text-stone-800">
            {renderedContent ? (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderedContent as string }}
              />
            ) : (
              <div className="whitespace-pre-wrap">{content}</div>
            )}
            {isStreaming && <span className="streaming-cursor" />}
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-0.5 pb-2 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100',
          )}
        >
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            title="Copy message"
          >
            {copySuccess ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleRetry}
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            title="Regenerate response"
          >
            <ArrowCounterClockwiseIcon className="h-4 w-4" />
          </button>

          {status === 'complete' && onBranch && (
            <button
              type="button"
              onClick={handleBranch}
              className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Branch off"
            >
              <GitBranchIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleResponseFeedback('good')}
            disabled={isSubmittingFeedback || responseFeedback === 'bad'}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              responseFeedback === 'good'
                ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
              (isSubmittingFeedback || responseFeedback === 'bad') &&
                'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-stone-400',
            )}
            title={responseFeedback === 'good' ? 'Feedback sent' : 'Good response'}
          >
            {responseFeedback === 'good' ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ThumbsUpIcon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleResponseFeedback('bad')}
            disabled={isSubmittingFeedback || responseFeedback === 'good'}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              responseFeedback === 'bad'
                ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
              (isSubmittingFeedback || responseFeedback === 'good') &&
                'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-stone-400',
            )}
            title={responseFeedback === 'bad' ? 'Feedback sent' : 'Bad response'}
          >
            {responseFeedback === 'bad' ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ThumbsDownIcon className="h-4 w-4" />
            )}
          </button>

          {model && <span className="ml-1 text-xs text-stone-400">{model}</span>}
        </div>
      </div>
    </div>
  )
}
