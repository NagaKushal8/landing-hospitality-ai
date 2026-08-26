// api.js — the client's view of the backend.
//
// Replaces the browser-side OpenAI calls that used to live in rag.js. What is
// deliberately kept from that file is the offline behaviour: a deterministic,
// no-network answer path so the app always says something grounded in the real
// record. It now covers more cases than it used to — no key, a cold or paused
// database, a serverless error — and it is the reason a demo never dead-ends.

import { buildContext } from '../shared/field-registry.js'

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `${path} → ${res.status}`)
  }
  return res.json()
}

async function get(path) {
  const res = await fetch(path)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `${path} → ${res.status}`)
  }
  return res.json()
}

// ---- Properties ------------------------------------------------------------

export async function fetchHomes() {
  const { homes } = await get('/api/homes')
  return homes
}

export async function fetchHome(id) {
  const { home } = await get(`/api/homes/${encodeURIComponent(id)}`)
  return home
}

export async function fetchStatus() {
  try {
    return await get('/api/health')
  } catch {
    return { ok: false, openai: 'unreachable', supabase: 'unreachable' }
  }
}

// ---- Concierge -------------------------------------------------------------

export async function answerQuestion(home, question, history = []) {
  try {
    return await post('/api/ask', { homeId: home.id, question, history })
  } catch (err) {
    console.error('[concierge] /api/ask failed:', err)
    const fallback = mockAnswer(home, question)
    return {
      text: `⚠️ Live answer unavailable (${err.message}). Showing offline fallback:\n\n${fallback.text}`,
      source: 'mock',
      error: err.message,
    }
  }
}

export async function generateSuggestedQuestions(home) {
  try {
    return await post('/api/suggest', { homeId: home.id })
  } catch (err) {
    console.error('[concierge] /api/suggest failed:', err)
    return { questions: ruleBasedQuestions(home), source: 'rules' }
  }
}

// ---- Onboarding ------------------------------------------------------------

export const enrichProperty = (payload) => post('/api/onboard/enrich', payload)
export const startCall = (payload) => post('/api/onboard/call', payload)
export const reextract = (callId) => post('/api/onboard/reextract', { callId })
export const callStatus = (callId) => get(`/api/onboard/call-status?callId=${encodeURIComponent(callId)}`)
export const fetchReplay = () => get('/api/onboard/replay')

// ---- Offline fallbacks -----------------------------------------------------

// Keyword-scores the property's own context lines against the question and
// returns the best matches. Not clever, but it is never wrong about what the
// record contains, which is the property that matters when the model is gone.
function mockAnswer(home, question) {
  const lines = buildContext(home).split('\n')
  const stop = new Set(['the', 'a', 'an', 'is', 'my', 'i', 'do', 'how', 'what', 'where', 'to', 'with', 'and', 'for', 'of', 'in', 'at', 'can', 'get'])
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))

  const scored = lines
    .map((line) => {
      const l = line.toLowerCase()
      return { line, score: terms.reduce((s, t) => (l.includes(t) ? s + 1 : s), 0) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) {
    return {
      text: `I don't have that specific detail in this home's profile. Your best bet is to contact the property team — ${formatContact(home)}.`,
      source: 'mock',
    }
  }
  return {
    text: `Here's what I have for ${home.propertyName}:\n${scored.map((x) => `• ${x.line}`).join('\n')}\n\n(Offline fallback — with the API reachable this is written by the model instead of matched.)`,
    source: 'mock',
  }
}

function formatContact(home) {
  const c = home.ownerContact
  if (!c) return 'see the listing for contact info'
  return `${c.name}${c.phone ? ` at ${c.phone}` : ''}`
}

// Only surfaces questions for fields that exist, so it still honors
// "never suggest something the data can't answer."
function ruleBasedQuestions(home) {
  const out = []
  if (home.unitDoor || home.buildingEntrance) out.push('How do I get into the building and the unit?')
  if (home.parking?.type) out.push('Where do I park?')
  if (home.pool) out.push('How do I access the pool and what are the hours?')
  if (out.length < 3 && home.trash) out.push('How does trash and recycling work here?')
  if (out.length < 3 && home.pets) out.push('What is the pet policy?')
  if (out.length < 3 && home.wifi) out.push("What's the Wi-Fi network and password?")
  if (out.length < 3 && home.lateCheckIn) out.push('What if I arrive late at night?')
  return out.slice(0, 3)
}
