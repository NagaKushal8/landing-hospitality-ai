// Screen 3 — onboarding. The half of the problem the concierge doesn't solve:
// getting a property's operational detail into the system at all.
//
// Two stages, deliberately visible as two: research what is public, then phone
// a human for what isn't. The gap list between them is the point — it is what
// makes the call short and what makes it feel like a conversation rather than
// a form, because the agent is briefed only on what is actually missing.

import { useEffect, useRef, useState } from 'react'
import { enrichProperty, startCall, callStatus, reextract } from './api.js'
import { FieldGrid, SourcePill } from './Field.jsx'

const POLL_MS = 3000

const STATUS_COPY = {
  queued: 'Queued with the carrier…',
  ringing: 'Ringing…',
  'in-progress': 'On the call — talking to the contact',
  forwarding: 'Forwarding…',
  ended: 'Call ended',
  failed: 'Call failed',
  busy: 'Line was busy',
  'no-answer': 'No answer',
}

function Step({ n, title, subtitle, done, active, children }) {
  return (
    <section className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
      <div className="step-head">
        <span className="step-n">{done ? '✓' : n}</span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="step-sub">{subtitle}</p>}
        </div>
      </div>
      <div className="step-body">{children}</div>
    </section>
  )
}

export default function Onboard({ onOpenHelp }) {
  const [form, setForm] = useState({ address: '', propertyName: '', doorNumber: '', ownerName: '', ownerPhone: '' })
  const [enriching, setEnriching] = useState(false)
  const [enrichment, setEnrichment] = useState(null)
  const [home, setHome] = useState(null)
  const [gaps, setGaps] = useState([])
  const [error, setError] = useState(null)

  const [phone, setPhone] = useState('')
  const [calling, setCalling] = useState(false)
  const [callId, setCallId] = useState(null)
  const [status, setStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [reextracting, setReextracting] = useState(false)
  const pollRef = useRef(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => () => clearTimeout(pollRef.current), [])

  async function runEnrich(e) {
    e.preventDefault()
    if (!form.address.trim() || enriching) return
    setEnriching(true)
    setError(null)
    try {
      const res = await enrichProperty(form)
      setEnrichment(res)
      setHome(res.home)
      setGaps(res.gaps)
      setPhone(res.home.ownerContact?.phone || form.ownerPhone || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnriching(false)
    }
  }

  function poll(id) {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await callStatus(id)
        setStatus(res.status)
        if (res.transcript) setTranscript(res.transcript)
        if (res.done) {
          setCalling(false)
          setResult(res.extracted)
          if (res.home) {
            setHome(res.home)
            setGaps((g) => g.filter((x) => !res.extracted?.applied?.some((a) => a.key === x.key)))
          }
          return
        }
        poll(id)
      } catch (err) {
        setError(err.message)
        setCalling(false)
      }
    }, POLL_MS)
  }

  async function dial() {
    if (!home || !phone.trim() || calling) return
    setCalling(true)
    setError(null)
    setResult(null)
    setTranscript('')
    try {
      const res = await startCall({ homeId: home.id, phoneNumber: phone })
      setCallId(res.callId)
      setStatus(res.status)
      poll(res.callId)
    } catch (err) {
      setError(err.message)
      setCalling(false)
    }
  }

  async function runReextract() {
    if (!callId || reextracting) return
    setReextracting(true)
    try {
      const res = await reextract(callId)
      setResult(res.extracted)
      setHome(res.home)
    } catch (err) {
      setError(err.message)
    } finally {
      setReextracting(false)
    }
  }

  const criticalGaps = gaps.filter((g) => g.critical)

  return (
    <div className="screen onboard">
      <div className="screen-intro">
        <h1>Onboard a property</h1>
        <p>
          The concierge can only answer what someone entered. This is the other half: research
          what's public, work out what's <b>still missing</b>, then have an agent phone the property
          contact for exactly that — and nothing else.
        </p>
      </div>

      {error && <div className="banner error">{error}</div>}

      <Step n="1" title="Find what's public" subtitle="Address, unit mix, amenities, general parking — researched from listing and building pages." done={Boolean(enrichment)} active={!enrichment}>
        <form className="onboard-form" onSubmit={runEnrich}>
          <label>
            Address <span className="req">required</span>
            <input value={form.address} onChange={set('address')} placeholder="1400 E 6th St, Austin, TX 78702" />
          </label>
          <div className="form-row">
            <label>
              Building name
              <input value={form.propertyName} onChange={set('propertyName')} placeholder="The Foundry Lofts" />
            </label>
            <label>
              Unit / door
              <input value={form.doorNumber} onChange={set('doorNumber')} placeholder="4B" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Contact name
              <input value={form.ownerName} onChange={set('ownerName')} placeholder="Property team" />
            </label>
            <label>
              Contact phone
              <input value={form.ownerPhone} onChange={set('ownerPhone')} placeholder="512-555-0164" />
            </label>
          </div>
          <button type="submit" disabled={enriching || !form.address.trim()}>
            {enriching ? 'Researching the web…' : 'Find public info'}
          </button>
          {enriching && <p className="hint">Searching listing sites and building pages. This can take up to a minute.</p>}
        </form>

        {enrichment && (
          <div className="enrich-result">
            {enrichment.mock && <div className="banner warn">MOCK_ENRICH is on — this is stub data, no web search ran.</div>}
            <p className="hint">
              Filled <b>{enrichment.applied.length}</b> fields from public sources.
              {enrichment.notes && ` ${enrichment.notes}`}
            </p>
            <FieldGrid home={home} only="all" />
          </div>
        )}
      </Step>

      {home && (
        <Step n="2" title="What's still missing" subtitle="Nobody publishes a door code. These are the fields only the property contact knows." done={Boolean(result)} active={!result}>
          {gaps.length === 0 ? (
            <p className="hint">Nothing left — this property is fully populated.</p>
          ) : (
            <>
              <p className="hint">
                <b>{gaps.length}</b> fields left, <b>{criticalGaps.length}</b> of them the kind that leave a guest
                standing at a locked door. The agent will be briefed on these and will not ask about anything above.
              </p>
              <div className="gap-chips">
                {gaps.map((g) => (
                  <span key={g.key} className={`gap-chip ${g.critical ? 'critical' : ''}`} title={g.voiceTopic}>
                    {g.section === g.label ? g.label : `${g.section} · ${g.label}`}
                  </span>
                ))}
              </div>
            </>
          )}
        </Step>
      )}

      {home && gaps.length > 0 && (
        <Step n="3" title="Call the property contact" subtitle="A real outbound call. Natural conversation, not a questionnaire." done={Boolean(result)} active={Boolean(!result)}>
          <div className="call-row">
            <label>
              Phone number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 512 555 0164" disabled={calling} />
            </label>
            <button onClick={dial} disabled={calling || !phone.trim()}>
              {calling ? 'Calling…' : 'Start call'}
            </button>
          </div>
          <p className="hint">Put in your own number to hear it — you play the property manager.</p>

          {status && (
            <div className={`call-status ${calling ? 'live' : ''}`}>
              <span className="dot" />
              {STATUS_COPY[status] || status}
            </div>
          )}
        </Step>
      )}

      {(transcript || result) && (
        <Step n="4" title="What the call captured" subtitle="Extracted from the transcript and written straight into the record." active>
          <div className="result-cols">
            <div className="transcript">
              <div className="col-label">Transcript</div>
              <pre>{transcript || '(no transcript)'}</pre>
            </div>
            <div className="extracted">
              <div className="col-label">
                Fields captured
                {callId && (
                  <button className="link-btn tiny" onClick={runReextract} disabled={reextracting}>
                    {reextracting ? 're-extracting…' : 're-extract'}
                  </button>
                )}
              </div>
              {result?.applied?.length ? (
                result.applied.map((f) => (
                  <div key={f.key} className="captured">
                    <div className="captured-head">
                      <span className="captured-label">
                        {f.section === f.label ? f.label : `${f.section} · ${f.label}`}
                      </span>
                      <SourcePill meta={f} />
                    </div>
                    <div className="captured-value">{Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}</div>
                    {f.evidence && <div className="captured-evidence">“{f.evidence}”</div>}
                  </div>
                ))
              ) : (
                <p className="hint">Nothing was extracted{result?.note ? ` — ${result.note}` : '.'}</p>
              )}
              {result?.skipped?.length > 0 && (
                <details className="skipped">
                  <summary>{result.skipped.length} not applied</summary>
                  <ul>
                    {result.skipped.map((s, i) => (
                      <li key={i}>
                        <code>{s.key}</code> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>

          <div className="finish-row">
            <button onClick={() => onOpenHelp?.(home.id)}>
              Ask the concierge about this home →
            </button>
            <span className="hint">
              Everything captured above is live in the record now — no review step.
            </span>
          </div>
        </Step>
      )}
    </div>
  )
}
