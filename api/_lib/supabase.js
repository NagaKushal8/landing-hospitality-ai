// Supabase client. Server-side only — the service-role key bypasses RLS and
// must never reach the browser, which is why nothing here is VITE_ prefixed.

import { createClient } from '@supabase/supabase-js'

// The dashboard's Data API page shows the REST endpoint
// (https://<ref>.supabase.co/rest/v1/) right next to the bare project URL, and
// copying the wrong one fails as "Invalid path specified in request URL" —
// which points nowhere near the actual cause. supabase-js appends /rest/v1
// itself, so strip it and any trailing slash rather than making someone debug
// a doubled path.
export function normalizeProjectUrl(raw) {
  if (!raw) return raw
  return String(raw).trim().replace(/\/+$/, '').replace(/\/(rest|auth|storage|realtime)\/v1$/, '')
}


// Not named URL: shadowing the global constructor is a trap waiting for
// whoever next needs `new URL()` in this file.
const PROJECT_URL = normalizeProjectUrl(process.env.SUPABASE_URL)

// Supabase replaced the legacy `service_role` JWT with `sb_secret_...` keys.
// Projects created after November 2025 have ONLY the new kind, so the new name
// is preferred — but the old one still works on older projects, and reading
// both means an existing .env keeps running untouched.
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export function isConfigured() {
  return Boolean(PROJECT_URL && KEY)
}

let client = null

export function supabase() {
  if (!isConfigured()) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)')
  }
  if (!client) {
    client = createClient(PROJECT_URL, KEY, { auth: { persistSession: false } })
  }
  return client
}
