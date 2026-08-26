// GET /api/onboard/call-status?callId=...
//
// The client polls this while the phone is ringing. Once Vapi reports the call
// ended, this is also where the transcript gets extracted and written into the
// property — done here rather than in a webhook so the whole flow works from a
// laptop with no public URL.

import { getCall, updateCall, getHome, upsertHome } from '../_lib/store.js'
import { fetchCall } from '../_lib/voice.js'
import { extractFromTranscript } from '../_lib/extract.js'
import { applyFields } from '../_lib/apply.js'
import { computeGaps, fieldByKey } from '../../shared/field-registry.js'
import { reconcile } from '../_lib/budget.js'
import { methodGuard, fail } from '../_lib/http.js'

const TERMINAL = new Set(['ended', 'failed', 'busy', 'no-answer'])

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return

  const callId = req.query.callId
  if (!callId) return res.status(400).json({ error: 'callId is required' })

  try {
    const record = await getCall(callId)
    if (!record) return res.status(404).json({ error: `No call ${callId}` })

    // Already processed — return the stored result rather than re-extracting
    // (and re-billing) every time the client polls.
    if (record.extracted) {
      return res.status(200).json({
        status: record.status,
        done: true,
        transcript: record.transcript,
        extracted: record.extracted,
        home: await getHome(record.property_id),
      })
    }

    const live = await fetchCall(callId)
    const done = TERMINAL.has(live.status)

    if (!done) {
      if (live.status !== record.status) await updateCall(callId, { status: live.status })
      return res.status(200).json({ status: live.status, done: false, transcript: live.transcript || '' })
    }

    await updateCall(callId, { status: live.status, transcript: live.transcript })

    // Vapi reports what the call actually cost. Swap it in for the up-front
    // reservation so a short call does not keep holding a full one's budget.
    if (typeof live.raw?.cost === 'number') await reconcile(callId, live.raw.cost)

    const home = await getHome(record.property_id)
    if (!home) return res.status(404).json({ error: `No property ${record.property_id}` })

    // Extract against the gaps as they stand now, not as they stood at dial
    // time — if another call filled something in between, we do not want to
    // overwrite it with a weaker answer.
    const gaps = computeGaps(home)
    const { fields, note } = await extractFromTranscript(live.transcript, gaps)
    const { applied, skipped } = applyFields(home, fields, 'voice')
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
      status: live.status,
      endedReason: live.endedReason,
      done: true,
      transcript: live.transcript,
      extracted: { applied: detail, skipped, note },
      remainingGaps: computeGaps(saved).length,
      home: saved,
    })
  } catch (err) {
    fail(res, err)
  }
}
