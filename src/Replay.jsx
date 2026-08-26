// Replays a call that already happened, at the pace of a live one.
//
// This is what the demo shows when it cannot dial: the daily allowance is
// spent, the budget ceiling is reached, or the provider refused. The link is opened
// unattended with nobody around to explain a failure, so the fallback has to
// carry the idea on its own rather than apologise.
//
// It is always labelled. A recording is presented as a recording — the
// alternative is telling someone their phone is about to ring when it is not.

import { useEffect, useRef, useState } from 'react'
import { SourcePill } from './Field.jsx'
import Transcript from './Transcript.jsx'

const LINE_MS = 1100
const FIELD_MS = 700

export default function Replay({ replay, reason }) {
  const [lineCount, setLineCount] = useState(0)
  const [fieldCount, setFieldCount] = useState(0)
  const [playing, setPlaying] = useState(true)
  const scrollRef = useRef(null)
  const timers = useRef([])

  const lines = (replay?.transcript || '').split('\n').filter(Boolean)
  const applied = replay?.applied || []

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLineCount(0)
    setFieldCount(0)
    setPlaying(true)

    lines.forEach((_, i) => {
      timers.current.push(setTimeout(() => setLineCount(i + 1), i * LINE_MS))
    })
    // Fields land only once the part of the call that produced them has played,
    // so the causality reads correctly rather than everything arriving at once.
    const afterTranscript = lines.length * LINE_MS
    applied.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          setFieldCount(i + 1)
          if (i === applied.length - 1) setPlaying(false)
        }, Math.max(afterTranscript * 0.35, 1200) + i * FIELD_MS)
      )
    })
    if (!applied.length) timers.current.push(setTimeout(() => setPlaying(false), afterTranscript))

    return () => timers.current.forEach(clearTimeout)
  }, [replay])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lineCount])

  function skip() {
    timers.current.forEach(clearTimeout)
    setLineCount(lines.length)
    setFieldCount(applied.length)
    setPlaying(false)
  }

  const isSample = replay?.kind === 'sample'

  return (
    <div className="replay">
      <div className={`banner ${isSample ? 'warn' : ''}`}>
        <b>{isSample ? 'Example call' : 'Recording of a real call'}</b>
        {isSample
          ? '. This shows how the conversation goes. No live call was placed.'
          : replay?.recordedAt
            ? `, placed ${new Date(replay.recordedAt).toLocaleString()}. Played back, not live.`
            : '. Played back, not live.'}
        {reason && <div className="replay-why">{reason}</div>}
      </div>

      {replay?.recordingUrl && (
        <audio className="replay-audio" controls preload="none" src={replay.recordingUrl}>
          Your browser cannot play this recording.
        </audio>
      )}

      <div className="result-cols">
        <div className="transcript">
          <div className="col-label">
            Transcript
            {playing && (
              <button className="link-btn tiny" onClick={skip}>
                skip to end
              </button>
            )}
          </div>
          <div className="transcript-scroll" ref={scrollRef}>
            <Transcript
              text={lines.slice(0, lineCount).join('\n')}
              live={playing && lineCount < lines.length}
            />
          </div>
        </div>

        <div className="extracted">
          <div className="col-label">
            Fields captured {fieldCount > 0 && `(${fieldCount}/${applied.length})`}
          </div>
          {applied.slice(0, fieldCount).map((f) => (
            <div key={f.key} className="captured">
              <div className="captured-head">
                <span className="captured-label">
                  {f.section === f.label ? f.label : `${f.section} · ${f.label}`}
                </span>
                <SourcePill meta={f} />
              </div>
              <div className="captured-value">
                {Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}
              </div>
              {f.evidence && <div className="captured-evidence">“{f.evidence}”</div>}
            </div>
          ))}
          {fieldCount === 0 && <p className="hint">Listening…</p>}
        </div>
      </div>
    </div>
  )
}
