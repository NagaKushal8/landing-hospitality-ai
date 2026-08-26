// Small helpers so every route reports failures the same way.

export function methodGuard(req, res, allowed) {
  if (req.method === allowed) return true
  res.setHeader('Allow', allowed)
  res.status(405).json({ error: `Method ${req.method} not allowed` })
  return false
}

export function fail(res, err, status = 500) {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[api]', message)
  res.status(status).json({ error: message })
}
