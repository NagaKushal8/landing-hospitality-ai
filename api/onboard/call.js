// POST /api/onboard/call — dial the property contact about one property.
//
// This runs on a link that gets emailed and opened unattended, so it is gated
// twice before it spends anything: a hard total ceiling that nothing bypasses,
// and a daily count that falls back to a PIN. When either blocks, or when the
// provider itself refuses, the response carries a replay instead of an error —
// the demo degrades to a recording rather than a red box.

import { getHome, createCall, readOnly } from '../_lib/store.js'
import { startCall, isConfigured, buildSystemPrompt, buildFirstMessage } from '../_lib/voice.js'
import { checkAllowance, record, ESTIMATE } from '../_lib/budget.js'
import { getReplay } from '../_lib/replay.js'
import { computeGaps } from '../../shared/field-registry.js'
import { methodGuard, fail } from '../_lib/http.js'

// E.164 is what Bland expects. Accept what a person would actually type and
// normalise it, rather than bouncing them for punctuation.
function normalizePhone(input) {
  const raw = String(input || '').trim()
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return /^\+\d{8,15}$/.test(digits) ? digits : null
  const d = digits.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

const slim = (g) => ({
  key: g.key,
  label: g.label,
  section: g.section,
  critical: Boolean(g.critical),
  voiceTopic: g.voiceTopic,
})

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { homeId, phoneNumber, preview, pin } = req.body || {}
  if (!homeId) return res.status(400).json({ error: 'homeId is required' })

  try {
    const home = await getHome(homeId)
    if (!home) return res.status(404).json({ error: `No property ${homeId}` })
    const gaps = computeGaps(home)

    // Shows exactly what the agent will be briefed on without spending anything.
    if (preview) {
      return res.status(200).json({
        preview: true,
        number: normalizePhone(phoneNumber) || null,
        gaps: gaps.map(slim),
        firstMessage: buildFirstMessage(home),
        systemPrompt: buildSystemPrompt(home, gaps),
      })
    }

    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' })
    const number = normalizePhone(phoneNumber)
    if (!number) {
      return res.status(400).json({
        error: `"${phoneNumber}" is not a phone number we can dial. Use 10 digits, or +country code.`,
      })
    }

    // --- gates ---------------------------------------------------------------
    const allowance = await checkAllowance('call', { pin })

    if (!allowance.ok && allowance.reason === 'pin') {
      // Not an error: the caller is expected to ask for a PIN and retry.
      return res.status(200).json({
        needsPin: true,
        today: allowance.today,
        limit: allowance.limit,
        pinConfigured: allowance.pinConfigured,
        wrongPin: Boolean(pin),
        replay: await getReplay(),
      })
    }

    const voiceReady = isConfigured()
    const blocked =
      !allowance.ok ? { why: 'budget', detail: allowance }
      : !voiceReady ? { why: 'voice-unconfigured', detail: null }
      : readOnly() ? { why: 'store-unconfigured', detail: null }
      : null

    if (blocked) {
      return res.status(200).json({
        fallback: blocked.why,
        spent: allowance.spent,
        budget: allowance.budget,
        gaps: gaps.map(slim),
        replay: await getReplay(),
      })
    }

    // --- dial ----------------------------------------------------------------
    try {
      const { callId, status } = await startCall({ home, phoneNumber: number })
      await createCall({ id: callId, propertyId: homeId, phoneNumber: number, status })
      // Reserved up front and reconciled against the real figure when the call
      // ends. Reserving late would let concurrent clicks both pass the ceiling.
      await record('call', ESTIMATE.call, callId, { propertyId: homeId })

      return res.status(200).json({ callId, status, number, gaps: gaps.map(slim) })
    } catch (err) {
      // The provider refused — no credit, a bad number, a rejected key. The
      // demo still has something to show.
      console.error('[call] provider refused:', err.message)
      return res.status(200).json({
        fallback: 'call-refused',
        reason: err.message,
        gaps: gaps.map(slim),
        replay: await getReplay(),
      })
    }
  } catch (err) {
    fail(res, err)
  }
}
