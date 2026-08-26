// Supabase client. Server-side only — the service-role key bypasses RLS and
// must never reach the browser, which is why nothing here is VITE_ prefixed.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL

// Supabase replaced the legacy `service_role` JWT with `sb_secret_...` keys.
// Projects created after November 2025 have ONLY the new kind, so the new name
// is preferred — but the old one still works on older projects, and reading
// both means an existing .env keeps running untouched.
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export function isConfigured() {
  return Boolean(URL && KEY)
}

let client = null

export function supabase() {
  if (!isConfigured()) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)')
  }
  if (!client) {
    client = createClient(URL, KEY, { auth: { persistSession: false } })
  }
  return client
}
