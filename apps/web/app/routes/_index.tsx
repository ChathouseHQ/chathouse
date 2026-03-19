import { redirect, type LoaderFunctionArgs } from 'react-router'

import { getSession } from '~/lib/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request)

  if (user) {
    return redirect('/chat')
  }

  return redirect('/login')
}
