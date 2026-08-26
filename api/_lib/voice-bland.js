// voice-bland.js — Bland implementation of the voice provider interface.
//
// Added because Vapi's own phone numbers refused every outbound call on a
// card-less account, and Bland connected on the first try. Same interface as
// voice-vapi.js: everything downstream — the brief, extraction, the spend
// ledger, the replay — is unchanged.
//
// Two shape differences worth knowing:
//   - Bland's `task` is the whole agent brief; there is no separate system
//     message and no transient-assistant object to assemble.
//   - It reports completion as `completed: true` with status "completed",
//     where the rest of this codebase speaks Vapi's "ended". Normalised here so
//     call-status.js does not have to know which vendor it is talking to.

import { computeGaps } from '../../shared/field-registry.js'
import { buildSystemPrompt, buildFirstMessage } from './voice.js'

const BASE = 'https://api.bland.ai/v1'

const MODEL = process.env.BLAND_MODEL || 'base'
const VOICE = process.env.BLAND_VOICE || ''

// Bland bills per minute and charges a flat fee even on a failed attempt, so a
// runaway call is a real cost. Same eight-minute backstop as the Vapi path.
const MAX_MINUTES = Math.max(1, Math.round(Number(process.env.VAPI_MAX_SECONDS || 480) / 60))

export function isConfigured() {
  return Boolean(process.env.BLAND_API_KEY)
}

// Bland's docs and community examples disagree on whether the key is sent bare
// or with a Bearer prefix, so try bare first and retry once on an auth failure
// rather than making the deployment depend on which is currently true.
async function bland(path, { method = 'GET', body } = {}) {
  const attempt = (authValue) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: authValue, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const key = process.env.BLAND_API_KEY
  let res = await attempt(key)
  if (res.status === 401 || res.status === 403) res = await attempt(`Bearer ${key}`)

  const text = await res.text()
  if (!res.ok) {
    console.error(`[bland] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`)
    throw new Error(explainBlandError(res.status, text))
  }
  return text ? JSON.parse(text) : {}
}

function explainBlandError(status, text) {
  let payload = {}
  try {
    payload = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  const msg = String(payload.message || payload.errors || text || '')
  const low = msg.toLowerCase()

  if (status === 401 || status === 403) {
    return 'Bland rejected the API key. Check BLAND_API_KEY against Dashboard -> API Keys.'
  }
  if (low.includes('credit') || low.includes('balance') || low.includes('funds')) {
    return `Bland rejected the call for billing reasons: ${msg}. Top up in the Bland dashboard.`
  }
  if (low.includes('phone') || low.includes('e.164') || low.includes('number')) {
    return `Bland did not accept the number being dialled: ${msg}.`
  }
  return `Bland ${status}: ${msg.slice(0, 300)}`
}

// ---- Calls -----------------------------------------------------------------

export async function startCall({ home, phoneNumber }) {
  if (!isConfigured()) throw new Error('Bland is not configured (BLAND_API_KEY)')

  const gaps = computeGaps(home)
  if (!gaps.length) {
    throw new Error('Nothing left to ask about — this property has no gaps a call could fill.')
  }

  const res = await bland('/calls', {
    method: 'POST',
    body: {
      phone_number: phoneNumber,
      task: buildSystemPrompt(home, gaps),
      first_sentence: buildFirstMessage(home),
      model: MODEL,
      max_duration: MAX_MINUTES,
      record: true,
      ...(VOICE ? { voice: VOICE } : {}),
      metadata: { propertyId: home.id },
    },
  })

  const callId = res.call_id || res.callId
  if (!callId) throw new Error(`Bland did not return a call id: ${JSON.stringify(res).slice(0, 300)}`)
  return { callId, status: 'queued', gaps }
}

// The rest of the codebase speaks Vapi's status vocabulary, so translate into
// it rather than teaching every caller two dialects.
function normalizeStatus(call) {
  if (call.completed === true) return 'ended'
  const s = String(call.status || '').toLowerCase()
  if (s === 'completed' || s === 'complete') return 'ended'
  if (s === 'no-answer' || s === 'no_answer') return 'no-answer'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'busy') return 'busy'
  if (s === 'in-progress' || s === 'started') return 'in-progress'
  if (s === 'queued' || s === 'new') return 'queued'
  if (s === 'ringing') return 'ringing'
  return s || 'unknown'
}

// Bland labels turns `assistant` and `user`, where `user` is the property
// contact. Relabelled to the AI/Contact shape the extraction prompt is written
// against, so a transcript reads the same whichever provider produced it.
const speakerOf = (who) =>
  ['user', 'human', 'customer'].includes(String(who || '').toLowerCase()) ? 'Contact' : 'AI'

export function extractTranscript(call) {
  // The turn array is preferred: it gives clean per-line control, where
  // concatenated_transcript arrives as one blob with " \n " separators.
  if (Array.isArray(call?.transcripts) && call.transcripts.length) {
    const lines = call.transcripts
      .map((t) => `${speakerOf(t.user)}: ${String(t.text ?? '').trim()}`)
      .filter((l) => l.length > 5)
    if (lines.length) return lines.join('\n')
  }

  if (typeof call?.concatenated_transcript === 'string' && call.concatenated_transcript.trim()) {
    return call.concatenated_transcript
      .split(/\s*\n\s*/)
      .map((l) => l.replace(/^(assistant|user|human|customer)\s*:\s*/i, (_, w) => `${speakerOf(w)}: `).trim())
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export async function fetchCall(callId) {
  const call = await bland(`/calls/${encodeURIComponent(callId)}`)
  return {
    raw: call,
    status: normalizeStatus(call),
    endedReason: call.error_message || null,
    transcript: extractTranscript(call),
    cost: typeof call.price === 'number' ? call.price : null,
  }
}
