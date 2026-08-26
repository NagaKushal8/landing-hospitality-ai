-- Run once in the Supabase SQL editor.
--
-- Records are stored as JSONB rather than 30-odd typed columns. The field
-- registry in shared/field-registry.js is the schema authority; keeping the
-- database shape-agnostic means adding a field is a one-line registry edit
-- with no migration. Property records are small and always fetched whole, so
-- there is nothing to gain from normalising them.

create table if not exists properties (
  id          text primary key,
  data        jsonb       not null,              -- the property record itself
  meta        jsonb       not null default '{}', -- per-field provenance
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists calls (
  id           text primary key,                 -- Vapi call id
  property_id  text references properties(id) on delete cascade,
  phone_number text,
  status       text        not null default 'queued',
  transcript   text,
  extracted    jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists calls_property_id_idx on calls (property_id);

-- Records hold door codes, lockbox combinations and Wi-Fi passwords. Only the
-- serverless functions touch these tables, using the secret key
-- (`sb_secret_...`, or a legacy service_role JWT), which bypasses RLS.
--
-- RLS is enabled with NO policies on purpose: the publishable/anon key — the
-- one that would be exposed if anything client-side ever reached for it — can
-- then read nothing at all.
alter table properties enable row level security;
alter table calls      enable row level security;
