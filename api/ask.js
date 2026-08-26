import { getHome } from './_lib/store.js'
import { answerQuestion } from './_lib/concierge.js'
import { checkAllowance, record, ESTIMATE } from './_lib/budget.js'
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

    const allowance = await checkAllowance('ask')
    if (!allowance.ok) {
      // 402 rather than 200: the client already falls back to its offline
      // keyword matcher on any non-2xx, which still answers from the real
      // record. Better a plainer answer than no answer.
      return res.status(402).json({ error: 'Demo answer budget spent — showing offline fallback.' })
    }

    const answer = await answerQuestion(home, question, history)
    await record('ask', ESTIMATE.ask, homeId)
    res.status(200).json(answer)
  } catch (err) {
    // The client keeps its own offline keyword matcher and will fall back to it
    // on a non-200, so a failure here degrades rather than dead-ends.
    fail(res, err)
  }
}
