// voice.js — stage two of onboarding: an outbound call to the property contact.
//
// The assistant is transient (built fresh per call and sent inline) rather than
// configured in the Vapi dashboard. That is the whole point: the gap list is
// computed at dial time, so the agent is briefed on exactly what this property
// is still missing and nothing else. A dashboard assistant would drift from the
// registry the moment a field changed.
//
// Results are collected by polling rather than a webhook. Polling needs no
// public URL, so it works from a laptop with no tunnel — and on serverless it
// avoids holding a function open for the length of a phone call.

import { computeGaps, filledSummary } from '../../shared/field-registry.js'

const BASE = 'https://api.vapi.ai'

const MODEL = process.env.VAPI_MODEL || 'gpt-4o'
const VOICE_PROVIDER = process.env.VAPI_VOICE_PROVIDER
const VOICE_ID = process.env.VAPI_VOICE_ID

// Calls are metered per minute. Five minutes is what we promise the contact;
// eight is a hard stop so a call that goes sideways cannot run up a bill.
const MAX_CALL_SECONDS = Number(process.env.VAPI_MAX_SECONDS || 480)

export function isConfigured() {
  return Boolean(process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID)
}

// Vapi's failures are mostly operational rather than programming errors — a
// spent daily quota, an unverified number, no credit left. Raw JSON in a red
// box makes those read like a crash, so translate the ones that actually
// happen into what to do about them.
function explainVapiError(status, text) {
  let payload = {}
  try {
    payload = JSON.parse(text)
  } catch {
    /* not JSON — fall through to the raw text */
  }
  const msg = String(payload.message || text || '')
  const low = msg.toLowerCase()

  if (low.includes('daily outbound call limit')) {
    return (
      'Vapi will not place the call: free Vapi numbers have a daily outbound limit and this one has hit it. ' +
      'Cheapest fix is to add a payment method in Vapi — that is pay-as-you-go with no monthly fee, and the cap ' +
      'appears to be a gate on card-less accounts. Failing that, import a Twilio number (Phone Numbers -> Import, ' +
      '$1.15/mo, definitively uncapped) and put its id in VAPI_PHONE_NUMBER_ID. Do not buy the Team plan; it will not help.'
    )
  }
  if (low.includes('insufficient') || low.includes('credit') || low.includes('balance')) {
    return `Vapi rejected the call for billing reasons: ${msg}. Check the credit balance in the Vapi dashboard.`
  }
  if (status === 401 || status === 403) {
    return (
      'Vapi rejected the API key. POST /call is privately scoped, so it needs the PRIVATE key from ' +
      'Dashboard -> API Keys — the public key only works for web calls.'
    )
  }
  if (low.includes('phonenumberid') || low.includes('phone number')) {
    return `Vapi did not accept the phone number id: ${msg}. VAPI_PHONE_NUMBER_ID must be the number's UUID, not the phone number itself.`
  }
  if (low.includes('customer') || low.includes('e164') || low.includes('invalid number')) {
    return `Vapi did not accept the number being dialled: ${msg}.`
  }
  return `Vapi ${status}: ${msg.slice(0, 300)}`
}

async function vapi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) {
    // Keep the raw body in the server log; the caller gets the readable version.
    console.error(`[vapi] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`)
    throw new Error(explainVapiError(res.status, text))
  }
  return text ? JSON.parse(text) : {}
}

// ---- The brief -------------------------------------------------------------

