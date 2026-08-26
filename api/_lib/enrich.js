// enrich.js — stage one of onboarding.
//
// Researches an address against public sources so the phone call that follows
// only has to cover what the internet cannot know. Uses OpenAI's hosted
// web_search tool rather than a separate search vendor, which keeps the whole
// pipeline on one key.
//
// The discipline here matches the concierge prompt: omitting a field is always
// better than guessing it. A wrong bedroom count is cosmetic, but a wrong
// address sends the voice agent asking a stranger about the wrong building.

import { webFields } from '../../shared/field-registry.js'
import { callWithWebSearch, parseJsonLoose } from './llm.js'

const INSTRUCTIONS = `You research furnished rental and apartment properties from public sources.

Given an address, search the web — apartment community sites, property management
listings, building websites, map data — and report only what you can actually find.

Hard rules:
- NEVER guess or infer. If a field is not stated on a real page you found, OMIT it entirely.
  An absent field is correct behaviour; a plausible-sounding invention is a failure.
- Do not report unit-specific details (door codes, Wi-Fi passwords, which drawer the garage
  remote is in). Those are never public and will be gathered by phone. Building-level and
  listing-level facts only.
- "confidence" is 0-1: use 0.8+ when a page states it plainly, 0.5 when you inferred it from
  related information on a real page, and omit the field rather than going below that.
- "citation" must be the URL of the page you actually read it on.

Return ONLY a JSON object, no prose, in exactly this shape:
{"fields": {"<field.key>": {"value": <value>, "confidence": <0-1>, "citation": "<url>"}},
 "notes": "<one sentence on what you could not find>"}`

function fieldMenu() {
  return webFields()
    .map((f) => `- ${f.key} (${f.type}): ${f.voiceTopic || f.label}`)
    .join('\n')
}

// Deterministic stand-in so the pipeline is demoable with no network and no
// spend, and so the UI can be developed without burning a call every reload.
function mockEnrich({ address, propertyName }) {
  const city = (address.split(',')[1] || 'Austin').trim()
  const c = (value, confidence, citation) => ({ value, confidence, citation })
  return {
    fields: {
      propertyName: c(propertyName || `${city} Residences`, 0.7, 'https://example.com/listing'),
      address: c(address, 0.95, 'https://example.com/listing'),
      market: c(city, 0.9, 'https://example.com/listing'),
      neighborhood: c(`Central ${city}`, 0.6, 'https://example.com/listing'),
      bedrooms: c(2, 0.8, 'https://example.com/listing'),
      bathrooms: c(2, 0.8, 'https://example.com/listing'),
      sqft: c(1050, 0.7, 'https://example.com/listing'),
      'parking.type': c('Gated garage, assigned resident spot', 0.7, 'https://example.com/amenities'),
      gym: c('Fitness center on the ground floor, resident access', 0.7, 'https://example.com/amenities'),
      'pool.access': c('Courtyard pool, resident key fob', 0.7, 'https://example.com/amenities'),
      pets: c('Pet friendly, breed restrictions apply', 0.6, 'https://example.com/amenities'),
      amenities: c(['pool', 'fitness center', 'package lockers', 'courtyard'], 0.7, 'https://example.com/amenities'),
    },
    notes: 'Mock enrichment — MOCK_ENRICH is set, no web search was performed.',
    mock: true,
  }
}

export async function enrichFromWeb({ address, propertyName }) {
  if (process.env.MOCK_ENRICH === '1') return mockEnrich({ address, propertyName })

  const input = `Address: ${address}
${propertyName ? `Property/building name (may be wrong or partial): ${propertyName}\n` : ''}
Research this property and fill in whichever of these fields you can verify:

${fieldMenu()}

Remember: omit anything you cannot find on a real page.`

  const raw = await callWithWebSearch(INSTRUCTIONS, input)
  const parsed = parseJsonLoose(raw)

  if (!parsed || typeof parsed.fields !== 'object' || parsed.fields === null) {
    throw new Error(`Enrichment returned no usable JSON. Model said: ${String(raw).slice(0, 200)}`)
  }

  // Citations live alongside each value in the schema; lift them out too so the
  // UI can link them without re-walking the field map.
  const citations = {}
  for (const [key, v] of Object.entries(parsed.fields)) {
    if (v && typeof v === 'object' && v.citation) citations[key] = v.citation
  }

  return { fields: parsed.fields, citations, notes: parsed.notes || '' }
}
