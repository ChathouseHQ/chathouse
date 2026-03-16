import { XIcon } from '@phosphor-icons/react'
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { resetPasswordWithToken, validatePasswordResetToken } from '~/lib/auth.server'
import { getSession } from '~/lib/session.server'
import { Alert } from '~/ui/Alert'
import { Input } from '~/ui/Input'

export function meta() {
  return [
    { title: 'Reset Password - Chathouse' },
    { name: 'description', content: 'Set a new password for your Chathouse account' },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getSession(request)
  if (user) {
    return redirect('/chat')
  }

  if (!params.token) {
    return { valid: false, email: null }
  }

  const resetToken = await validatePasswordResetToken(params.token)
  if (!resetToken) {
    return { valid: false, email: null }
  }

  return { valid: true, email: resetToken.user.email }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { error: 'All fields are required' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const success = await resetPasswordWithToken(params.token!, password)
  if (!success) {
    return { error: 'This reset link is invalid or has expired' }
  }

  return redirect('/login?reset=1')
}

export default function ResetPasswordPage() {
  const { valid, email } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-surface-900 text-3xl font-bold">Chathouse</h1>
          <p className="text-surface-600 mt-2">Set a new password</p>
        </div>

        <div className="border-surface-200 rounded-xl border bg-white p-8">
          {!valid ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <XIcon className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-surface-900 text-lg font-semibold">Invalid or expired link</h2>
              <p className="text-surface-600 mt-2 text-sm">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="bg-primary-600 hover:bg-primary-700 mt-6 inline-block rounded-lg px-6 py-2.5 font-medium text-white transition-colors"
              >
                Request new link
              </Link>
            </div>
          ) : (
            <>
              {email && (
                <p className="text-surface-600 mb-6 text-sm">
                  Enter a new password for{' '}
                  <span className="text-surface-900 font-medium">{email}</span>
                </p>
              )}

              <Form method="post" className="space-y-5">
                <Input
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  revealable
                  label="New Password"
                  placeholder="At least 8 characters"
                />

                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  revealable
                  label="Confirm New Password"
                  placeholder="Repeat your password"
                />

                {actionData?.error && <Alert variant="error">{actionData.error}</Alert>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/20 w-full rounded-lg px-4 py-2.5 font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Resetting password...' : 'Reset password'}
                </button>
              </Form>

              <div className="text-surface-600 mt-6 text-center text-sm">
                Remember your password?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
