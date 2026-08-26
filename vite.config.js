import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite only exposes VITE_-prefixed vars, and only to client code — the API
// handlers below are plain Node and read process.env, so nothing would reach
// them without this. Same precedence `vercel dev` uses: .env first, .env.local
// overriding it.
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

// In production Vercel turns every file under /api into a serverless function.
// This mounts the same handlers on the Vite dev server so `npm run dev:ui`
// gives a working app without needing the Vercel CLI to be installed and
// logged in. Same files, same signatures — nothing here ships.
function apiDevServer() {
  const routes = []

  function scan(dir, base = '/api') {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name.startsWith('_')) continue // shared modules, not routes
        scan(full, `${base}/${name}`)
      } else if (name.endsWith('.js')) {
        const bare = name.replace(/\.js$/, '')
        const path = bare === 'index' ? base : `${base}/${bare}`
        routes.push({ path, file: full, param: path.match(/\[(\w+)\]/)?.[1] || null })
      }
    }
  }

  return {
    name: 'api-dev-server',
    configureServer(server) {
      scan(join(server.config.root, 'api'))

      // Say plainly which services are live, so "why is it in offline mode"
      // is answered at startup rather than by reading response payloads.
      const has = (k) => (process.env[k] ? 'yes' : 'NO')
      server.config.logger.info(
        `  api  openai:${has('OPENAI_API_KEY')} ` +
          `supabase:${process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'yes' : 'NO'} ` +
          `vapi:${has('VAPI_API_KEY')}`
      )

      // Static routes must win over /api/homes/[id], so match them first.
      routes.sort((a, b) => Number(Boolean(a.param)) - Number(Boolean(b.param)))

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, 'http://localhost')
        const query = Object.fromEntries(url.searchParams)

        let match = null
        for (const r of routes) {
          if (r.param) {
            const prefix = r.path.slice(0, r.path.indexOf('['))
            if (url.pathname.startsWith(prefix) && url.pathname.length > prefix.length) {
              query[r.param] = decodeURIComponent(url.pathname.slice(prefix.length))
              match = r
              break
            }
          } else if (url.pathname === r.path) {
            match = r
            break
          }
        }
        if (!match) return next()

        let body = {}
        if (req.method === 'POST') {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          try {
            body = raw ? JSON.parse(raw) : {}
          } catch {
            body = {}
          }
        }

        // Bust the module cache so editing a handler takes effect on reload.
        const mod = await import(`${pathToFileURL(match.file).href}?t=${Date.now()}`)
        const shim = {
          statusCode: 200,
          setHeader: (k, v) => res.setHeader(k, v),
          status(code) {
            this.statusCode = code
            return this
          },
          json(payload) {
            res.statusCode = this.statusCode
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          },
        }

        try {
          await mod.default({ method: req.method, query, body, url: req.url }, shim)
        } catch (err) {
          console.error(`[api-dev] ${relative(server.config.root, match.file)}:`, err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: { port: 5173, open: true },
})
