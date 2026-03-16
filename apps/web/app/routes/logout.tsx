import { redirect, type ActionFunctionArgs } from 'react-router'

import { createLogoutCookie, destroySession } from '~/lib/session.server'

export async function action({ request }: ActionFunctionArgs) {
  await destroySession(request)

  return redirect('/login', {
    headers: {
      'Set-Cookie': createLogoutCookie(),
    },
  })
}

export async function loader() {
  return redirect('/login')
}
