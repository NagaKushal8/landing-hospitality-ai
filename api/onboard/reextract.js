// POST /api/onboard/reextract — re-run extraction against a stored transcript.
//
// The reason our own extraction pass exists rather than Bland's built-in call
// analysis: the transcript is the expensive part, and this lets the prompt and
// the field registry be tuned against it for free, as many times as needed,
// without calling a property manager back.
//
// Unlike the post-call pass this overwrites, since the point is to correct
// what the first pass got wrong.

import { getCall, getHome, upsertHome, updateCall } from '../_lib/store.js'
import { extractFromTranscript } from '../_lib/extract.js'
import { applyFields } from '../_lib/apply.js'
import { voiceFields, fieldByKey, computeGaps } from '../../shared/field-registry.js'
import { methodGuard, fail } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { callId } = req.body || {}
  if (!callId) return res.status(400).json({ error: 'callId is required' })

  try {
    const record = await getCall(callId)
    if (!record) return res.status(404).json({ error: `No call ${callId}` })
    if (!record.transcript) return res.status(400).json({ error: 'That call has no stored transcript.' })

    const home = await getHome(record.property_id)
    if (!home) return res.status(404).json({ error: `No property ${record.property_id}` })

    // Re-reads every voice-answerable field, not just what is currently empty —
    // a correction pass has to be able to fix a value the first pass filled in.
    const targets = voiceFields().filter((f) => f.voiceTopic)
    const { fields, note } = await extractFromTranscript(record.transcript, targets)
    const { applied, skipped } = applyFields(home, fields, 'voice', { overwrite: true })
    const saved = await upsertHome(home)

    const detail = applied.map((key) => ({
      key,
      label: fieldByKey(key)?.label,
      section: fieldByKey(key)?.section,
      value: key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), saved),
      ...saved._meta.fields[key],
    }))

    await updateCall(callId, { extracted: { applied: detail, skipped, note } })

    res.status(200).json({
      extracted: { applied: detail, skipped, note },
      remainingGaps: computeGaps(saved).length,
      home: saved,
    })
  } catch (err) {
    fail(res, err)
  }
}
