// store.js — every read and write of a property record goes through here.
//
// Falls back to the bundled seed file when Supabase is not configured. That
// keeps the app honest in three situations that all really happen: a fresh
// clone with no keys, a deploy that went up before the database was wired, and
// a free-tier project that has paused. In fallback the app is read-only —
// onboarding refuses rather than silently dropping a write.

import { readFileSync } from 'node:fs'
import { supabase, isConfigured } from './supabase.js'

let seedCache = null

function seed() {
  if (seedCache) return seedCache
  try {
    const url = new URL('../../src/data/homes.json', import.meta.url)
    seedCache = JSON.parse(readFileSync(url, 'utf8'))
  } catch (err) {
    // The read is not statically traceable, so it depends on vercel.json's
    // includeFiles having bundled the file. If that ever drifts, say so
    // plainly rather than surfacing an ENOENT stack to the UI.
    console.error('[store] seed file unavailable:', err.message)
    seedCache = []
  }
  return seedCache
}

export const readOnly = () => !isConfigured()

// A row is stored as { id, data, meta }. Callers want one flat object, with
// provenance hanging off `_meta` where it cannot collide with a real field.
function hydrate(row) {
  return { ...row.data, id: row.id, _meta: row.meta || {} }
}

export async function listHomes() {
  if (readOnly()) return seed().map((h) => ({ ...h, _meta: { fields: {} } }))

  const { data, error } = await supabase()
    .from('properties')
    .select('id, data, meta')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listHomes: ${error.message}`)
  return data.map(hydrate)
}

export async function getHome(id) {
  if (readOnly()) {
    const h = seed().find((x) => x.id === id)
    return h ? { ...h, _meta: { fields: {} } } : null
  }

  const { data, error } = await supabase()
    .from('properties')
    .select('id, data, meta')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getHome: ${error.message}`)
  return data ? hydrate(data) : null
}

export async function upsertHome(home) {
  if (readOnly()) throw new Error('Cannot write: Supabase is not configured')

  const { id, _meta, ...data } = home
  const { data: row, error } = await supabase()
    .from('properties')
    .upsert({ id, data, meta: _meta || {}, updated_at: new Date().toISOString() })
    .select('id, data, meta')
    .single()
  if (error) throw new Error(`upsertHome: ${error.message}`)
  return hydrate(row)
}

export async function createCall({ id, propertyId, phoneNumber, status = 'queued' }) {
  if (readOnly()) throw new Error('Cannot write: Supabase is not configured')

  const { error } = await supabase()
    .from('calls')
    .insert({ id, property_id: propertyId, phone_number: phoneNumber, status })
  if (error) throw new Error(`createCall: ${error.message}`)
}

export async function getCall(id) {
  if (readOnly()) return null

  const { data, error } = await supabase().from('calls').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getCall: ${error.message}`)
  return data
}

export async function updateCall(id, patch) {
  if (readOnly()) throw new Error('Cannot write: Supabase is not configured')

  const { error } = await supabase()
    .from('calls')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`updateCall: ${error.message}`)
}
