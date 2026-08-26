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

Vercel Hobby and Supabase free tiers are $0. OpenAI runs a few cents per
enrichment. Vapi is the only meaningful cost at roughly $0.25–0.50 per
five-minute call.
