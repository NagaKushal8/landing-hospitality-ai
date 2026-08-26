import { getHome } from './_lib/store.js'
import { generateSuggestedQuestions } from './_lib/concierge.js'
import { methodGuard, fail } from './_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return

  const { homeId } = req.body || {}
  if (!homeId) return res.status(400).json({ error: 'homeId is required' })

  try {
    const home = await getHome(homeId)
    if (!home) return res.status(404).json({ error: `No property ${homeId}` })
    res.status(200).json(await generateSuggestedQuestions(home))
  } catch (err) {
    fail(res, err)
  }
}
