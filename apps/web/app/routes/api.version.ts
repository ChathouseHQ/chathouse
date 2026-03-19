import { getVersionInfo } from '~/lib/version.server'

export async function loader() {
  const versionInfo = await getVersionInfo()
  return Response.json(versionInfo)
}
