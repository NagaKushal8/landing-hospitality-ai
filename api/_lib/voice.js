// voice.js — the agent brief, and dispatch to whichever provider dials.
//
// The brief is the valuable part and it is provider-agnostic: it is built from
// the gap list computed at dial time, so the agent is told exactly what this
// property is still missing and nothing else. Which vendor turns that into a
// phone call is an implementation detail, selected by VOICE_PROVIDER.
//
// Results are collected by polling rather than a webhook. Polling needs no
// public URL, so it works from a laptop with no tunnel — and on serverless it
// avoids holding a function open for the length of a phone call.

import { filledSummary } from '../../shared/field-registry.js'

const PROVIDER = (process.env.VOICE_PROVIDER || 'vapi').toLowerCase()

export const providerName = () => PROVIDER

async function impl() {
  if (PROVIDER === 'bland') return import('./voice-bland.js')
  return import('./voice-vapi.js')
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

// ---- Provider dispatch -----------------------------------------------------
//
// Every provider exposes the same three things: whether it can dial, how to
// start a call, and how to read one back. Everything downstream — extraction,
// the spend ledger, the replay — is written against this shape, not a vendor.

export async function isConfigured() {
  return (await impl()).isConfigured()
}

export async function startCall(args) {
  return (await impl()).startCall(args)
}

/** @returns {{raw, status, endedReason, transcript, cost}} */
export async function fetchCall(callId) {
  return (await impl()).fetchCall(callId)
}
