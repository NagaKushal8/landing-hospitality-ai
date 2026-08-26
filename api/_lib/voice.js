// voice.js — the outbound call: what the agent is told, and how it is placed.
//
// The brief is the valuable half. It is built from the gap list computed at
// dial time, so the agent is told exactly what this property is still missing
// and nothing else — that is what keeps calls short and stops them reading
// like a form.
//
// Bland is the provider. A single API key in a header, one POST to place a
// call, one GET to read it back. Results are collected by polling rather than
// their webhook: polling needs no public URL, so it works from a laptop with
// no tunnel, and on serverless it avoids holding a function open for the
// length of a phone call.

import { computeGaps, knownFacts } from '../../shared/field-registry.js'

const BASE = 'https://api.bland.ai/v1'

const MODEL = process.env.BLAND_MODEL || 'base'
const VOICE = process.env.BLAND_VOICE || ''

// Billed per minute, plus a flat fee on every attempt including failures, so a
// call that goes sideways is a real cost. Five minutes is what we promise the
// contact; this is the backstop.
const MAX_MINUTES = Math.max(1, Number(process.env.CALL_MAX_MINUTES || 8))

// Bland's scale is roughly 50–200, lower interrupting more eagerly. The
// contact is doing us a favour and will trail off mid-sentence ("uh, under
// uh…"); cutting them off there loses the answer, so this leans patient.
const INTERRUPTION_THRESHOLD = Number(process.env.BLAND_INTERRUPTION_THRESHOLD || 150)

export function isConfigured() {
  return Boolean(process.env.BLAND_API_KEY)
}

// Bland's docs and their own examples disagree on whether the key takes a
// Bearer prefix. Try bare, retry once on an auth failure, rather than making
// the deployment depend on which is currently true.
async function bland(path, { method = 'GET', body } = {}) {
  const attempt = (auth) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const key = process.env.BLAND_API_KEY
  let res = await attempt(key)
  if (res.status === 401 || res.status === 403) res = await attempt(`Bearer ${key}`)

  const text = await res.text()
  if (!res.ok) {
    // Raw body to the log, a readable version to the caller.
    console.error(`[bland] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`)
    throw new Error(explainError(res.status, text))
  }
  return text ? JSON.parse(text) : {}
}

// Call failures here are operational rather than programming errors — no
// credit, a bad number, a rejected key. Raw JSON in a red box reads like a
// crash, so say what to do about it instead.
function explainError(status, text) {
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

// ---- The brief -------------------------------------------------------------

export function buildSystemPrompt(home, gaps) {
  const known = knownFacts(home)

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

WHAT YOU ALREADY KNOW — do not ask about any of these, you would be wasting
their time. Read them: they often answer a later question before you ask it.
${known.length ? known.map((k) => `- ${k}`).join('\n') : '- (nothing yet)'}

HOW TO TALK
- This is a conversation, not a form. Do not read the list above out as questions.
  Work through it the way a person would: group related things together (getting in
  the building, then the unit door, then parking and the garage), and let the topic
  flow where they take it.
- The list may be longer than the time you have. Cover everything marked PRIORITY
  first — those are the ones that leave a guest locked out if nobody knows them.
  Anything else is a bonus.
- Reason from what you already know before asking. If parking is street-only,
  there is no garage remote to ask about — confirm in passing rather than asking
  a question the listing already answered. Asking about something the record
  contradicts makes it obvious you did not read it.
- If they volunteer several details at once, take all of them and do NOT re-ask.
- Ask one thing at a time and actually listen to the answer before moving on.
- For any code, number, or address, repeat it back once to confirm you heard it right.
  Say digits individually: "eight-eight-four-two".
- If they trail off or hesitate, wait, then ask a short clarifying question. Do not
  fill the silence with a new topic — you will lose the answer they were forming.
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

// ---- Placing and reading a call --------------------------------------------

export async function startCall({ home, phoneNumber, gaps: scoped }) {
  if (!isConfigured()) throw new Error('Bland is not configured (BLAND_API_KEY)')

  // The caller may have narrowed the list to critical fields only; respect that
  // rather than silently briefing on everything.
  const gaps = scoped?.length ? scoped : computeGaps(home)
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
      // Let the person say "hello" before the agent launches in. Talking over
      // the pickup is the single most obviously-a-robot thing a call can do.
      wait_for_greeting: true,
      interruption_threshold: INTERRUPTION_THRESHOLD,
      ...(VOICE ? { voice: VOICE } : {}),
      // Our own ids, so a call can be reconciled back to a property from
      // Bland's side without a lookup table.
      metadata: { propertyId: home.id, doorNumber: home.doorNumber || null },
    },
  })

  const callId = res.call_id || res.callId
  if (!callId) throw new Error(`Bland did not return a call id: ${JSON.stringify(res).slice(0, 300)}`)
  return { callId, status: 'queued', gaps }
}

// Bland reports completion as `completed: true` with status "completed". The
// rest of this codebase settled on "ended" and a small terminal set, so
// translate once here rather than teaching every caller two dialects.
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
// contact. Relabelled so a transcript reads the same everywhere and the
// extraction prompt is not inferring who is who on every call.
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

/** @returns {{raw, status, endedReason, transcript, cost, recordingUrl, summary}} */
export async function fetchCall(callId) {
  const call = await bland(`/calls/${encodeURIComponent(callId)}`)
  return {
    raw: call,
    status: normalizeStatus(call),
    endedReason: call.error_message || call.call_ended_by || null,
    transcript: extractTranscript(call),
    cost: typeof call.price === 'number' ? call.price : null,
    recordingUrl: call.recording_url || null,
    summary: call.summary || null,
  }
}
