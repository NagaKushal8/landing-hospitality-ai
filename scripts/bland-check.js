// Read-only Bland diagnostic. Places NO calls and spends nothing.
//
// Mirrors scripts/vapi-check.js. Its main job after the first call is finding
// the id of your best recording, which goes in DEMO_REPLAY_CALL_ID so it
// becomes what visitors see when a live call cannot be placed.
//
//   node scripts/bland-check.js

import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const KEY = process.env.BLAND_API_KEY
if (!KEY) {
  console.error('BLAND_API_KEY is not set in .env.local')
  process.exit(1)
}

// Bland's docs and examples disagree on the Bearer prefix, so mirror the
// adapter: bare first, retry once on an auth failure.
async function bland(path) {
  const attempt = (auth) =>
    fetch(`https://api.bland.ai/v1${path}`, { headers: { Authorization: auth } })

  let res = await attempt(KEY)
  let usedBearer = false
  if (res.status === 401 || res.status === 403) {
    res = await attempt(`Bearer ${KEY}`)
    usedBearer = true
  }

  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body, usedBearer }
}

const line = (l, v) => console.log(`  ${String(l).padEnd(20)} ${v}`)

console.log('\n=== Key ===')
const probe = await bland('/calls?limit=1')
if (probe.status === 401 || probe.status === 403) {
  line('status', `REJECTED (${probe.status})`)
  line('meaning', 'BLAND_API_KEY is not valid. Dashboard -> API Keys.')
  process.exit(1)
}
line('status', `accepted (${probe.status})`)
line('auth style', probe.usedBearer ? 'Bearer prefix' : 'bare key')
line('voice', process.env.BLAND_VOICE || '(Bland default)')

console.log('\n=== Recent calls ===')
const calls = await bland('/calls?limit=10')
if (!calls.ok) {
  line('error', JSON.stringify(calls.body).slice(0, 300))
  process.exit(1)
}

// Bland has returned this as a bare array and as {calls:[...]} at different
// times; accept either rather than depending on which is current.
const list = Array.isArray(calls.body) ? calls.body : calls.body?.calls || []

if (!list.length) {
  console.log('  No calls yet. Place one from the Onboard page, then re-run this.')
} else {
  let best = null
  for (const c of list) {
    const id = c.call_id || c.c_id || c.id
    // The list endpoint omits transcripts entirely; only the detail endpoint
    // carries them. Without this every call reads as empty.
    const detail = (await bland(`/calls/${id}`)).body || {}
    const transcript = detail.concatenated_transcript || ''
    console.log(`\n  ${id}`)
    line('  status', c.status || (c.completed ? 'completed' : 'in progress'))
    line('  created', c.created_at || '(unknown)')
    if (c.call_length != null) line('  length', `${c.call_length} min`)
    if (c.price != null) line('  price', `$${c.price}`)
    if (c.error_message) line('  error', c.error_message)
    line('  turns', detail.transcripts?.length ?? 0)
    line('  transcript', transcript ? `${transcript.length} chars` : '(none)')
    if (detail.recording_url) line('  recording', String(detail.recording_url).slice(0, 70))
    if (transcript.length > (best?.len || 0)) best = { id, len: transcript.length }
  }

  if (best?.len > 200) {
    console.log(`\n  Longest transcript: ${best.id} (${best.len} chars)`)
    console.log('')
    console.log('  IMPORTANT: DEMO_REPLAY_CALL_ID is looked up in this app\'s own `calls`')
    console.log('  table, not in Bland. A call placed from the Bland dashboard never gets')
    console.log('  a row here, so pinning its id will silently fall back to the written')
    console.log('  sample. Place the call you want to pin from the Onboard page — that is')
    console.log('  also the only path that runs extraction and writes the fields into the')
    console.log('  property. Then take the id from `npm run calls:list`.')
  } else {
    console.log('\n  No call yet has enough transcript to serve as the demo recording.')
    console.log('  Place a full-length one through the Onboard page and re-run this.')
  }
}

console.log('')
