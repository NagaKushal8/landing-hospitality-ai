// rag.js — the retrieval + OpenAI layer for the Property Concierge.
//
// Two jobs:
//   1) answerQuestion(home, question)   -> grounded natural-language answer
//   2) generateSuggestedQuestions(home) -> 3 questions the home's data can answer
//
// Both retrieve the selected home's full profile and ground the model in it.
// With 6,000 homes you would NOT put every home in the prompt — you'd retrieve
// the one relevant profile first (that's what selecting a door does here) and,
// for very large profiles, retrieve only the relevant fields. That selection
// step is the "R" in RAG.

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export function hasApiKey() {
  return Boolean(API_KEY && API_KEY.startsWith('sk-') && !API_KEY.includes('your-key'))
}

// ---- Retrieval -------------------------------------------------------------

// Turn a home's structured record into a compact, labeled context block.
// (For a 30+ field record this is small enough to send whole; at real scale
// you'd rank fields against the question and send only the top ones.)
export function buildContext(home) {
  const lines = []
  const push = (label, val) => {
    if (val === null || val === undefined || val === '') return
    if (typeof val === 'object') {
      const inner = Object.entries(val)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
      if (inner) lines.push(`${label}: ${inner}`)
    } else {
      lines.push(`${label}: ${val}`)
    }
  }

  push('Property', home.propertyName)
  push('Door/Unit number', home.doorNumber)
  push('Address', home.address)
  push('Market', home.market)
  push('Neighborhood', home.neighborhood)
  push('Bedrooms', home.bedrooms)
  push('Bathrooms', home.bathrooms)
  push('Square feet', home.sqft)
  push('Floor', home.floor)
  push('Building entrance', home.buildingEntrance)
  push('Unit door', home.unitDoor)
  push('Late / after-hours check-in', home.lateCheckIn)
  push('Parking', home.parking)
  push('Pool', home.pool === null ? 'No pool at this property' : home.pool)
  push('Gym / fitness', home.gym)
  push('Wi-Fi', home.wifi)
  push('Hot water', home.hotWater)
  push('Heating / cooling', home.heatingCooling)
  push('Trash / recycling', home.trash)
  push('Pets', home.pets)
  push('Laundry', home.laundry)
  push('Mail / packages', home.mailPackages)
  push('Quiet hours', home.quietHours)
  push('Checkout instructions', home.checkoutInstructions)
  push('Owner / property contact', home.ownerContact)
  push('Emergency contact', home.emergencyContact)
  push('Amenities', Array.isArray(home.amenities) ? home.amenities.join(', ') : home.amenities)

  return lines.join('\n')
}

// ---- OpenAI plumbing -------------------------------------------------------

