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
import { z } from 'zod'

import { createUser, findUserByEmail, isRegistrationEnabled } from '~/lib/auth.server'
import { createSession, createSessionCookie, getSession } from '~/lib/session.server'
import { Alert } from '~/ui/Alert'
import { Input } from '~/ui/Input'

export function meta() {
  return [
    { title: 'Sign Up - Chathouse' },
    { name: 'description', content: 'Create your Chathouse account' },
  ]
}

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request)
  if (user) {
    return redirect('/chat')
  }

  const registrationEnabled = await isRegistrationEnabled()
  return { registrationEnabled }
}

export async function action({ request }: ActionFunctionArgs) {
  const registrationEnabled = await isRegistrationEnabled()
  if (!registrationEnabled) {
    return { error: 'Registration is currently disabled' }
  }

  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const name = (formData.get('name') as string) || undefined

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const result = registerSchema.safeParse({ email, password, name })
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    return { error: 'An account with this email already exists' }
  }

  const user = await createUser(email, password, name)
  const sessionId = await createSession(user.id)
  const cookie = createSessionCookie(sessionId)

  return redirect('/chat', {
    headers: {
      'Set-Cookie': cookie,
    },
  })
}

export default function RegisterPage() {
  const { registrationEnabled } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  if (!registrationEnabled) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <h1 className="text-surface-900 text-3xl font-bold">Chathouse</h1>
            <p className="text-surface-600 mt-2">Registration is currently disabled</p>
          </div>

          <div className="border-surface-200 rounded-xl border bg-white p-8">
            <p className="text-surface-600">
              New user registration has been disabled by the administrator.
            </p>
            <Link
              to="/login"
              className="bg-primary-600 hover:bg-primary-700 mt-6 inline-block rounded-lg px-6 py-2.5 font-medium text-white transition-colors"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-surface-900 text-3xl font-bold">Chathouse</h1>
          <p className="text-surface-600 mt-2">Create your account</p>
        </div>

        <div className="border-surface-200 rounded-xl border bg-white p-8">
          <Form method="post" className="space-y-5">
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              label={
                <>
                  Name <span className="text-surface-400">(optional)</span>
                </>
              }
              placeholder="Your name"
            />

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
              autoComplete="new-password"
              required
              minLength={8}
              revealable
              label="Password"
              placeholder="At least 8 characters"
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              revealable
              label="Confirm Password"
              placeholder="Repeat your password"
            />

            {actionData?.error && <Alert variant="error">{actionData.error}</Alert>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/20 w-full rounded-lg px-4 py-2.5 font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </Form>

          <div className="text-surface-600 mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
