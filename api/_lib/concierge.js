// concierge.js — grounded answering for one property.
//
// The prompts are carried over from the prototype unchanged; they were already
// doing the important work of refusing to invent codes. What is new is that
// the grounding block now sits in the system message rather than being glued
// onto the question, so a real conversation can follow it: "how do I get in?"
// then "what about the garage?" resolves without restating the property.

import { buildContext } from '../../shared/field-registry.js'
import { callOpenAI, parseJsonLoose, hasApiKey } from './llm.js'

const ANSWER_SYSTEM = `You are the Property Concierge for ONE specific furnished apartment.
You are given that unit's data profile. Rules:
- Answer ONLY from the provided property data. Do not invent codes, numbers, hours, or policies.
- Questions may span several fields — synthesize them into one clear, friendly answer
  (e.g. a late arrival with a pet and a car touches check-in, pets, and parking).
- If the data does not contain the answer, say so briefly and point the guest to the
  property/owner contact listed in the data. Never guess.
- Be concise and concrete. Lead with the specific detail (a code, a location, a time).
- Speak directly to the guest ("you"), like a helpful front-desk person.
- The guest may ask follow-ups that refer back to earlier turns. Resolve them against
  the conversation so far without making them repeat themselves.`

const SUGGEST_SYSTEM = `You generate exactly 3 short guest questions for one furnished apartment,
based ONLY on the data provided. Requirements:
- Every question MUST be answerable from the given data (do not ask about anything not present).
- Prefer the things guests most need on arrival that this unit actually has quirks about
  (access/codes, parking, pool ONLY if present, trash, pets, hot water, check-in timing).
- Natural, first-person guest phrasing ("How do I...", "Where can I...", "Can I...").
- Return strict JSON: {"questions": ["...", "...", "..."]}. No extra text.`

const MAX_HISTORY = 6

function grounding(home) {
  return `PROPERTY DATA for ${home.propertyName} (unit ${home.doorNumber}):\n\n${buildContext(home)}`
}

export async function answerQuestion(home, question, history = []) {
  if (!hasApiKey()) throw new Error('OPENAI_API_KEY is not configured')

  const turns = history
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }))

  const content = await callOpenAI([
    { role: 'system', content: `${ANSWER_SYSTEM}\n\n${grounding(home)}` },
    ...turns,
    { role: 'user', content: question },
  ])
  return { text: content.trim(), source: 'openai' }
}

export async function generateSuggestedQuestions(home) {
  if (!hasApiKey()) throw new Error('OPENAI_API_KEY is not configured')

  const content = await callOpenAI(
    [
      { role: 'system', content: SUGGEST_SYSTEM },
      { role: 'user', content: grounding(home) },
    ],
    { json: true }
  )
  const parsed = parseJsonLoose(content)
  const questions = Array.isArray(parsed?.questions) ? parsed.questions.filter(Boolean).slice(0, 3) : []
  if (!questions.length) throw new Error('Model returned no usable questions')
  return { questions, source: 'openai' }
}
