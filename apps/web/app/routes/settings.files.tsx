import { FileIcon, FileTextIcon, TrashIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useLoaderData, useFetcher, type LoaderFunctionArgs } from 'react-router'
import { toast } from 'sonner'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { formatFileSize, formatAbsoluteDate } from '~/lib/utils'
import { Text, Panel, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Files - Chathouse' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const files = await db.file.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      message: {
        select: {
          chat: {
            select: { id: true, title: true },
          },
        },
      },
    },
  })

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return { files, totalSize }
}

export default function SettingsFilesPage() {
  const { files, totalSize } = useLoaderData<typeof loader>()
  const deleteFetcher = useFetcher()

  useEffect(() => {
    if (deleteFetcher.data?.success) {
      toast.success('File deleted')
    } else if (deleteFetcher.data?.error) {
      toast.error(deleteFetcher.data.error)
    }
  }, [deleteFetcher.data])

  const handleDelete = (fileId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return
    deleteFetcher.submit(null, {
      method: 'post',
      action: `/api/files/${fileId}/delete`,
    })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={FileIcon}
        label="Files"
        description="Manage files you've uploaded in chats"
        iconColorClass="text-amber-500"
      />

      <div className="mt-2 text-sm text-stone-500">
        {files.length} {files.length === 1 ? 'file' : 'files'} &middot; {formatFileSize(totalSize)}{' '}
        total
      </div>

      <section className="mt-6">
        {files.length === 0 ? (
          <Panel>
            <div className="py-8 text-center">
              <FileTextIcon className="mx-auto mb-3 h-10 w-10 text-stone-300" />
              <Text as="p" colour="muted">
                No files uploaded yet
              </Text>
              <Text as="p" size="sm" colour="muted" className="mt-1">
                Files you attach to chat messages will appear here
              </Text>
            </div>
          </Panel>
        ) : (
          <div className="space-y-2">
            {files.map((file) => {
              const isImage = file.mimeType.startsWith('image/')
              const isDeleting =
                deleteFetcher.state !== 'idle' &&
                deleteFetcher.formAction === `/api/files/${file.id}/delete`

              return (
                <Panel key={file.id} className={isDeleting ? 'opacity-50' : undefined}>
                  <div className="flex items-center gap-3">
                    {isImage ? (
                      <img
                        src={`/api/files/${file.id}`}
                        alt={file.filename}
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-100">
                        <FileTextIcon className="h-5 w-5 text-stone-500" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <Text size="sm" weight="medium" truncate>
                        {file.filename}
                      </Text>
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <span>{formatFileSize(file.size)}</span>
                        <span>&middot;</span>
                        <span>{formatAbsoluteDate(file.createdAt)}</span>
                        {file.message?.chat && (
                          <>
                            <span>&middot;</span>
                            <a
                              href={`/chat/${file.message.chat.id}`}
                              className="text-primary-600 truncate hover:underline"
                            >
                              {file.message.chat.title}
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`/api/files/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        title="Download"
                      >
                        <DownloadSimpleIcon className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(file.id, file.filename)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Panel>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
