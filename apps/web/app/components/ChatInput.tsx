import {
  MagnifyingGlassIcon,
  CaretUpIcon,
  PlusIcon,
  ClockIcon,
  ArrowUpIcon,
  SpinnerGapIcon,
  StarIcon,
  LightningIcon,
  XIcon,
  FileTextIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Form, Link, useFetcher, useNavigation } from 'react-router'

import type { Provider } from '~/lib/models'
import type { EnrichedModel } from '~/lib/models.server'

import { cn, formatFileSize } from '~/lib/utils'
import { Input, Menu, MenuItem, MenuIcons, Modal, ProviderLogo, Text, PROVIDER_NAMES } from '~/ui'

interface AttachedFile {
  id: string
  filename: string
  mimeType: string
  size: number
}

interface ChatInputProps {
  models: EnrichedModel[]
  selectedModel: string
  onModelChange: (model: string) => void
  isSubmitting?: boolean
  placeholder?: string
  autoFocus?: boolean
  defaultValue?: string
  isEditing?: boolean
  onCancel?: () => void
  connectedProviders?: Provider[]
  isTemporary?: boolean
  onTemporaryToggle?: () => void
}

interface FavoriteActionData {
  success?: boolean
  modelId?: string
  favorite?: boolean
}

type SelectorTab = 'favorites' | Provider
const ALL_PROVIDERS: Provider[] = ['openai', 'anthropic', 'google']

