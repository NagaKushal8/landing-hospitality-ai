// Shared field rendering. Lifted out of DoorList so the onboarding screen shows
// values exactly the way the property card does — a field that just arrived by
// phone should look like the ones that were there all along.

import { FIELDS, getByPath, isEmpty, ABSENT_TEXT } from '../shared/field-registry.js'

export function codeChip(val) {
  if (!val) return null
  return <span className="code-chip">{val}</span>
}

const SOURCE_LABEL = { web: 'web', voice: 'call', manual: 'typed', seed: 'seed' }

// Where a value came from matters more here than in most apps: "we found this
// on the building's website" and "a person said this on the phone and nobody
// checked it" are very different claims to be making to a guest at a locked door.
export function SourcePill({ meta }) {
  if (!meta?.source) return null
  const pct = typeof meta.confidence === 'number' ? ` · ${Math.round(meta.confidence * 100)}%` : ''
  const title = [
    `Source: ${SOURCE_LABEL[meta.source] || meta.source}${pct}`,
    meta.evidence ? `Heard on the call: ${meta.evidence}` : null,
    meta.citation ? `Found at: ${meta.citation}` : null,
    meta.capturedAt ? `Captured ${new Date(meta.capturedAt).toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const pill = (
    <span className={`src-pill ${meta.source}`} title={title}>
      {SOURCE_LABEL[meta.source] || meta.source}
    </span>
  )
  return meta.citation ? (
    <a className="src-link" href={meta.citation} target="_blank" rel="noreferrer noopener">
      {pill}
    </a>
  ) : (
    pill
  )
}

export function Field({ label, meta, children }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="field">
      <span className="field-label">
        {label}
        <SourcePill meta={meta} />
      </span>
      <span className="field-value">{children}</span>
    </div>
  )
}

// One section's worth of leaves, rendered from the registry rather than a
// hardcoded list — adding a field to the registry makes it appear here.
function renderSection(home, section, leaves) {
  const parent = leaves[0].key.includes('.') ? leaves[0].key.split('.')[0] : null
  if (parent && home[parent] === null && ABSENT_TEXT[parent]) {
    return (
      <Field key={section} label={section}>
        <span className="muted-value">— none at this property</span>
      </Field>
    )
  }

  const present = leaves.filter((f) => !isEmpty(getByPath(home, f.key)))
  if (!present.length) return null

  const metaFor = (key) => home._meta?.fields?.[key]

  // A code is the thing someone is squinting at their phone for at a door, so
  // it gets the chip treatment rather than being buried in a sentence.
  const body = present.map((f) => {
    const val = getByPath(home, f.key)
    const rendered = Array.isArray(val) ? val.join(', ') : String(val)
    return (
      <span key={f.key} className="field-part">
        {f.label === 'Code' ? codeChip(rendered) : rendered}
        {/* Leaves in one section can have different origins — Parking's type
            is usually public while its garage access only ever comes from the
            call — so each carries its own pill rather than the section
            inheriting whichever leaf happened to be first. */}
        {present.length > 1 && <SourcePill meta={metaFor(f.key)} />}
      </span>
    )
  })

  return (
    <Field key={section} label={section} meta={present.length === 1 ? metaFor(present[0].key) : undefined}>
      {body}
    </Field>
  )
}

export function FieldGrid({ home, only = 'card' }) {
  const wanted = only === 'card' ? FIELDS.filter((f) => f.card) : FIELDS
  const sections = []
  const seen = new Set()

  for (const f of wanted) {
    if (seen.has(f.section)) continue
    seen.add(f.section)
    const leaves = wanted.filter((x) => x.section === f.section)
    const node = renderSection(home, f.section, leaves)
    if (node) sections.push(node)
  }

  return <div className="card-grid">{sections}</div>
}
