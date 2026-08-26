// GET /api/onboard/replay — the recorded call the demo falls back to.
//
// Exposed on its own so the UI can offer "watch a recorded call" as a
// deliberate choice, not only as the consolation prize after a refusal.

import { getReplay } from '../_lib/replay.js'
import { methodGuard, fail } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return
  try {
    res.status(200).json({ replay: await getReplay() })
  } catch (err) {
    fail(res, err)
  }
}
