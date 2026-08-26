import { getHome } from '../_lib/store.js'
import { methodGuard, fail } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return
  try {
    const home = await getHome(req.query.id)
    if (!home) return res.status(404).json({ error: `No property ${req.query.id}` })
    res.status(200).json({ home })
  } catch (err) {
    fail(res, err)
  }
}
