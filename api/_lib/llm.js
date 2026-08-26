// llm.js — the OpenAI plumbing, moved server-side.
//
// In the prototype this lived in src/rag.js and ran in the browser, which meant
// VITE_OPENAI_API_KEY was compiled into the client bundle for anyone to read.
// Same logic, same model behaviour, now behind the serverless functions.

const API_KEY = process.env.OPENAI_API_KEY
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses'

export function hasApiKey() {
  return Boolean(API_KEY && API_KEY.startsWith('sk-') && !API_KEY.includes('your-key'))
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }
}

export async function callOpenAI(messages, { json = false, schema = null } = {}) {
  // We deliberately do NOT send a custom `temperature`. The newest models only
  // accept the default (1) and 400 on any other value, while older ones accept
  // anything — so omitting it is the one setting that works across every model.
  // Grounding comes from the system prompt and the retrieved property data,
  // not from a low temperature.
  const body = { model: MODEL, messages }

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'extraction', strict: false, schema },
    }
  } else if (json) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// The Responses API is a separate endpoint because it is the only one that
// exposes the hosted web_search tool — that is what lets enrichment research a
// real address without us signing up for a second search vendor.
export async function callWithWebSearch(instructions, input, { model } = {}) {
  const res = await fetch(RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: model || MODEL,
      instructions,
      input,
      tools: [{ type: 'web_search' }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI web search ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()

  // output_text is the convenience field; fall back to walking the output array
  // in case the shape shifts or the model emits several message blocks.
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  const parts = []
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (typeof c.text === 'string') parts.push(c.text)
    }
  }
  return parts.join('\n')
}

// Models sometimes wrap JSON in prose or a fenced block even when told not to.
export function parseJsonLoose(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) {
      try {
        return JSON.parse(fenced[1])
      } catch {
        /* fall through */
      }
    }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        /* fall through */
      }
    }
    return null
  }
}
