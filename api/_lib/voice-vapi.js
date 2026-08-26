// voice-vapi.js — Vapi implementation of the voice provider interface.
//
// Placing a call, reading it back, and translating Vapi's failures. The agent
// brief itself lives in voice.js, since it is the same whichever provider
// dials the phone.

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

import { computeGaps } from '../../shared/field-registry.js'
import { buildSystemPrompt, buildFirstMessage } from './voice.js'

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
    cost: typeof call.cost === 'number' ? call.cost : null,
  }
}
