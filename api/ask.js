import { getHome } from './_lib/store.js'
import { answerQuestion } from './_lib/concierge.js'
import { methodGuard, fail } from './_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { homeId, question, history = [] } = req.body || {}
  if (!homeId || !question) {
    return res.status(400).json({ error: 'homeId and question are required' })
  }

  try {
    const home = await getHome(homeId)
    if (!home) return res.status(404).json({ error: `No property ${homeId}` })
    res.status(200).json(await answerQuestion(home, question, history))
  } catch (err) {
    // The client keeps its own offline keyword matcher and will fall back to it
    // on a non-200, so a failure here degrades rather than dead-ends.
    fail(res, err)
  }
}
