// budget.js — spend control for an unattended demo link.
//
// The link is emailed and opened days later by someone with no context, and it
// may get forwarded. Two independent limits, because they protect against
// different things:
//
//   - a DAILY call count, which gates casual repetition behind a PIN
//   - a TOTAL spend ceiling, which nothing bypasses, including the PIN
//
// The ceiling is absolute on purpose. A PIN that also lifted the spend cap
// would mean a forwarded PIN is an unbounded charge, and the whole point is
// that the worst case is knowable in advance.

import { supabase, isConfigured } from './supabase.js'

export const BUDGET_USD = Number(process.env.DEMO_BUDGET_USD || 5)
export const DAILY_CALL_LIMIT = Number(process.env.DEMO_DAILY_CALL_LIMIT || 5)
const PIN = process.env.DEMO_PIN || ''

// Conservative estimates, charged up front and reconciled against the real
// figure when a call ends. Over-reserving briefly is fine; under-reserving
// means the ceiling can be crossed before anyone notices.
export const ESTIMATE = {
  call: Number(process.env.DEMO_CALL_ESTIMATE_USD || 0.75),
  enrich: 0.04,
  ask: 0.002,
}

export function pinConfigured() {
  return PIN.length > 0
}

export function pinMatches(given) {
  if (!PIN) return false
  return String(given || '').trim() === PIN
}

export async function spentTotal() {
  if (!isConfigured()) return null
  const { data, error } = await supabase().from('usage').select('cost_usd')
  if (error) {
    // Usually the table has not been created yet. Returning null rather than
    // throwing lets the caller decide per-action, which matters: dying here
    // would take the whole demo down over a bookkeeping problem.
    console.error('[budget] cannot read ledger:', error.message)
    return null
  }
  return data.reduce((sum, r) => sum + Number(r.cost_usd || 0), 0)
}

export async function countToday(kind) {
  if (!isConfigured()) return null
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count, error } = await supabase()
    .from('usage')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .gte('created_at', since.toISOString())
  if (error) {
    console.error('[budget] cannot count today:', error.message)
    return null
  }
  return count || 0
}

export async function record(kind, costUsd, ref = null, meta = {}) {
  if (!isConfigured()) return
  const { error } = await supabase()
    .from('usage')
    .insert({ kind, cost_usd: Number(costUsd || 0), ref, meta })
  if (error) console.error('[budget] failed to record usage:', error.message)
}

// Replaces the up-front reservation for a call with what it actually cost.
export async function reconcile(ref, actualUsd) {
  if (!isConfigured() || !Number.isFinite(actualUsd)) return
  const { error } = await supabase()
    .from('usage')
    .update({ cost_usd: actualUsd, meta: { reconciled: true } })
    .eq('ref', ref)
    .eq('kind', 'call')
  if (error) console.error('[budget] failed to reconcile:', error.message)
}

/**
 * Decide whether one billable action may run.
 *
 * @returns {ok:true} | {ok:false, reason:'budget'|'pin', ...}
 */
export async function checkAllowance(kind, { pin } = {}) {
  const estimate = ESTIMATE[kind] ?? 0
  const spent = await spentTotal()

  // The ledger is unreadable. Split the decision by what the action costs:
  // block the expensive one, since it falls back to a recording and the demo
  // survives; allow the cheap ones, since blocking them would break the demo
  // to save fractions of a cent.
  if (spent === null) {
    if (kind === 'call') {
      return { ok: false, reason: 'budget', spent: null, budget: BUDGET_USD, ledgerUnavailable: true }
    }
    return { ok: true, spent: null, budget: BUDGET_USD, ledgerUnavailable: true }
  }

  if (spent + estimate > BUDGET_USD) {
    return { ok: false, reason: 'budget', spent: Number(spent.toFixed(2)), budget: BUDGET_USD }
  }

  if (kind === 'call') {
    const today = await countToday('call')
    // Same reasoning: if the count is unavailable, require the PIN rather than
    // waving calls through.
    if ((today === null || today >= DAILY_CALL_LIMIT) && !pinMatches(pin)) {
      return {
        ok: false,
        reason: 'pin',
        today: today ?? DAILY_CALL_LIMIT,
        limit: DAILY_CALL_LIMIT,
        // Without a PIN configured there is nothing to unlock, so say so rather
        // than asking for something that cannot exist.
        pinConfigured: pinConfigured(),
      }
    }
  }

  return { ok: true, spent: Number(spent.toFixed(2)), budget: BUDGET_USD }
}
