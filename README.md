# Landing — Improving the check-in experience

A guest reaches a building at 11pm. Which door? Is there a code, a fob, a
lockbox? Where is the garage remote?

**Guest side.** The details *are* sent — in an email or a check-in document. At
the door that means scrolling a PDF for one code. There, but not usable.

**Company side.** About 25 facts per property, and every one differs — lock,
garage, building entry. Across thousands of units, collecting and updating that
is the real cost.

This prototype covers both ends:

```
Address ──▶ web enrichment ──▶ what's still missing ──▶ AI voice call to
                                                        the property contact
                                                              │
        property record ◀── auto-publish ◀── LLM extraction ◀─┘
                │
                └──▶ guest asks "where's the garage remote?"
```

Public facts (address, beds/baths, amenities, general parking) are researched
automatically. The rest — the check-in details only the property manager knows —
are gathered by an AI agent that places a real phone call and has a natural
conversation, then extracts the structured fields from the transcript. The agent
is briefed only on the fields still missing, so calls stay short and never feel
like a questionnaire.

## Stack

| | |
|---|---|
| Frontend | React 18 + Vite 5, hand-written CSS, no UI framework |
| Backend | Vercel serverless functions (`/api`) |
| Store | Supabase Postgres (JSONB records) |
| LLM | OpenAI — chat for answers/extraction, Responses API web search for enrichment |
| Voice | Vapi outbound calling |

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npx vercel dev               # serves the SPA and the /api functions together
```

The concierge degrades gracefully: with no key, or if the API is unreachable, it
falls back to a deterministic offline keyword matcher so the app always answers
with something grounded in the real record.

## Pages

- **Doors** — every property and its full operational spec, with per-field provenance
- **Help / Ask** — the property-scoped concierge chat
- **Onboard** — the enrichment → call → extraction pipeline

## A note on trust

Every field carries where it came from (`seed` / `web` / `voice`), a confidence
score, and — for anything captured by phone — the transcript line it came from.
Extracted values currently auto-publish with no human review step. That is a
deliberate demo tradeoff, not a recommendation: a misheard door code reaches a
guest with nothing in between. A review queue for `critical` fields is the first
thing to add before this touches a real guest.

## Setting up Supabase

The property store. Free tier, about five minutes.

1. **Create a project** at [supabase.com](https://supabase.com) (signing in with
   GitHub is quickest). Pick a region near your Vercel one. Provisioning takes a
   minute or two. The database password it asks you to set is not used by this
   app — it connects with an API key — but save it anyway.

2. **Create the tables.** SQL Editor -> New query -> paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) -> Run. It is idempotent, so
   re-running it is safe.

3. **Get the credentials.** Two different pages, and the menus have moved
   recently — if a path below does not match what you see, the fallback is noted.

   **Project URL** -> `SUPABASE_URL`
   - **Settings -> Data API**, field *Project URL*. On some accounts this lives
     under **Integrations -> Data API** instead.
   - If you cannot find it, read it off the address bar. Inside a project the URL
     is `supabase.com/dashboard/project/<ref>`, and your value is
     `https://<ref>.supabase.co`. That never changes with the UI.
   - **Take the bare project URL, not the REST endpoint.** That page shows
     `https://<ref>.supabase.co/rest/v1/` right beside it; supabase-js appends
     `/rest/v1` itself, so pasting that one produces a doubled path and the
     unhelpful error `Invalid path specified in request URL`. The code strips a
     trailing `/rest/v1` defensively, but it is worth knowing which is which.

   **Secret key** -> `SUPABASE_SECRET_KEY`
   - **Settings -> API Keys**, the **"Publishable and secret API keys"** tab,
     **Secret keys** section. Take the one starting `sb_secret_...`.
   - Secret keys are hidden until you click **Reveal** on the row. Each reveal is
     recorded in the org Audit Log — expected, not a warning.
   - If the section is empty, click **Create new API keys**.
   - Ignore the **Legacy API Keys** tab. On a project created after November 2025
     it is empty — that is where `anon` / `service_role` used to live. If you do
     have a legacy project, its `service_role` JWT (`eyJ...`) still works here.

   Take the **secret** key, not the publishable one. RLS is enabled with no
   policies, so a publishable key reads nothing and every request comes back
   empty rather than failing somewhere that points at the cause.

   This key bypasses RLS entirely. It is read only by the serverless functions,
   is never `VITE_` prefixed, and must never reach the browser.

4. **Load the demo properties.** With `.env.local` filled in:

   ```bash
   npm run seed
   ```

   Upserts the six seed homes by id, so it is safe to re-run and will not
   clobber anything created through onboarding.

5. **Check it took.** `curl localhost:5173/api/health` should report
   `"supabase":"configured"`, `readOnly:false`, and `properties:6`. Until then
   the app still runs — it serves the bundled seed data read-only — but
   onboarding returns a 503 rather than silently dropping writes.

**One thing that will bite you later:** free-tier projects pause after about a
week with no queries, and a paused project means the link you sent the co-founder
is dead when they open it. `vercel.json` registers a daily cron against
`/api/health` to keep it warm — that only runs once deployed, so if you leave the
project idle before then, wake it from the dashboard.

