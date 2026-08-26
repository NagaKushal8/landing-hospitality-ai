// extract.js — transcript in, structured fields out.
//
// This runs as our own pass rather than Vapi's built-in call analysis, for one
// practical reason: the schema comes from our field registry, so changing a
// field is a registry edit rather than a dashboard edit, and we can re-run
// extraction against a stored transcript without calling anyone back. That
// makes prompt tuning free after the first call.

import { jsonSchemaFor } from '../../shared/field-registry.js'
import { callOpenAI, parseJsonLoose } from './llm.js'

const SYSTEM = `You read a transcript of a phone call in which an AI assistant asked a property
manager about a rental unit, and you pull out the facts that were actually stated.

Hard rules:
- Extract ONLY what the person on the call actually said. If a topic never came up, or they
  said they did not know, OMIT that field entirely. Never fill a gap with something plausible.
- The AI side of the call may have guessed, rephrased, or suggested an answer. Only trust what
  the HUMAN confirmed. If the AI proposed a value and the human did not confirm it, omit it.
- Normalize spoken numbers into the form a guest would type: "eight eight four two" -> "8842",
  "one one nine five" -> "1195". Keep letters and symbols as spoken for alphanumeric codes.
- If a value was read back and confirmed on the call, use confidence 0.9-1.0.
  If it was said once and clearly, 0.7-0.85. If the person hedged ("I think", "probably",
  "usually"), 0.4-0.6 — and reflect the hedge in the value where it matters.
- "evidence" must be a short VERBATIM quote from the transcript showing where the value came
  from. Do not paraphrase it.
- Write values the way a front desk would tell a guest: complete and specific, not a fragment.
  "Keypad by the glass front door on 6th, code 8842" beats "keypad".

Return ONLY a JSON object of the form:
{"fields": {"<field.key>": {"value": <value>, "confidence": <0-1>, "evidence": "<quote>"}}}`

/**
 * @param transcript  the call transcript
 * @param gapFields   registry entries the call was briefed on
 */
export async function extractFromTranscript(transcript, gapFields) {
  if (!transcript || transcript.trim().length < 40) {
    return { fields: {}, note: 'Transcript too short to extract anything from.' }
  }
  if (!gapFields.length) return { fields: {}, note: 'No target fields.' }

  const menu = gapFields.map((f) => `- ${f.key} (${f.type}): ${f.voiceTopic}`).join('\n')

  const content = await callOpenAI(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Pull out whichever of these were actually stated on the call:\n\n${menu}\n\n--- TRANSCRIPT ---\n${transcript}\n--- END TRANSCRIPT ---`,
      },
    ],
    { schema: { type: 'object', properties: { fields: jsonSchemaFor(gapFields) }, required: ['fields'] } }
  )

  const parsed = parseJsonLoose(content)
  if (!parsed) throw new Error(`Extraction returned no usable JSON: ${String(content).slice(0, 200)}`)

  // Tolerate the model returning the field map at the top level.
  const fields = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed
  return { fields, note: '' }
}
