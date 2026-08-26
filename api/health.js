// Pinged daily by a Vercel cron. Supabase free-tier projects pause after about
// a week of inactivity, and a paused project means the demo link is dead when
// someone finally opens it — this keeps a query on the clock.

import { isConfigured } from './_lib/supabase.js'
import { listHomes, readOnly } from './_lib/store.js'
import { hasApiKey } from './_lib/llm.js'

export default async function handler(req, res) {
  const status = {
    ok: true,
    supabase: isConfigured() ? 'configured' : 'not configured (serving bundled seed data)',
    openai: hasApiKey() ? 'configured' : 'not configured',
    vapi: process.env.VAPI_API_KEY ? 'configured' : 'not configured',
    readOnly: readOnly(),
  }
  try {
    status.properties = (await listHomes()).length
  } catch (err) {
    status.ok = false
    status.properties = null
    status.error = err.message
  }
  res.status(status.ok ? 200 : 503).json(status)
}