## Setting up Bland

Bland places the outbound calls. It was chosen after Vapi's own numbers
rejected every outbound attempt on an account with no payment method —
including the first call ever made, so there was no allowance to have spent —
while Bland connected immediately.

1. Sign up at [bland.ai](https://bland.ai), copy the API key.
2. Pick a voice from the Voice Library and copy its id.
3. In `.env.local` (and your Vercel environment):

   ```
   BLAND_API_KEY=...
   BLAND_VOICE=...
   ```

4. `npm run bland:check` — read-only, places no calls. Confirms the key works
   and lists what Bland has on record.

Before wiring anything to a new provider, `npm run call:prompt <propertyId>`
prints the exact brief for a property so you can paste it into a dashboard and
test by hand. Five minutes there answers "does outbound actually work on this
account", which is the question undocumented free-tier limits keep answering
wrong.

### What the integration uses

One API key in a header, one POST to place a call, one GET to read it back —
no SDK.

| Parameter | Why |
|---|---|
| `task` | the gap-driven agent brief, built per call |
| `first_sentence` | the opening line, naming the actual address |
| `wait_for_greeting` | lets the person say hello first; talking over the pickup is the most obviously-robotic thing a call can do |
| `interruption_threshold` | leans patient — contacts trail off mid-sentence and cutting in loses the answer |
| `max_duration` | cost backstop, `CALL_MAX_MINUTES` |
| `record` | so a call can be listened back to in the UI |
| `metadata` | our property id, to reconcile from Bland's side |

Results come back by **polling** `GET /v1/calls/{id}` rather than Bland's
webhook. Polling needs no public URL, so the flow works from a laptop with no
tunnel, and on serverless it avoids holding a function open for the length of a
phone call.

Two shape details the adapter absorbs so nothing downstream has to know them:
Bland's list endpoint omits transcripts entirely (only the detail endpoint
carries one), and it labels turns `assistant` / `user` where `user` is the
property contact — relabelled to `AI` / `Contact` so the extraction prompt is
not inferring who is who on every call.

Pricing is about $0.14/min all-in on the free plan, plus $0.015 per attempt
charged even when a call fails.

## Deploying

Import the repo at [vercel.com/new](https://vercel.com/new). Framework preset
**Vite** is detected; no build settings need changing.

Set these under Settings -> Environment Variables. None are `VITE_` prefixed,
so none reach the browser.

| Variable | |
|---|---|
| `OPENAI_API_KEY` | concierge answers, enrichment, extraction |
| `OPENAI_MODEL` | |
| `SUPABASE_URL` | bare project URL, not the REST endpoint |
| `SUPABASE_SECRET_KEY` | the `sb_secret_...` one |
| `BLAND_API_KEY` | outbound calls |
| `BLAND_VOICE` | voice id from Bland's library |
| `CALL_MAX_MINUTES` | per-call length cap |
| `DEMO_BUDGET_USD` | total spend ceiling; nothing bypasses it |
| `DEMO_DAILY_CALL_LIMIT` | calls per day before the PIN |
| `DEMO_PIN` | unlocks calls past the daily limit |
| `DEMO_CALL_ESTIMATE_USD` | reserved per call, reconciled after |
| `DEMO_REPLAY_CALL_ID` | the call replayed when one cannot be placed |
| `MOCK_ENRICH` | `0` in production |

`vercel.json` gives the onboarding routes a 60s ceiling because web research is
slow, and registers a daily cron against `/api/health` so the free-tier Supabase
project never pauses — without it a link sent today is dead when it is opened
next week.

After the first deploy, open `/api/health`. It should report every service
configured and `readOnly: false`. If Supabase is missing the app still serves
the bundled seed properties read-only, and onboarding refuses rather than
silently dropping writes.

### Costs

Vercel Hobby, Supabase free tier, and the concierge itself are effectively $0 —
OpenAI runs a few cents per enrichment and a fraction of a cent per answer.

Voice is the only real cost, and it is per-minute pass-through rather than a
single line item:

| Component | Per minute | Per 5-min call |
|---|---|---|
| Vapi platform fee | $0.050 | $0.25 |
| LLM (gpt-4o, in-call) | ~$0.030–0.050 | ~$0.15–0.25 |
| TTS (voice) | ~$0.010–0.030 | ~$0.05–0.15 |
| Telephony (Twilio, US) | $0.014 | $0.07 |
| STT (Deepgram) | ~$0.004 | ~$0.02 |
| **All-in** | **~$0.11–0.15** | **~$0.55–0.75** |

Plus $1.15/month for the Twilio number itself.

So a rehearsal plus a live demo is comfortably under $5, and Vapi's $10 signup
credit covers it. `VAPI_MODEL=gpt-4o-mini` is the biggest single lever if you
are iterating on the prompt across many calls.

Note that Vapi requires a $10 minimum credit purchase to enable outbound
calling beyond the free tier. It is prepaid usage rather than a subscription,
and `DEMO_BUDGET_USD` caps what the deployed link can actually spend of it.