export function ChatInput({
  models,
  selectedModel,
  onModelChange,
  isSubmitting = false,
  placeholder = 'How can I help you today?',
  autoFocus = true,
  defaultValue = '',
  isEditing = false,
  onCancel,
  connectedProviders = [],
  isTemporary = false,
  onTemporaryToggle,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigation = useNavigation()
  const favoriteFetcher = useFetcher<FavoriteActionData>()
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({})
  const modelSelectorRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<SelectorTab>('favorites')

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const isLoading = isSubmitting || navigation.state === 'submitting'
  const isUploading = uploadingCount > 0
  const cannotSubmit = isLoading || isUploading

  useEffect(() => {
    if (!favoriteFetcher.data?.success || !favoriteFetcher.data.modelId) return

    setFavoriteOverrides((prev) => ({
      ...prev,
      [favoriteFetcher.data!.modelId!]: favoriteFetcher.data!.favorite ?? false,
    }))
  }, [favoriteFetcher.data])

  useEffect(() => {
    setFavoriteOverrides((prev) => {
      const next = { ...prev }

      for (const model of models) {
        if (next[model.id] === model.favorite) {
          delete next[model.id]
        }
      }

      return next
    })
  }, [models])

  const displayModels = useMemo(
    () =>
      models.map((model) => ({
        ...model,
        favorite: favoriteOverrides[model.id] ?? model.favorite,
      })),
    [models, favoriteOverrides],
  )

  const currentModel = displayModels.find((m) => m.id === selectedModel)

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return displayModels
    const query = searchQuery.toLowerCase()
    return displayModels.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query),
    )
  }, [displayModels, searchQuery])

  const hasFavorites = useMemo(() => displayModels.some((m) => m.favorite), [displayModels])

  const tabModels = useMemo(() => {
    if (activeTab === 'favorites') {
      return filteredModels.filter((m) => m.favorite)
    }
    return filteredModels.filter((m) => m.provider === activeTab)
  }, [activeTab, filteredModels])

  const handleInput = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  useEffect(() => {
    if (defaultValue && textareaRef.current) {
      textareaRef.current.value = defaultValue
      handleInput()
    }
  }, [defaultValue])

  useEffect(() => {
    if (navigation.state === 'idle' && formRef.current && !isEditing) {
      formRef.current.reset()
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      setAttachedFiles([])
    }
  }, [navigation.state, isEditing])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setIsModelSelectorOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isModelSelectorOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isModelSelectorOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!cannotSubmit && textareaRef.current?.value.trim()) {
        formRef.current?.requestSubmit()
      }
    }
    if (e.key === 'Escape' && isEditing && onCancel) {
      onCancel()
    }
  }

  const handleSelectModel = (modelId: string) => {
    onModelChange(modelId)
    setIsModelSelectorOpen(false)
    setSearchQuery('')
  }

  const handleToggleFavorite = useCallback(
    (model: EnrichedModel) => {
      const nextFavorite = !(favoriteOverrides[model.id] ?? model.favorite)

      setFavoriteOverrides((prev) => ({
        ...prev,
        [model.id]: nextFavorite,
      }))

      favoriteFetcher.submit(
        {
          intent: 'toggle-favorite',
          modelId: model.id,
        },
        {
          method: 'post',
          action: '/settings/models',
        },
      )
    },
    [favoriteFetcher, favoriteOverrides],
  )

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      setUploadingCount((c) => c + 1)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: data.id,
              filename: data.filename,
              mimeType: data.mimeType,
              size: data.size,
            },
          ])
        }
      } catch (reason) {
        console.error('Failed to upload file:', reason)
      } finally {
        setUploadingCount((c) => c - 1)
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  return (
    <Form
      method="post"
      ref={formRef}
      className="w-full"
      onSubmit={() => {
        if (isTemporary && onTemporaryToggle) {
          sessionStorage.setItem('temp_chat_creating', '1')
        }
      }}
    >
      <input type="hidden" name="model" value={selectedModel} />
      {isTemporary && <input type="hidden" name="isTemporary" value="1" />}
      {isEditing && <input type="hidden" name="action" value="edit" />}
      {attachedFiles.length > 0 && (
        <input type="hidden" name="fileIds" value={attachedFiles.map((f) => f.id).join(',')} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.txt,.csv,.md,.json"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <div className="relative mx-auto max-w-3xl">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-xl border transition-all duration-300',
            isTemporary
              ? 'border-slate-600 bg-slate-800 focus-within:border-slate-500'
              : 'border-surface-200 focus-within:border-surface-400 bg-white',
            isDragging &&
              (isTemporary
                ? 'border-slate-400 bg-slate-700/80'
                : 'border-primary-400 bg-primary-50/50'),
          )}
        >
          {isDragging && (
            <div className="border-primary-400/60 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed">
              <div className="text-primary-600 flex items-center gap-2">
                <UploadSimpleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Drop files here</span>
              </div>
            </div>
          )}

          <div className="px-4 pt-4 pb-2">
            <textarea
              ref={textareaRef}
              name="content"
              rows={1}
              placeholder={placeholder}
              autoFocus={autoFocus}
              disabled={isLoading}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full resize-none bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                isTemporary
                  ? 'text-slate-100 placeholder:text-slate-400'
                  : 'text-stone-800 placeholder:text-stone-400',
              )}
              style={{ maxHeight: 200 }}
            />
          </div>

          {(attachedFiles.length > 0 || uploadingCount > 0) && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg border py-2 pr-7 pl-2.5',
                    isTemporary ? 'border-slate-600 bg-slate-700' : 'border-stone-200 bg-stone-50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="flex items-center gap-2.5"
                  >
                    {file.mimeType.startsWith('image/') ? (
                      <img
                        src={`/api/files/${file.id}`}
                        alt={file.filename}
                        className="h-9 w-9 rounded object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded',
                          isTemporary ? 'bg-slate-600' : 'bg-stone-200/60',
                        )}
                      >
                        <FileTextIcon
                          className={cn(
                            'h-4 w-4',
                            isTemporary ? 'text-slate-300' : 'text-stone-500',
                          )}
                        />
                      </div>
                    )}
                    <div className="min-w-0 text-left">
                      <Text
                        size="xs"
                        weight="medium"
                        truncate
                        className={cn('block max-w-[140px]', isTemporary && 'text-slate-100')}
                      >
                        {file.filename}
                      </Text>
                      <Text
                        size="xs"
                        colour="muted"
                        className={cn('block', isTemporary && 'text-slate-400')}
                      >
                        {formatFileSize(file.size)}
                      </Text>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className={cn(
                      'absolute top-1 right-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                      isTemporary
                        ? 'text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                        : 'text-stone-400 hover:bg-stone-200 hover:text-stone-600',
                    )}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {uploadingCount > 0 && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-2',
                    isTemporary ? 'border-slate-600 bg-slate-700' : 'border-stone-200 bg-stone-50',
                  )}
                >
                  <SpinnerGapIcon className="h-4 w-4 animate-spin text-stone-400" />
                  <Text size="xs" colour="muted">
                    Uploading...
                  </Text>
                </div>
              )}
            </div>
          )}

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

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <div ref={plusMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                    isTemporary
                      ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
                  )}
                >
                  <PlusIcon className="h-5 w-5" />
                </button>

                <Menu
                  isOpen={isPlusMenuOpen}
                  onClose={() => setIsPlusMenuOpen(false)}
                  position="top"
                  align="start"
                  className="w-56"
                >
                  <MenuItem
                    icon={<MenuIcons.Attachment />}
                    onClick={() => {
                      fileInputRef.current?.click()
                      setIsPlusMenuOpen(false)
                    }}
                  >
                    Add files or photos
                  </MenuItem>
                </Menu>
              </div>

              {onTemporaryToggle && (
                <button
                  type="button"
                  onClick={onTemporaryToggle}
                  title={isTemporary ? 'Switch to regular chat' : 'Switch to temporary chat'}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                    isTemporary
                      ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                      : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
                  )}
                >
                  <ClockIcon className="h-5 w-5" weight={isTemporary ? 'fill' : 'regular'} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditing && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-3 py-1.5 text-sm text-stone-500 transition-colors hover:bg-stone-100"
                >
                  Cancel
                </button>
              )}

              <div ref={modelSelectorRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isModelSelectorOpen) {
                      setIsModelSelectorOpen(false)
                      setSearchQuery('')
                    } else {
                      setActiveTab(
                        hasFavorites
                          ? 'favorites'
                          : ALL_PROVIDERS.find((p) => connectedProviders.includes(p)) ||
                              ALL_PROVIDERS[0],
                      )
                      setIsModelSelectorOpen(true)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    isTemporary
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-stone-600 hover:bg-stone-100',
                  )}
                >
                  {currentModel && <ProviderLogo provider={currentModel.provider} size="sm" />}
                  <span>{currentModel?.customName || currentModel?.name || 'Select model'}</span>
                  <CaretUpIcon
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isTemporary ? 'text-slate-500' : 'text-stone-400',
                      !isModelSelectorOpen && 'rotate-180',
                    )}
                  />
                </button>

                {isModelSelectorOpen && (
                  <div className="absolute right-0 bottom-full z-50 mb-2">
                    <div className="flex overflow-hidden rounded-xl border border-stone-200 shadow-lg">
                      <div className="flex flex-col items-center gap-1 border-r border-stone-100 bg-stone-50 p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('favorites')
                            setSearchQuery('')
                          }}
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-colors',
                            activeTab === 'favorites'
                              ? 'border-surface-300 bg-white text-amber-500'
                              : 'text-surface-300 hover:text-surface-400 hover:bg-stone-200/50',
                          )}
                          title="Favorites"
                        >
                          <StarIcon
                            className="h-5 w-5"
                            weight={hasFavorites ? 'fill' : 'regular'}
                          />
                        </button>
                        <div className="mx-auto h-px w-6 bg-stone-200" />
                        {ALL_PROVIDERS.map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => {
                              setActiveTab(provider)
                              setSearchQuery('')
                            }}
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-colors',
                              activeTab === provider
                                ? 'border-surface-300 bg-white'
                                : 'text-stone-400 hover:bg-stone-200/50 hover:text-stone-600',
                            )}
                            title={PROVIDER_NAMES[provider]}
                          >
                            <ProviderLogo provider={provider} size="sm" />
                          </button>
                        ))}
                      </div>

                      <div className="flex min-h-[341px] w-72 flex-col bg-white">
                        <div className="border-b border-stone-100 p-2">
                          <Input
                            ref={searchInputRef}
                            icon={<MagnifyingGlassIcon className="h-4 w-4" />}
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="border-0 bg-stone-50 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:ring-0"
                          />
                        </div>

                        <div className="max-h-72 overflow-y-auto p-2">
                          {activeTab !== 'favorites' && !connectedProviders.includes(activeTab) ? (
                            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                              <ProviderLogo provider={activeTab} size="xl" showBackground />
                              <div>
                                <Text as="p" size="sm" weight="medium" className="mb-1">
                                  {PROVIDER_NAMES[activeTab]}
                                </Text>
                                <Text as="p" size="sm" colour="muted">
                                  Connect your API key to use these models
                                </Text>
                              </div>
                              <Link
                                to="/settings/connections"
                                className="text-primary-600 hover:text-primary-700 text-sm font-medium hover:underline"
                              >
                                Add connection
                              </Link>
                            </div>
                          ) : tabModels.length === 0 ? (
                            <div className="px-3 py-6 text-center">
                              {searchQuery.trim() ? (
                                <Text size="sm" colour="muted">
                                  No models match your search
                                </Text>
                              ) : activeTab === 'favorites' ? (
                                <div className="flex flex-col items-center gap-2 py-4">
                                  <StarIcon className="h-6 w-6 text-stone-300" />
                                  <Text size="sm" colour="muted">
                                    No favorites yet
                                  </Text>
                                  <Text size="xs" colour="muted">
                                    Star models to add them here
                                  </Text>
                                </div>
                              ) : (
                                <>
                                  <LightningIcon className="mx-auto mb-2 h-5 w-5 text-stone-400" />
                                  <Text as="p" size="sm" colour="muted">
                                    All models disabled
                                  </Text>
                                  <Link
                                    to="/settings/models"
                                    className="text-primary-600 hover:text-primary-700 mt-1.5 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                                  >
                                    Enable models
                                  </Link>
                                </>
                              )}
                            </div>
                          ) : (
                            tabModels.map((model) => (
                              <ModelOption
                                key={model.id}
                                model={model}
                                isSelected={selectedModel === model.id}
                                onSelect={() => handleSelectModel(model.id)}
                                onToggleFavorite={() => handleToggleFavorite(model)}
                                isFavoriteActionPending={favoriteFetcher.state !== 'idle'}
                                showProviderLogo={activeTab === 'favorites'}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={cannotSubmit}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                  cannotSubmit
                    ? isTemporary
                      ? 'cursor-not-allowed bg-slate-700 text-slate-500'
                      : 'cursor-not-allowed bg-stone-100 text-stone-400'
                    : isTemporary
                      ? 'bg-slate-200 text-slate-800 hover:bg-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white',
                )}
              >
                {isLoading ? (
                  <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'mt-2.5 flex items-center justify-center gap-1.5 transition-opacity duration-300',
            isTemporary ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <Text size="xs" weight="medium" colour="secondary" className="flex items-center gap-1">
            <ClockIcon className="size-3.5" />
            <span>Temporary chat &middot; Not saved to history</span>
          </Text>
        </div>
      </div>
    </Form>
  )
}

function ModelOption({
  model,
  isSelected,
  onSelect,
  onToggleFavorite,
  isFavoriteActionPending,
  showProviderLogo = false,
}: {
  model: EnrichedModel
  isSelected: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  isFavoriteActionPending: boolean
  showProviderLogo?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors hover:bg-stone-50',
        isSelected && 'bg-primary-50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {showProviderLogo && <ProviderLogo provider={model.provider} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Text
              size="sm"
              weight="medium"
              className={isSelected ? 'text-primary-700' : undefined}
              truncate
            >
              {model.customName || model.name}
            </Text>
          </div>
          {model.description && (
            <Text size="xs" colour="muted" truncate>
              {model.description}
            </Text>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        disabled={isFavoriteActionPending}
        className={cn(
          'rounded-lg p-1 transition-colors',
          model.favorite
            ? 'text-amber-500 hover:bg-amber-50'
            : 'text-surface-300 hover:bg-surface-100 hover:text-surface-500',
          isFavoriteActionPending && 'cursor-not-allowed opacity-50',
        )}
        title={model.favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <StarIcon className="h-4 w-4 shrink-0" weight={model.favorite ? 'fill' : 'regular'} />
      </button>
    </div>
  )
}
