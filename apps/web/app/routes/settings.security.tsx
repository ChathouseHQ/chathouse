import { CheckIcon, LockIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import QRCode from 'qrcode'
import { useState } from 'react'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import {
  disableTotp,
  enableTotp,
  generateTotpSecret,
  generateTotpUri,
  verifyPassword,
  verifyTotpToken,
} from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { Alert, Text, Panel, Button, Input, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Security Settings - Chathouse' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      totpEnabled: true,
    },
  })

  return { user: userData }
}

export async function action({ request }: ActionFunctionArgs) {
  const sessionUser = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string

  if (intent === 'setup-2fa') {
    const secret = generateTotpSecret()

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { email: true },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    const uri = generateTotpUri(secret, user.email)

    const qrCode = await QRCode.toDataURL(uri)

    return {
      step: 'verify',
      secret,
      qrCode,
    }
  }

  if (intent === 'verify-2fa') {
    const secret = formData.get('secret') as string
    const code = formData.get('code') as string
    const password = formData.get('password') as string

    if (!secret || !code || !password) {
      return { error: 'All fields are required', step: 'verify', secret }
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true, email: true },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    const validPassword = await verifyPassword(password, user.passwordHash)
    if (!validPassword) {
      const uri = generateTotpUri(secret, user.email)
      const qrCode = await QRCode.toDataURL(uri)
      return { error: 'Invalid password', step: 'verify', secret, qrCode }
    }

    const validCode = await verifyTotpToken(secret, code)
    if (!validCode) {
      const uri = generateTotpUri(secret, user.email)
      const qrCode = await QRCode.toDataURL(uri)
      return { error: 'Invalid authentication code', step: 'verify', secret, qrCode }
    }

    await enableTotp(sessionUser.id, secret)

    return { success: true, message: 'Two-factor authentication enabled' }
  }

  if (intent === 'disable-2fa') {
    const code = formData.get('code') as string
    const password = formData.get('password') as string

    if (!code || !password) {
      return { error: 'All fields are required' }
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true, totpSecret: true },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    const validPassword = await verifyPassword(password, user.passwordHash)
    if (!validPassword) {
      return { error: 'Invalid password' }
    }

    if (user.totpSecret) {
      const validCode = await verifyTotpToken(user.totpSecret, code)
      if (!validCode) {
        return { error: 'Invalid authentication code' }
      }
    }

    await disableTotp(sessionUser.id)

    return { success: true, message: 'Two-factor authentication disabled' }
  }

  return { error: 'Invalid action' }
}

export default function SecuritySettingsPage() {
  const { user } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const [showDisableForm, setShowDisableForm] = useState(false)

  const isSettingUp = actionData?.step === 'verify'

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={ShieldCheckIcon}
        label="Security"
        description="Manage your security and two-factor authentication settings"
        iconColorClass="text-indigo-500"
      />

      <section className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Two-Factor Authentication
        </Text>
        <Text size="sm" colour="muted" className="mt-1">
          Add an extra layer of security to your account by requiring a code from your authenticator
          app.
        </Text>

        <Panel className="mt-4">
          {user?.totpEnabled ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckIcon className="h-5 w-5 text-green-600" weight="bold" />
                </div>
                <div className="flex flex-col">
                  <Text weight="medium">2FA is enabled</Text>
                  <Text size="sm" colour="muted">
                    Your account is protected with two-factor authentication
                  </Text>
                </div>
              </div>

              {!showDisableForm ? (
                <button
                  type="button"
                  onClick={() => setShowDisableForm(true)}
                  className="mt-4 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Disable two-factor authentication
                </button>
              ) : (
                <Form method="post" className="border-surface-200 mt-6 space-y-4 border-t pt-6">
                  <input type="hidden" name="intent" value="disable-2fa" />

                  <Input
                    id="disable-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    label="Authentication Code"
                    placeholder="000000"
                  />

                  <Input
                    id="disable-password"
                    name="password"
                    type="password"
                    required
                    label="Password"
                  />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowDisableForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="danger" disabled={isSubmitting}>
                      Disable 2FA
                    </Button>
                  </div>
                </Form>
              )}
            </>
          ) : isSettingUp ? (
            <Form method="post" className="space-y-6">
              <input type="hidden" name="intent" value="verify-2fa" />
              <input type="hidden" name="secret" value={actionData.secret} />

              <div className="text-center">
                <Text size="sm" colour="muted" className="mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </Text>
                {actionData.qrCode && (
                  <img src={actionData.qrCode} alt="2FA QR Code" className="mx-auto h-48 w-48" />
                )}
                <p className="text-surface-500 mt-4 text-xs">
                  Or enter this code manually:{' '}
                  <code className="bg-surface-100 rounded px-2 py-1 font-mono text-xs">
                    {actionData.secret}
                  </code>
                </p>
              </div>

              <Input
                id="verify-code"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                label="Verification Code"
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
              />

              <Input
                id="verify-password"
                name="password"
                type="password"
                required
                label="Confirm with Password"
              />

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                Enable Two-Factor Authentication
              </Button>
            </Form>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="bg-surface-100 flex h-10 w-10 items-center justify-center rounded-full">
                  <LockIcon className="text-surface-500 h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <Text weight="medium">2FA is not enabled</Text>
                  <Text size="sm" colour="muted">
                    Enable two-factor authentication to secure your account
                  </Text>
                </div>
              </div>

              <Form method="post" className="mt-4">
                <input type="hidden" name="intent" value="setup-2fa" />
                <Button type="submit" disabled={isSubmitting}>
                  Set up two-factor authentication
                </Button>
              </Form>
            </>
          )}
        </Panel>
      </section>

      {actionData?.success && (
        <Alert variant="success" className="mt-6">
          {actionData.message}
        </Alert>
      )}

      {actionData?.error && (
        <Alert variant="error" className="mt-6">
          {actionData.error}
        </Alert>
      )}
    </div>
  )
}
