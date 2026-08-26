// Lists the calls THIS APP has stored, which is the set DEMO_REPLAY_CALL_ID is
// resolved against — not the provider's call log. A call placed from a vendor
// dashboard never appears here, so pinning its id would silently fall back to
// the written sample.
//
//   node scripts/calls-list.js

import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const { supabase, isConfigured } = await import('../api/_lib/supabase.js')
const { getReplay } = await import('../api/_lib/replay.js')

if (!isConfigured()) {
  console.error('Supabase is not configured, so no calls are stored.')
  process.exit(1)
}

const { data, error } = await supabase()
  .from('calls')
  .select('id, property_id, status, transcript, extracted, created_at')
  .order('created_at', { ascending: false })
  .limit(20)

if (error) {
  console.error('Could not read calls:', error.message)
  process.exit(1)
}

if (!data.length) {
  console.log('\nNo calls stored yet.')
  console.log('Place one from the Onboard page — that path stores the call, runs')
  console.log('extraction, and writes the captured fields into the property.\n')
} else {
  console.log(`\n${data.length} stored call(s), newest first:\n`)
  for (const c of data) {
    const captured = c.extracted?.applied?.length ?? 0
    const chars = c.transcript?.length ?? 0
    console.log(`  ${c.id}`)
    console.log(`    property   ${c.property_id}`)
    console.log(`    status     ${c.status}`)
    console.log(`    created    ${c.created_at}`)
    console.log(`    transcript ${chars ? `${chars} chars` : '(none)'}`)
    console.log(`    captured   ${captured} field(s)`)
    console.log('')
  }

  // Same ranking getReplay uses, so this recommends what it would pick anyway.
  const best = data
    .filter((c) => (c.transcript?.trim().length ?? 0) > 200)
    .sort(
      (a, b) =>
        (b.extracted?.applied?.length || 0) - (a.extracted?.applied?.length || 0) ||
        b.transcript.length - a.transcript.length
    )[0]

  if (best) {
    console.log('  Best candidate for the pinned demo recording:')
    console.log(`\n    DEMO_REPLAY_CALL_ID=${best.id}\n`)
    console.log('  Add it to .env.local and your Vercel environment variables.')
    console.log('  Without it the app picks this same call automatically, but pinning')
    console.log('  stops a visitor\'s short or abandoned call from displacing it.\n')
  } else {
    console.log('  None of these is long enough to serve as the demo recording.')
    console.log('  Place a full-length call through the Onboard page.\n')
  }
}

const replay = await getReplay()
console.log(`Currently serving: ${replay.kind === 'sample' ? 'the written SAMPLE' : `a real recording (${replay.applied.length} fields)`}`)
console.log('')
