import { listHomes } from '../_lib/store.js'
import { methodGuard, fail } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'GET')) return
  try {
    res.status(200).json({ homes: await listHomes() })
  } catch (err) {
    fail(res, err)
  }
}
