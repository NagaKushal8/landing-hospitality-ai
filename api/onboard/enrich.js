// POST /api/onboard/enrich
//
// Stage one: turn an address into as much of a property record as public
// sources can support, then report what is still missing so the call agent can
// be briefed on exactly that and nothing else.

import { listHomes, upsertHome, readOnly } from '../_lib/store.js'
import { enrichFromWeb } from '../_lib/enrich.js'
import { applyFields } from '../_lib/apply.js'
import { checkAllowance, record, ESTIMATE } from '../_lib/budget.js'
import { computeGaps } from '../../shared/field-registry.js'
import { methodGuard, fail } from '../_lib/http.js'

function marketCode(address) {
  const city = (address.split(',')[1] || address).trim()
  const letters = city.replace(/[^A-Za-z]/g, '').toUpperCase()
  return letters.slice(0, 3) || 'PRP'
}

// Ids read as MARKET-DOOR to match the existing seed set (AUS-4B, DAL-7A).
function makeId(address, doorNumber, taken) {
  const base = `${marketCode(address)}-${(doorNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'NEW'}`
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { address, propertyName, doorNumber, ownerName, ownerPhone } = req.body || {}
  if (!address || !address.trim()) {
    return res.status(400).json({ error: 'address is required' })
  }
  if (readOnly()) {
    return res.status(503).json({
      error: 'Supabase is not configured, so new properties cannot be saved. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
    })
  }

  try {
    const allowance = await checkAllowance('enrich')
    if (!allowance.ok) {
      return res.status(200).json({
        fallback: 'budget',
        spent: allowance.spent,
        budget: allowance.budget,
        error:
          'The research budget for this demo has been spent. Browse the existing properties on the Doors page — ' +
          'they show the same data this step produces.',
      })
    }

    const existing = await listHomes()
    const id = makeId(address, doorNumber, new Set(existing.map((h) => h.id)))

    // Operator-supplied values are seeded first and marked 'manual' so
    // enrichment cannot overwrite something a human typed.
    const home = { id, _meta: { fields: {} } }
    const manual = {}
    if (doorNumber) manual.doorNumber = { value: doorNumber, confidence: 1 }
    if (propertyName) manual.propertyName = { value: propertyName, confidence: 1 }
    if (ownerName) manual['ownerContact.name'] = { value: ownerName, confidence: 1 }
    if (ownerPhone) manual['ownerContact.phone'] = { value: ownerPhone, confidence: 1 }
    manual.address = { value: address, confidence: 1 }
    applyFields(home, manual, 'manual')

    const enrichment = await enrichFromWeb({ address, propertyName })
    const { applied, skipped } = applyFields(home, enrichment.fields, 'web')

    const saved = await upsertHome(home)
    await record('enrich', ESTIMATE.enrich, saved.id, { address })

    res.status(200).json({
      home: saved,
      applied,
      skipped,
      citations: enrichment.citations,
      notes: enrichment.notes,
      mock: Boolean(enrichment.mock),
      gaps: computeGaps(saved).map((f) => ({
        key: f.key,
        label: f.label,
        section: f.section,
        critical: Boolean(f.critical),
        voiceTopic: f.voiceTopic,
      })),
    })
  } catch (err) {
    fail(res, err)
  }
}
