const PRODUCTION_ROBOTS = `User-agent: *
Disallow:
`

// const SELFHOSTED_ROBOTS = `User-agent: *
// Disallow: /`

export const loader = () => {
  return new Response(PRODUCTION_ROBOTS, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