export function buildSystemPrompt(home, gaps) {
  const known = filledSummary(home)

  // Critical fields first. A brief can easily run longer than the five minutes
  // we promised, and if the contact cuts it short we want the door codes
  // captured rather than the trash schedule.
  const ordered = [...gaps].sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)))
  const topics = ordered.map((g) => `- ${g.voiceTopic}${g.critical ? '  [PRIORITY — read this one back to confirm]' : ''}`)

  return `You are an assistant calling on behalf of a corporate housing company to verify
access and check-in details for one property, so that guests arriving at this unit
are not left stranded at the door.

THE PROPERTY
${home.propertyName || 'This property'}${home.doorNumber ? `, unit ${home.doorNumber}` : ''}
${home.address || ''}

WHAT YOU NEED TO LEARN
${topics.join('\n')}

WHAT YOU ALREADY KNOW — never ask about these, you would be wasting their time:
${known.length ? known.join(', ') : '(nothing yet)'}

HOW TO TALK
- This is a conversation, not a form. Do not read the list above out as questions.
  Work through it the way a person would: group related things together (getting in
  the building, then the unit door, then parking and the garage), and let the topic
  flow where they take it.
- The list may be longer than the time you have. Cover everything marked PRIORITY
  first — those are the ones that leave a guest locked out if nobody knows them.
  Anything else is a bonus.
- If they volunteer several details at once, take all of them and do NOT re-ask.
- Ask one thing at a time and actually listen to the answer before moving on.
- For any code, number, or address, repeat it back once to confirm you heard it right.
  Say digits individually: "eight-eight-four-two".
- If they do not know something, say that is fine and move on. Never press, never
  ask the same thing twice.
- If they are busy, offer to call back and end the call politely.
- Keep your turns short. Two sentences at most.
- Do not invent or suggest answers. If they say the lock is "one of those keypad
  things", ask what they mean rather than filling it in for them.
- When you have what you need, thank them, tell them this helps guests get in without
  calling anyone, and end the call.

You are talking to a property manager or owner who is doing you a favour. Be warm,
efficient, and respectful of their time.`
}

export function buildFirstMessage(home) {
  const where = home.address || home.propertyName || 'one of your properties'
  return `Hi! I'm an AI assistant calling on behalf of the property team to verify a few access and check-in details for ${where}. It should only take about five minutes — is now an okay time?`
}

// ---- Calls -----------------------------------------------------------------

export async function startCall({ home, phoneNumber }) {
  if (!isConfigured()) {
    throw new Error('Vapi is not configured (VAPI_API_KEY / VAPI_PHONE_NUMBER_ID)')
  }

  const gaps = computeGaps(home)
  if (!gaps.length) {
    throw new Error('Nothing left to ask about — this property has no gaps a call could fill.')
  }

  const assistant = {
    name: 'Property Details Verification',
    firstMessage: buildFirstMessage(home),
    model: {
      provider: 'openai',
      model: MODEL,
      messages: [{ role: 'system', content: buildSystemPrompt(home, gaps) }],
    },
    maxDurationSeconds: MAX_CALL_SECONDS,
    ...(VOICE_PROVIDER && VOICE_ID ? { voice: { provider: VOICE_PROVIDER, voiceId: VOICE_ID } } : {}),
  }

  const call = await vapi('/call', {
    method: 'POST',
    body: {
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: phoneNumber },
      assistant,
    },
  })

  if (!call.id) throw new Error(`Vapi did not return a call id: ${JSON.stringify(call).slice(0, 300)}`)
  return { callId: call.id, status: call.status || 'queued', gaps }
}

// Vapi has moved the transcript between top-level and `artifact` across
// versions, so read every place it has lived and reconstruct from the message
// list as a last resort.
export function extractTranscript(call) {
  if (typeof call?.artifact?.transcript === 'string' && call.artifact.transcript.trim()) {
    return call.artifact.transcript
  }
  if (typeof call?.transcript === 'string' && call.transcript.trim()) {
    return call.transcript
  }
  const messages = call?.artifact?.messages || call?.messages
  if (Array.isArray(messages)) {
    const lines = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'bot')
      .map((m) => `${m.role === 'user' ? 'Contact' : 'AI'}: ${m.message ?? m.content ?? ''}`)
      .filter((l) => l.trim().length > 10)
    if (lines.length) return lines.join('\n')
  }
  return ''
}

export async function fetchCall(callId) {
  const call = await vapi(`/call/${encodeURIComponent(callId)}`)
  return {
    raw: call,
    status: call.status || 'unknown',
    endedReason: call.endedReason || null,
    transcript: extractTranscript(call),
  }
}
