# Landing — Property Concierge & Auto-Onboarding

Corporate housing runs on operational trivia. Every unit has its own door lock,
its own garage code, its own place where the remote lives. Across thousands of
homes that's hundreds of thousands of facts that no static handbook keeps current.

This app does two things:

**1. Answers guest questions** about one specific property, grounded strictly in
that property's record — never inventing a code, always deferring to the property
contact when the data doesn't cover the question.

**2. Collects the data in the first place**, which is the harder half:

```
Address ──▶ web enrichment ──▶ gap analysis ──▶ AI voice call to the
                                                property contact
                                                      │
        property record ◀── auto-publish ◀── LLM extraction
                │
                └──▶ concierge chat
```

Public facts (address, beds/baths, amenities, general parking) are researched
automatically. Whatever is left — the operational details only the property
manager knows — is gathered by an AI agent that places a real phone call and has
a natural conversation, then extracts the structured fields from the transcript.
The agent is briefed only on the fields still missing, so calls stay short and
never feel like a questionnaire.

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

## Setting up Bland (alternative to Vapi)

Bland is the second implemented provider, added because Vapi's own phone
numbers rejected every outbound call on an account with no payment method,
while Bland connected on the first attempt without one. The agent brief,
extraction, spend ceiling and replay are identical either way — only the vendor
that dials changes.

1. Sign up at [bland.ai](https://bland.ai) and copy the API key.
2. In `.env.local` (and your Vercel environment):

   ```
   VOICE_PROVIDER=bland
   BLAND_API_KEY=...
   ```

3. `npm run call:prompt <propertyId>` prints the exact brief for a property if
   you want to try it by hand in their dashboard first. Worth doing before
   wiring anything: it answers "does outbound actually work on this account"
   for the price of one call.

Differences the adapter absorbs, so nothing downstream has to care:

- Bland's `task` is the entire agent brief; there is no separate system message.
- It reports completion as `completed: true` / status `"completed"`, where the
  rest of this codebase speaks Vapi's `"ended"`.
- Cost comes back as `price` rather than `cost`.
- Its docs and examples disagree on whether the API key is sent bare or with a
  `Bearer` prefix, so the adapter tries bare and retries once on a 401.

Pricing is roughly a wash — Bland is ~$0.14/min all-in on the free plan plus
$0.015 per attempt (charged even when a call fails), against Vapi's $0.05/min
platform fee plus pass-through that lands around $0.11–0.15/min.

## Setting up Vapi

The voice agent is the only part that costs real money and the only part that
needs an account beyond OpenAI and Supabase. Roughly ten minutes:

1. **Sign up** at [vapi.ai](https://vapi.ai). New accounts get $10 in free
   credit, which is on the order of 150-200 minutes of calling — far more than
   this needs.

2. **Get the private API key.** Dashboard -> API Keys. There are two keys and
   they are not interchangeable: the **public** key is only valid for web calls
   (`/call/web`), while every other endpoint — including the `POST /call` this
   app uses — is privately scoped. Grab the **private** one, or you will get a
   401 that looks like a bad key rather than the wrong key. Put it in
   `VAPI_API_KEY`.

3. **Create a phone number.** Dashboard -> Phone Numbers -> Create Phone Number
   -> **Free Vapi Number**, then enter a three-digit US area code. Free numbers
   are US-only, and there is a cap on outbound calls per day — fine for a demo,
   not for volume. Copy the number's **UUID** (not the phone number itself) into
   `VAPI_PHONE_NUMBER_ID`.

4. **Test it.** Put your own mobile in the phone field on the Onboard page and
   play the property manager. Before dialing anything you can check exactly what
   the agent will be briefed on:

   ```bash
   curl -s -X POST localhost:5173/api/onboard/call      -H 'Content-Type: application/json'      -d '{"homeId":"AUS-4B","phoneNumber":"555-555-5555","preview":true}'
   ```

   That returns the gap list, the opening line, and the full system prompt
   without placing a call or spending anything.

Two things worth knowing before you demo this live:

- **A free Vapi number has no reputation**, so it may show up as an unknown
  number or get filtered. Have your phone in hand and expect to answer a number
  you do not recognise.
- **Free Vapi numbers have a daily outbound call limit** that a brand-new
  account can hit on its first call. The failure is explicit — *"Numbers Bought
  On Vapi Have A Daily Outbound Call Limit"* — and the app translates it into
  what to do. Two ways out, cheapest first:

  1. **Top up Vapi ($10 minimum).** No monthly fee, but pay-as-you-go requires a
     $10 minimum credit purchase. That is prepayment, not a fee: Vapi's
     per-minute platform charge draws from it whichever number you end up using,
     so it is not wasted even if you later import Twilio. Their docs say a
     payment method is required for additional free numbers, and an account
     rejected on its very first call is a payment gate rather than a spent
     allowance — strong evidence, though Vapi does not document it outright.
     **Do not buy the $99/mo Team plan**; it is a concurrency tier and changes
     nothing here.
  2. **Import a Twilio number.** $1.15/mo, definitively uncapped, and what the
     error itself recommends. Vapi Dashboard -> Phone Numbers -> Import, then put
     the imported number's id in `VAPI_PHONE_NUMBER_ID`. The catch: a Twilio
     *trial* account can only dial **verified** numbers (up to 5, each verified
     by a code sent to that number). Enough to call your own phone and record a
     good demo call; not enough to let a stranger open the link and have their
     own phone ring, which needs a paid Twilio account.

  `npm run vapi:check` reports which kind of number you are on — `provider: vapi`
  is the capped kind, `provider: twilio` is the imported one.
- **`VAPI_MAX_SECONDS` caps the call** at 8 minutes by default. Calls bill per
  minute, so that is the backstop against one that goes sideways with nobody
  watching.

No assistant needs to be configured in the Vapi dashboard. The agent is built
fresh on every call from the property's current gap list, which is what keeps it
from drifting out of sync with the field registry.

## Deploying

The repo is a Vite SPA plus Vercel serverless functions in `/api`, so Vercel
needs no configuration beyond the environment variables.

1. Import the repo at [vercel.com/new](https://vercel.com/new). Framework
   preset **Vite** is detected automatically.
2. Add the variables from `.env.example` under Settings → Environment Variables.
   None of them are `VITE_` prefixed, so none reach the browser.
3. Run `supabase/schema.sql` in the Supabase SQL editor, then `npm run seed`
   locally to load the six demo properties.

`vercel.json` gives the onboarding routes a 60s ceiling (web research is slow)
and registers a daily cron against `/api/health`, which keeps the free-tier
Supabase project from pausing after a week of inactivity — otherwise a link
sent today is dead when it gets opened next week.

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
