// apply.js — the one place a discovered value becomes part of a record.
//
// Both stages write through here: web enrichment and call extraction. Every
// write is stamped with where it came from, how sure the model was, and the
// evidence behind it (a source URL for the web, a transcript line for a call).
//
// Values auto-publish — there is no review step between extraction and a guest
// reading the answer. That is a deliberate demo tradeoff and a real risk for
// `critical` fields: a misheard door code strands someone at midnight. The
// provenance recorded here is what a review queue would be built on.

import { fieldByKey, setByPath, isEmpty } from '../../shared/field-registry.js'

const MIN_CONFIDENCE = 0.35

function coerce(field, value) {
  if (field.type === 'number') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    // Strip units ("1,200 sq ft") but reject anything with no digits at all —
    // otherwise Number('') is 0 and a garbled answer becomes a confident zero.
    const digits = String(value).replace(/[^0-9.]/g, '')
    if (!/[0-9]/.test(digits)) return null
    const n = Number(digits)
    return Number.isFinite(n) ? n : null
  }
  if (field.type === 'string[]') {
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean)
    return null
  }
  const s = String(value).trim()
  return s || null
}

/**
 * @param home      the property record (mutated and returned)
 * @param extracted { 'wifi.password': { value, confidence, evidence } }
 * @param source    'web' | 'voice' | 'manual'
 * @param opts.overwrite  replace values that are already present
 * @returns { applied: string[], skipped: [{key, reason}] }
 */
export function applyFields(home, extracted, source, { overwrite = false } = {}) {
  if (!home._meta) home._meta = {}
  if (!home._meta.fields) home._meta.fields = {}

  const applied = []
  const skipped = []
  const capturedAt = new Date().toISOString()

  for (const [key, raw] of Object.entries(extracted || {})) {
    const field = fieldByKey(key)
    if (!field) {
      skipped.push({ key, reason: 'not a known field' })
      continue
    }

    // Accept either the wrapped shape or a bare value, since models drop the
    // wrapper often enough that rejecting it would lose real answers.
    const payload = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw ? raw : { value: raw }
    const { value, confidence = 0.5, evidence = null, citation = null } = payload

    if (value === null || value === undefined || value === '') {
      skipped.push({ key, reason: 'no value' })
      continue
    }
    if (confidence < MIN_CONFIDENCE) {
      skipped.push({ key, reason: `confidence ${confidence} below ${MIN_CONFIDENCE}` })
      continue
    }

    const coerced = coerce(field, value)
    if (coerced === null) {
      skipped.push({ key, reason: `could not coerce to ${field.type}` })
      continue
    }

    // A later call should not quietly undo something a human already entered,
    // unless the caller says so.
    const existing = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), home)
    if (!overwrite && !isEmpty(existing)) {
      skipped.push({ key, reason: 'already set' })
      continue
    }

    setByPath(home, key, coerced)
    home._meta.fields[key] = {
      source,
      confidence,
      capturedAt,
      ...(evidence ? { evidence } : {}),
      ...(citation ? { citation } : {}),
      ...(field.critical ? { critical: true } : {}),
    }
    applied.push(key)
  }

  return { applied, skipped }
}
