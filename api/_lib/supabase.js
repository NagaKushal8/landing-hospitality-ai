// Supabase client. Server-side only — the service-role key bypasses RLS and
// must never reach the browser, which is why nothing here is VITE_ prefixed.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function isConfigured() {
  return Boolean(URL && KEY)
}

let client = null

export function supabase() {
  if (!isConfigured()) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  if (!client) {
    client = createClient(URL, KEY, { auth: { persistSession: false } })
  }
  return client
}
