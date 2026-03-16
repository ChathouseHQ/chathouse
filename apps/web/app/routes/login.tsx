import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { findUserByEmail, verifyPassword, verifyTotpToken } from '~/lib/auth.server'
import { createSession, createSessionCookie, getSession } from '~/lib/session.server'
import { Alert } from '~/ui/Alert'
import { Input } from '~/ui/Input'

export function meta() {
  return [
    { title: 'Login - Chathouse' },
    { name: 'description', content: 'Sign in to your Chathouse account' },
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
  const password = formData.get('password') as string
  const totpCode = formData.get('totp') as string | null
  const step = (formData.get('step') as string) || 'credentials'

  if (!email || !password) {
    return { error: 'Email and password are required', step: 'credentials' }
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return { error: 'Invalid email or password', step: 'credentials' }
  }

  const validPassword = await verifyPassword(password, user.passwordHash)
  if (!validPassword) {
    return { error: 'Invalid email or password', step: 'credentials' }
  }

  if (user.totpEnabled && user.totpSecret) {
    if (step === 'credentials') {
      return { needsTotp: true, email, step: 'totp' }
    }

    if (!totpCode) {
      return { error: 'Authentication code is required', needsTotp: true, email, step: 'totp' }
    }

    const validTotp = await verifyTotpToken(user.totpSecret, totpCode)
    if (!validTotp) {
      return { error: 'Invalid authentication code', needsTotp: true, email, step: 'totp' }
    }
  }

  const sessionId = await createSession(user.id)
  const cookie = createSessionCookie(sessionId)

  return redirect('/chat', {
    headers: {
      'Set-Cookie': cookie,
    },
  })
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const [searchParams] = useSearchParams()
  const passwordReset = searchParams.get('reset') === '1'

  const needsTotp = actionData?.needsTotp

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-surface-900 text-3xl font-bold">Chathouse</h1>
          <p className="text-surface-600 mt-2">
            {needsTotp ? 'Enter your authentication code' : 'Sign in to your account'}
          </p>
        </div>

        {passwordReset && (
          <Alert variant="success" className="mb-4">
            Your password has been reset. Sign in with your new password.
          </Alert>
        )}

        <div className="border-surface-200 rounded-xl border bg-white p-8">
          <Form method="post" className="space-y-5">
            <input type="hidden" name="step" value={needsTotp ? 'totp' : 'credentials'} />

            {!needsTotp ? (
              <>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  label="Email"
                  placeholder="you@example.com"
                />

                <Input
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  revealable
                  label={
                    <span className="flex items-center justify-between">
                      <span>Password</span>
                      <Link
                        to="/forgot-password"
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        Forgot password?
                      </Link>
                    </span>
                  }
                  placeholder="••••••••"
                />
              </>
            ) : (
              <>
                <input type="hidden" name="email" value={actionData.email} />
                <input type="hidden" name="password" value="" />
                <Input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  label="Authentication Code"
                  className="text-center text-2xl tracking-widest"
                  placeholder="000000"
                  hint="Enter the 6-digit code from your authenticator app"
                />
              </>
            )}

            {actionData?.error && <Alert variant="error">{actionData.error}</Alert>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/20 w-full rounded-lg px-4 py-2.5 font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </Form>

          <div className="text-surface-600 mt-6 text-center text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
