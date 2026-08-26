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

const PINNED = process.env.DEMO_REPLAY_CALL_ID || ''

function shape(row) {
  return {
    kind: 'recording',
    recordedAt: row.created_at,
    propertyId: row.property_id,
    transcript: row.transcript,
    applied: row.extracted?.applied || [],
  }
}

const usable = (row) => row?.transcript && row.transcript.trim().length > 200

/**
 * The recording to show when a live call cannot be placed: the pinned call if
 * DEMO_REPLAY_CALL_ID is set, otherwise whichever real call captured the most,
 * falling back to the written sample if none exists yet.
 */
export async function getReplay() {
  if (isConfigured()) {
    // Pinning one call is the safe option for a link that is out in the world:
    // it cannot be displaced by whatever happens next.
    if (PINNED) {
      const { data, error } = await supabase()
        .from('calls')
        .select('id, transcript, extracted, created_at, property_id')
        .eq('id', PINNED)
        .maybeSingle()
      if (error) console.error('[replay] pinned call lookup failed:', error.message)
      else if (usable(data)) return shape(data)
      else console.error(`[replay] DEMO_REPLAY_CALL_ID=${PINNED} is not a usable recording`)
    }

    const { data, error } = await supabase()
      .from('calls')
      .select('id, transcript, extracted, created_at, property_id')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('[replay] lookup failed, using sample:', error.message)
    } else if (data?.length) {
      // NOT the most recent. A visitor who answers and hangs up after twenty
      // seconds produces a real transcript, and taking the newest would let
      // that replace a good recording for everyone who opens the link after
      // them. Rank by how much the call actually captured instead.
      const best = data
        .filter(usable)
        .sort(
          (a, b) =>
            (b.extracted?.applied?.length || 0) - (a.extracted?.applied?.length || 0) ||
            b.transcript.length - a.transcript.length
        )[0]
      if (best) return shape(best)
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
