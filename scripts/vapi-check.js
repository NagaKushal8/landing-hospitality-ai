// Read-only Vapi diagnostic. Places NO calls and spends nothing.
//
// Answers the questions you actually need answered before paying anyone:
// is the key the right kind, is the phone number id real, is it a Vapi-issued
// number or an imported one, and did any call ever get far enough to have an
// endedReason.
//
//   node scripts/vapi-check.js

import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const KEY = process.env.VAPI_API_KEY
const NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID

if (!KEY) {
  console.error('VAPI_API_KEY is not set in .env.local')
  process.exit(1)
}

async function vapi(path) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body }
}

const line = (label, value) => console.log(`  ${String(label).padEnd(22)} ${value}`)

console.log('\n=== Key ===')
const me = await vapi('/phone-number?limit=1')
if (me.status === 401 || me.status === 403) {
  line('status', `REJECTED (${me.status})`)
  line('meaning', 'This is not a valid PRIVATE key.')
  console.log('\n  POST /call is privately scoped. Dashboard -> API Keys -> the PRIVATE key,')
  console.log('  not the public one (which only works for /call/web).')
  process.exit(1)
}
line('status', me.ok ? `accepted (${me.status})` : `unexpected (${me.status})`)

console.log('\n=== Phone numbers on this account ===')
const numbers = await vapi('/phone-number')
if (!numbers.ok) {
  line('error', JSON.stringify(numbers.body).slice(0, 300))
} else {
  const list = Array.isArray(numbers.body) ? numbers.body : []
  if (!list.length) line('(none)', 'No numbers provisioned — that alone blocks outbound calling.')
  for (const n of list) {
    const mine = n.id === NUMBER_ID
    console.log(`\n  ${mine ? '-> ' : '   '}${n.number || '(no number)'}${mine ? '   <- VAPI_PHONE_NUMBER_ID' : ''}`)
    line('   id', n.id)
    // 'vapi' means a Vapi-issued number, which is the kind carrying the daily
    // outbound cap. 'twilio' means imported, which is the uncapped path.
    line('   provider', n.provider || '(unspecified)')
    if (n.status) line('   status', n.status)
  }
  if (NUMBER_ID && !list.some((n) => n.id === NUMBER_ID)) {
    console.log(`\n  WARNING: VAPI_PHONE_NUMBER_ID (${NUMBER_ID}) matches none of the above.`)
  }
}

console.log('\n=== Recent calls (this is where endedReason would be) ===')
const calls = await vapi('/call?limit=10')
if (!calls.ok) {
  line('error', JSON.stringify(calls.body).slice(0, 300))
} else {
  const list = Array.isArray(calls.body) ? calls.body : []
  if (!list.length) {
    console.log('  No calls on this account at all.')
  } else {
    for (const c of list) {
      console.log(`\n  ${c.id}`)
      line('   status', c.status)
      line('   endedReason', c.endedReason || '(none)')
      line('   createdAt', c.createdAt)
      if (typeof c.cost === 'number') line('   cost', `$${c.cost}`)
      const t = c.artifact?.transcript || c.transcript || ''
      line('   transcript', t ? `${t.length} chars` : '(none)')
    }
    console.log('\n  To pin the best of these as the demo recording, put its id in')
    console.log('  DEMO_REPLAY_CALL_ID in .env.local and your Vercel env vars.')
  }
}

console.log('')
