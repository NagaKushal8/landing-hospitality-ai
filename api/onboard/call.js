// POST /api/onboard/call — dial the property contact about one property.

import { getHome, createCall, readOnly } from '../_lib/store.js'
import { startCall, isConfigured, buildSystemPrompt, buildFirstMessage } from '../_lib/voice.js'
import { computeGaps } from '../../shared/field-registry.js'
import { methodGuard, fail } from '../_lib/http.js'

// E.164 is what Vapi expects. Accept what a person would actually type and
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

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { homeId, phoneNumber, preview } = req.body || {}
  if (!homeId || !phoneNumber) {
    return res.status(400).json({ error: 'homeId and phoneNumber are required' })
  }

  const number = normalizePhone(phoneNumber)
  if (!number) {
    return res.status(400).json({ error: `"${phoneNumber}" is not a phone number we can dial. Use 10 digits, or +country code.` })
  }

  try {
    const home = await getHome(homeId)
    if (!home) return res.status(404).json({ error: `No property ${homeId}` })

    const gaps = computeGaps(home)

    // Lets the UI show exactly what the agent will be briefed on before anyone
    // spends money dialing a real person.
    if (preview) {
      return res.status(200).json({
        preview: true,
        number,
        gaps: gaps.map((g) => ({ key: g.key, label: g.label, section: g.section, critical: Boolean(g.critical), voiceTopic: g.voiceTopic })),
        firstMessage: buildFirstMessage(home),
        systemPrompt: buildSystemPrompt(home, gaps),
      })
    }

    if (!isConfigured()) {
      return res.status(503).json({ error: 'Vapi is not configured (VAPI_API_KEY / VAPI_PHONE_NUMBER_ID).' })
    }
    if (readOnly()) {
      return res.status(503).json({ error: 'Supabase is not configured, so call results could not be saved.' })
    }

    const { callId, status } = await startCall({ home, phoneNumber: number })
    await createCall({ id: callId, propertyId: homeId, phoneNumber: number, status })

    res.status(200).json({
      callId,
      status,
      number,
      gaps: gaps.map((g) => ({ key: g.key, label: g.label, section: g.section, critical: Boolean(g.critical) })),
    })
  } catch (err) {
    fail(res, err)
  }
}
