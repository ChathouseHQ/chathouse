import { CheckIcon } from '@phosphor-icons/react'
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { createPasswordResetToken } from '~/lib/auth.server'
import { sendPasswordResetEmail } from '~/lib/email.server'
import { CLIENT_URL } from '~/lib/env.server'
import { getSession } from '~/lib/session.server'
import { Alert } from '~/ui/Alert'
import { Input } from '~/ui/Input'

export function meta() {
  return [
    { title: 'Forgot Password - Chathouse' },
    { name: 'description', content: 'Reset your Chathouse password' },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request)
  if (user) {
    return redirect('/chat')
  }
  return null
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required' }
  }

  const token = await createPasswordResetToken(email)

  if (token) {
    const resetUrl = `${CLIENT_URL}/reset-password/${token}`
    await sendPasswordResetEmail(email, resetUrl)
  }

  return { submitted: true }
}

export default function ForgotPasswordPage() {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-surface-900 text-3xl font-bold">Chathouse</h1>
          <p className="text-surface-600 mt-2">Reset your password</p>
        </div>

        <div className="border-surface-200 rounded-xl border bg-white p-8">
          {actionData?.submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckIcon className="h-6 w-6 text-green-600" weight="bold" />
              </div>
              <h2 className="text-surface-900 text-lg font-semibold">Check your email</h2>
              <p className="text-surface-600 mt-2 text-sm">
                If an account exists with that email, a password reset link has been sent. Please
                check your inbox (and spam folder).
              </p>
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 mt-6 inline-block text-sm font-medium"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-surface-600 mb-6 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <Form method="post" className="space-y-5">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  label="Email"
                  placeholder="you@example.com"
                />

                {actionData?.error && <Alert variant="error">{actionData.error}</Alert>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/20 w-full rounded-lg px-4 py-2.5 font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send reset link'}
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