async function callOpenAI(messages, { json = false } = {}) {
  // Note: we deliberately do NOT send a custom `temperature`. The newest models
  // (e.g. gpt-5.x) only accept the default (1) and 400 on any other value, while
  // older ones accept anything — so omitting it is the one setting that works
  // across every model. Grounding here comes from the system prompt + the
  // retrieved property data, not from a low temperature.
  const body = {
    model: MODEL,
    messages,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ---- 1) Answering ----------------------------------------------------------

const ANSWER_SYSTEM = `You are the Property Concierge for ONE specific furnished apartment.
You are given that unit's data profile. Rules:
- Answer ONLY from the provided property data. Do not invent codes, numbers, hours, or policies.
- Questions may span several fields — synthesize them into one clear, friendly answer
  (e.g. a late arrival with a pet and a car touches check-in, pets, and parking).
- If the data does not contain the answer, say so briefly and point the guest to the
  property/owner contact listed in the data. Never guess.
- Be concise and concrete. Lead with the specific detail (a code, a location, a time).
- Speak directly to the guest ("you"), like a helpful front-desk person.`

export async function answerQuestion(home, question) {
  const context = buildContext(home)
  if (!hasApiKey()) return mockAnswer(home, question, context)

  try {
    const content = await callOpenAI([
      { role: 'system', content: ANSWER_SYSTEM },
      {
        role: 'user',
        content: `PROPERTY DATA for ${home.propertyName} (unit ${home.doorNumber}):\n\n${context}\n\nGUEST QUESTION: ${question}`,
      },
    ])
    return { text: content.trim(), source: 'openai' }
  } catch (err) {
    console.error('[concierge] OpenAI answer call failed:', err)
    const fallback = mockAnswer(home, question, context)
    return { text: `⚠️ OpenAI call failed (${String(err)}). Showing offline fallback:\n\n${fallback.text}`, source: 'mock', error: String(err) }
  }
}

// A deterministic, no-network fallback so the demo always shows *something*
// grounded. It keyword-scores the context lines against the question and
// returns the best matches, framed as an answer.
function mockAnswer(home, question, context) {
  const q = question.toLowerCase()
  const lines = context.split('\n')
  const stop = new Set(['the', 'a', 'an', 'is', 'my', 'i', 'do', 'how', 'what', 'where', 'to', 'with', 'and', 'for', 'of', 'in', 'at', 'can', 'get'])
  const terms = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w))
  const scored = lines
    .map((line) => {
      const l = line.toLowerCase()
      const score = terms.reduce((s, t) => (l.includes(t) ? s + 1 : s), 0)
      return { line, score }
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
  const body = scored.map((x) => `• ${x.line}`).join('\n')
  return {
    text: `Here's what I have for ${home.propertyName}:\n${body}\n\n(Offline demo answer — with an API key this is written by the model instead of matched.)`,
    source: 'mock',
  }
}

function formatContact(home) {
  const c = home.ownerContact
  if (!c) return 'see the listing for contact info'
  return `${c.name}${c.phone ? ` at ${c.phone}` : ''}`
}

// ---- 2) Suggested questions (AI pre-generated) -----------------------------

const SUGGEST_SYSTEM = `You generate exactly 3 short guest questions for one furnished apartment,
based ONLY on the data provided. Requirements:
- Every question MUST be answerable from the given data (do not ask about anything not present).
- Prefer the things guests most need on arrival that this unit actually has quirks about
  (access/codes, parking, pool ONLY if present, trash, pets, hot water, check-in timing).
- Natural, first-person guest phrasing ("How do I...", "Where can I...", "Can I...").
- Return strict JSON: {"questions": ["...", "...", "..."]}. No extra text.`

export async function generateSuggestedQuestions(home) {
  const context = buildContext(home)
  if (!hasApiKey()) return { questions: ruleBasedQuestions(home), source: 'rules' }

  try {
    const content = await callOpenAI(
      [
        { role: 'system', content: SUGGEST_SYSTEM },
        {
          role: 'user',
          content: `PROPERTY DATA for ${home.propertyName} (unit ${home.doorNumber}):\n\n${context}`,
        },
      ],
      { json: true }
    )
    const parsed = JSON.parse(content)
    const qs = Array.isArray(parsed.questions) ? parsed.questions.filter(Boolean).slice(0, 3) : []
    if (qs.length === 0) return { questions: ruleBasedQuestions(home), source: 'rules' }
    return { questions: qs, source: 'openai' }
  } catch (err) {
    console.error('[concierge] OpenAI suggested-questions call failed:', err)
    return { questions: ruleBasedQuestions(home), source: 'rules' }
  }
}

// Deterministic fallback: only surfaces questions for fields that exist, so it
// still honors "never suggest something the data can't answer."
function ruleBasedQuestions(home) {
  const out = []
  if (home.unitDoor || home.buildingEntrance) out.push('How do I get into the building and the unit?')
  if (home.parking && home.parking.type) out.push('Where do I park?')
  if (home.pool) out.push('How do I access the pool and what are the hours?')
  if (out.length < 3 && home.trash) out.push('How does trash and recycling work here?')
  if (out.length < 3 && home.pets) out.push('What is the pet policy?')
  if (out.length < 3 && home.wifi) out.push("What's the Wi-Fi network and password?")
  if (out.length < 3 && home.lateCheckIn) out.push('What if I arrive late at night?')
  return out.slice(0, 3)
}
