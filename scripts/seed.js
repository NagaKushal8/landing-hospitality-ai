// Loads the six demo properties into Supabase. Idempotent — upserts by id, so
// re-running restores the seed set without duplicating or clobbering the
// properties created through onboarding.
//
//   node scripts/seed.js

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Copy .env.example to .env.local and fill them in.')
  process.exit(1)
}

const homes = JSON.parse(readFileSync(new URL('../src/data/homes.json', import.meta.url), 'utf8'))
const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

// Everything in the seed file was hand-authored, so it all carries the same
// provenance. Onboarded properties get 'web' and 'voice' stamps instead.
const now = new Date().toISOString()
const rows = homes.map(({ id, ...data }) => ({
  id,
  data,
  meta: { fields: {}, seededAt: now },
  updated_at: now,
}))

const { error } = await supabase.from('properties').upsert(rows).select('id')
if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

const { count } = await supabase.from('properties').select('id', { count: 'exact', head: true })
console.log(`Seeded ${rows.length} properties. Table now holds ${count}.`)
