// Renders a call transcript with the two speakers visually separated.
//
// As one plain block it reads as a wall of text and you cannot see at a glance
// what the property manager actually said — which is the only part that
// becomes data. The contact's lines carry the same green as every other human
// input in the app, so a transcript matches the form fields and the chat.

const SPEAKER = /^(Contact|AI|assistant|user|human|customer)\s*:\s*/i

const isContact = (who) => ['contact', 'user', 'human', 'customer'].includes(who.toLowerCase())

export default function Transcript({ text, live = false }) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (!lines.length) {
    return <pre className="transcript-body">(no transcript)</pre>
  }

  return (
    <div className="transcript-body">
      {lines.map((line, i) => {
        const m = line.match(SPEAKER)
        if (!m) {
          return (
            <div key={i} className="t-line t-note">
              {line}
            </div>
          )
        }
        const who = m[1]
        const body = line.slice(m[0].length)
        const contact = isContact(who)
        return (
          <div key={i} className={contact ? 't-line t-contact' : 't-line t-ai'}>
            <span className="t-who">{contact ? 'Contact' : 'AI'}</span>
            <span className="t-text">{body}</span>
          </div>
        )
      })}
      {live && <div className="t-line t-cursor">▍</div>}
    </div>
  )
}
