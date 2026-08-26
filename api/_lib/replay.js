// replay.js — what the demo shows when it cannot place a live call.
//
// The link is opened unattended, so "Vapi refused" or "the budget is spent"
// must not be where the demo ends. Instead it replays a call that already
// happened: the transcript and the extracted fields are real, and the UI plays
// them back with the timing of a live call.
//
// It is always labelled as a recording. Presenting a stored call as if the
// visitor's phone were ringing would be a lie, and an obvious one the moment
// their phone does not ring.

import { supabase, isConfigured } from './supabase.js'
import { SAMPLE_CALL } from './sample-call.js'

/**
 * The most recent real call that produced a transcript, or the bundled sample
 * if no real call has been made yet.
 */
export async function getReplay() {
  if (isConfigured()) {
    const { data, error } = await supabase()
      .from('calls')
      .select('id, transcript, extracted, created_at, property_id')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[replay] lookup failed, using sample:', error.message)
    } else if (data && data.transcript && data.transcript.trim().length > 80) {
      return {
        kind: 'recording',
        recordedAt: data.created_at,
        propertyId: data.property_id,
        transcript: data.transcript,
        applied: data.extracted?.applied || [],
      }
    }
  }

  return {
    kind: 'sample',
    recordedAt: null,
    propertyId: null,
    transcript: SAMPLE_CALL.transcript,
    applied: SAMPLE_CALL.applied,
  }
}
