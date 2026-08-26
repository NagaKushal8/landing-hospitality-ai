// Prints the exact brief the app would send for one property, so it can be
// pasted into a provider's dashboard and tested by hand before any integration
// work happens.
//
//   node scripts/call-prompt.js VEN-101

import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const { getHome, listHomes } = await import('../api/_lib/store.js')
const { buildSystemPrompt, buildFirstMessage } = await import('../api/_lib/voice.js')
const { computeGaps } = await import('../shared/field-registry.js')

const id = process.argv[2]
if (!id) {
  const homes = await listHomes()
  console.error('Usage: node scripts/call-prompt.js <propertyId>\n\nProperties with gaps:')
  for (const h of homes) {
    const n = computeGaps(h).length
    if (n) console.error(`  ${h.id.padEnd(10)} ${String(n).padStart(2)} gaps  ${h.propertyName || ''}`)
  }
  process.exit(1)
}

const home = await getHome(id)
if (!home) {
  console.error(`No property ${id}`)
  process.exit(1)
}
const gaps = computeGaps(home)

const rule = (t) => `\n${'-'.repeat(78)}\n${t}\n${'-'.repeat(78)}`

console.log(`${'='.repeat(78)}\nCALL BRIEF — ${home.propertyName || home.id}\n${'='.repeat(78)}`)
console.log(`\nAddress: ${home.address || '(none)'}`)
console.log(`Gaps: ${gaps.length} (${gaps.filter((g) => g.critical).length} critical)`)
console.log(rule('OPENING LINE  (Bland: first_sentence)'))
console.log(buildFirstMessage(home))
console.log(rule('AGENT BRIEF  (Bland: task)'))
console.log(buildSystemPrompt(home, gaps))
console.log(rule('SETTINGS'))
console.log('max_duration : 6 minutes — keeps a test cheap')
console.log('record       : true — so you can listen back')
console.log('')
