// Screen 2 — the concierge. Pick a property, get AI-authored starter questions
// grounded in that home's data, then ask anything (chips or free text).

import { useEffect, useRef, useState } from 'react'
import { answerQuestion, generateSuggestedQuestions, hasApiKey } from './rag.js'

// Minimal, dependency-free Markdown → HTML for the model's answers.
// The model only emits **bold**, `-`/`*` bullets, and line breaks, so we
// handle just those. HTML is escaped FIRST, then we re-introduce only our
// own safe tags — so model output can't inject markup.
function renderMarkdown(src) {
  const esc = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const lines = esc(src).split('\n')
  let html = ''
  let inList = false
  const inline = (t) =>
    t
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

  for (const raw of lines) {
    const line = raw.trim()
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      if (!inList) {
        html += '<ul>'
        inList = true
      }
      html += `<li>${inline(bullet[1])}</li>`
    } else {
      if (inList) {
        html += '</ul>'
        inList = false
      }
      if (line === '') html += '<br/>'
      else html += `<p>${inline(line)}</p>`
    }
  }
  if (inList) html += '</ul>'
  return { __html: html }
}

export default function HelpScreen({ homes, initialHomeId, onBack }) {
  const [homeId, setHomeId] = useState(initialHomeId || '')
  const [suggested, setSuggested] = useState([])
  const [suggestSource, setSuggestSource] = useState(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', text, source}
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const scrollRef = useRef(null)

  const home = homes.find((h) => h.id === homeId) || null

  // When the property changes, reset the thread and pre-generate questions.
  useEffect(() => {
    setMessages([])
    setSuggested([])
    setSuggestSource(null)
    if (!home) return
    let cancelled = false
    setLoadingSuggest(true)
    generateSuggestedQuestions(home)
      .then((res) => {
        if (cancelled) return
        setSuggested(res.questions)
        setSuggestSource(res.source)
      })
      .finally(() => !cancelled && setLoadingSuggest(false))
    return () => {
      cancelled = true
    }
  }, [homeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, asking])

  async function ask(question) {
    const q = question.trim()
    if (!q || !home || asking) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setAsking(true)
    const res = await answerQuestion(home, q)
    setMessages((m) => [...m, { role: 'assistant', text: res.text, source: res.source }])
    setAsking(false)
  }

  return (
    <div className="screen help">
      <div className="help-head">
        <button className="link-btn" onClick={onBack}>
          ← All doors
        </button>
        <div className="picker">
          <label>Property</label>
          <select value={homeId} onChange={(e) => setHomeId(e.target.value)}>
            <option value="">Select a door / property…</option>
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.doorNumber} — {h.propertyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!home ? (
        <div className="empty">
          <p>Pick a property above to start. The concierge answers only from that home's data.</p>
        </div>
      ) : (
        <div className="concierge">
          <div className="ctx-note">
            Grounded in <b>{home.propertyName}</b>'s profile · {hasApiKey() ? 'OpenAI' : 'offline demo'} ·{' '}
            {suggestSource === 'openai' ? 'starter questions written by AI from the data' : 'starter questions derived from present fields'}
          </div>

          <div className="suggested">
            <div className="suggested-label">{loadingSuggest ? 'Generating starter questions…' : 'Try:'}</div>
            <div className="chips">
              {suggested.map((q, i) => (
                <button key={i} className="chip" disabled={asking} onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="thread" ref={scrollRef}>
            {messages.length === 0 && !asking && (
              <div className="thread-hint">
                Click a starter question or type your own below. Try a multi-part one like{' '}
                <i>"arriving 11 PM with my dog and a car — what do I need?"</i>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'bubble user' : 'bubble assistant'}>
                {m.role === 'assistant' && (
                  <span className={m.source === 'openai' ? 'src-tag ai' : 'src-tag mock'}>
                    {m.source === 'openai' ? 'AI' : 'offline'}
                  </span>
                )}
                {m.role === 'assistant' ? (
                  <div className="bubble-text md" dangerouslySetInnerHTML={renderMarkdown(m.text)} />
                ) : (
                  <div className="bubble-text">{m.text}</div>
                )}
              </div>
            ))}
            {asking && (
              <div className="bubble assistant">
                <span className="src-tag ai">AI</span>
                <div className="bubble-text typing">thinking…</div>
              </div>
            )}
          </div>

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
          >
            <input
              type="text"
              placeholder={`Ask anything about ${home.doorNumber}…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={asking}
            />
            <button type="submit" disabled={asking || !input.trim()}>
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
