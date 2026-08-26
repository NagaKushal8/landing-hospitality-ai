// Shows what the demo has spent, and can correct or clear it.
//
//   node scripts/budget.js            report only
//   node scripts/budget.js --sync     true up call costs from Bland
//   node scripts/budget.js --reset    wipe the ledger
//
// Reset exists for one specific moment: before sending the link. Testing spend
// counts against the same ceiling the recipient will hit, so a few rehearsal
// calls can leave them with a budget that stops mid-demo. Clearing the ledger
// hands them the full amount. It does not refund anything — the money is spent
// either way, this only resets what the app thinks it has left.

import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const { supabase, isConfigured } = await import('../api/_lib/supabase.js')
const { BUDGET_USD, DAILY_CALL_LIMIT, ESTIMATE } = await import('../api/_lib/budget.js')

if (!isConfigured()) {
  console.error('Supabase is not configured, so there is no ledger to read.')
  process.exit(1)
}

// Bland does not populate `price` at the instant a call ends, so the automatic
// reconciliation in call-status usually sees null and leaves the up-front
// reservation in place. Nothing looks again afterwards, so a call sits at its
// estimate forever, holding budget it never actually spent.
if (process.argv.includes('--sync')) {
  const { fetchCall } = await import('../api/_lib/voice.js')
  const { data: calls, error: readErr } = await supabase()
    .from('usage')
    .select('id, ref, cost_usd, meta')
    .eq('kind', 'call')

  if (readErr) {
    console.error('Could not read call rows:', readErr.message)
    process.exit(1)
  }

  let freed = 0
  for (const row of calls) {
    if (row.meta?.reconciled || !row.ref) continue
    try {
      const { cost } = await fetchCall(row.ref)
      if (typeof cost !== 'number') {
        console.log(`  ${row.ref}: no price from Bland yet, left at $${row.cost_usd}`)
        continue
      }
      await supabase()
        .from('usage')
        .update({ cost_usd: cost, meta: { ...(row.meta || {}), reconciled: true } })
        .eq('id', row.id)
      freed += Number(row.cost_usd) - cost
      console.log(`  ${row.ref}: $${row.cost_usd} -> $${cost}`)
    } catch (err) {
      console.log(`  ${row.ref}: ${err.message.slice(0, 60)}`)
    }
  }
  console.log(`\n  Freed $${freed.toFixed(2)} that was reserved but never spent.`)
}

const { data, error } = await supabase()
  .from('usage')
  .select('kind, cost_usd, created_at')
  .order('created_at', { ascending: false })

if (error) {
  console.error('Could not read the ledger:', error.message)
  console.error('If the `usage` table does not exist yet, run supabase/schema.sql.')
  process.exit(1)
}

const spent = data.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
const byKind = {}
for (const r of data) {
  byKind[r.kind] = byKind[r.kind] || { n: 0, usd: 0 }
  byKind[r.kind].n += 1
  byKind[r.kind].usd += Number(r.cost_usd || 0)
}

const today = new Date()
today.setUTCHours(0, 0, 0, 0)
const callsToday = data.filter((r) => r.kind === 'call' && new Date(r.created_at) >= today).length

console.log('')
console.log(`  ceiling        $${BUDGET_USD.toFixed(2)}`)
console.log(`  spent          $${spent.toFixed(2)}  (${data.length} actions)`)
console.log(`  remaining      $${Math.max(0, BUDGET_USD - spent).toFixed(2)}`)
console.log('')
for (const [kind, v] of Object.entries(byKind)) {
  console.log(`    ${kind.padEnd(8)} ${String(v.n).padStart(3)} x  = $${v.usd.toFixed(2)}`)
}
console.log('')
console.log(`  calls today    ${callsToday} of ${DAILY_CALL_LIMIT} before the PIN is needed`)

const left = Math.max(0, BUDGET_USD - spent)
console.log(`  calls left     ~${Math.floor(left / ESTIMATE.call)} before the ceiling stops them`)
console.log('')

if (process.argv.includes('--reset')) {
  const { error: delErr } = await supabase().from('usage').delete().neq('id', 0)
  if (delErr) {
    console.error('Reset failed:', delErr.message)
    process.exit(1)
  }
  console.log(`  Ledger cleared. The full $${BUDGET_USD.toFixed(2)} is available again.`)
  console.log('')
} else if (spent > 0) {
  console.log('  Run with --reset to clear this before sending the demo link, so your')
  console.log('  testing does not eat into the recipient\'s budget.')
  console.log('')
}
