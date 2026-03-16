import { UserIcon } from '@phosphor-icons/react'
import Avatar from 'boring-avatars'
import { useState, useRef, useEffect } from 'react'
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { toast } from 'sonner'

import { hashPassword, verifyPassword } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { Text, Panel, Button, Input, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Account Settings - Chathouse' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
    },
  })

  return { user: userData }
}

export async function action({ request }: ActionFunctionArgs) {
  const sessionUser = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string

  if (intent === 'update-profile') {
    const name = formData.get('name') as string

    await db.user.update({
      where: { id: sessionUser.id },
      data: { name: name || null },
    })

    return { success: true, message: 'Profile updated' }
  }

  if (intent === 'update-email') {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email) {
      return { error: 'Email is required' }
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    const validPassword = await verifyPassword(password, user.passwordHash)
    if (!validPassword) {
      return { error: 'Invalid password' }
    }

    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existing && existing.id !== sessionUser.id) {
      return { error: 'Email is already in use' }
    }

    await db.user.update({
      where: { id: sessionUser.id },
      data: { email: email.toLowerCase() },
    })

    return { success: true, message: 'Email updated successfully' }
  }

  if (intent === 'update-password') {
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!currentPassword || !newPassword) {
      return { error: 'All password fields are required' }
    }

    if (newPassword !== confirmPassword) {
      return { error: 'New passwords do not match' }
    }

    if (newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters' }
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    const validPassword = await verifyPassword(currentPassword, user.passwordHash)
    if (!validPassword) {
      return { error: 'Current password is incorrect' }
    }

    const newPasswordHash = await hashPassword(newPassword)

    await db.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash: newPasswordHash },
    })

    return { success: true, message: 'Password updated successfully' }
  }

  return { error: 'Invalid action' }
}

function AvatarUpload({
  user,
}: {
  user: {
    id: string
    avatarUrl: string | null
    name: string | null
    email: string
  }
}) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const revalidator = useRevalidator()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to upload avatar')
        return
      }

      toast.success('Avatar uploaded')
      revalidator.revalidate()
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove your avatar?')) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('intent', 'remove')

      await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      toast.success('Avatar removed')
      revalidator.revalidate()
    } catch {
      toast.error('Failed to remove avatar')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 overflow-hidden rounded-full">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || user.email}
            className="h-full w-full object-cover"
          />
        ) : (
          <Avatar
            size={64}
            name={user.id}
            variant="beam"
            colors={['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']}
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
          >
            Upload
          </Button>
          {user.avatarUrl && (
            <Button
              type="button"
              variant="danger-ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-surface-500 text-xs">JPEG, PNG, GIF or WebP. Max 5MB.</p>
      </div>
    </div>
  )
}

export default function AccountSettingsPage() {
  const { user } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const profileFetcher = useFetcher()

  useEffect(() => {
    if (profileFetcher.data?.success) {
      toast.success(profileFetcher.data.message)
    } else if (profileFetcher.data?.error) {
      toast.error(profileFetcher.data.error)
    }
  }, [profileFetcher.data])

  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.message)
    } else if (actionData?.error) {
      toast.error(actionData.error)
    }
  }, [actionData])

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formData = new FormData()
    formData.set('intent', 'update-profile')
    formData.set('name', e.target.value)
    profileFetcher.submit(formData, { method: 'post' })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={UserIcon}
        label="Account"
        description="Manage your account information and profile settings"
        iconColorClass="text-blue-500"
      />

      <section className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Avatar
        </Text>
        <Panel className="mt-4">{user && <AvatarUpload user={user} />}</Panel>
      </section>

      <section className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Profile
        </Text>
        <Panel className="mt-4">
          <Input
            id="name"
            name="name"
            label="Display Name"
            defaultValue={user?.name || ''}
            onBlur={handleNameBlur}
            placeholder="Your name"
            hint="This name will be shown in the welcome message"
          />
        </Panel>
      </section>

      <section className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Email Address
        </Text>
        <Panel className="mt-4">
          <Form method="post">
            <input type="hidden" name="intent" value="update-email" />

            <div className="space-y-4">
              <Input
                id="email"
                name="email"
                type="email"
                label="Email"
                defaultValue={user?.email || ''}
              />

              <Input
                id="email-password"
                name="password"
                type="password"
                label="Confirm with Password"
                placeholder="Enter your password"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                Update Email
              </Button>
            </div>
          </Form>
        </Panel>
      </section>

      <section className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Change Password
        </Text>
        <Panel className="mt-4">
          <Form method="post">
            <input type="hidden" name="intent" value="update-password" />

            <div className="space-y-4">
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                label="Current Password"
              />

              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                minLength={8}
                label="New Password"
                placeholder="At least 8 characters"
              />

              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={8}
                label="Confirm New Password"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                Update Password
              </Button>
            </div>
          </Form>
        </Panel>
      </section>
    </div>
  )
}
