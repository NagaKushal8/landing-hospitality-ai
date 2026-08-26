// Screen 0 — the landing page.
//
// Written to be read in under a minute, and to sound like a person wrote it.
// Short sentences, ordinary words, no dashes doing the work a full stop should
// do. If a line could appear in any startup's copy, it is not saying anything.
//
// The guest half is NOT "there is no information" — the company already sends
// check-in details over. The problem is that the answer is buried in a document
// at the moment someone is standing at a door. That is a different product:
// not a database, but a way to ask one.

const COMPANY_STEPS = [
  ['1', 'Look it up', 'You give it an address. It finds whatever the building has online.'],
  ['2', 'Find the gaps', "Nobody puts a door code on a website. Whatever it can't find becomes a short list."],
  [
    '3',
    'Call the contact',
    'An AI agent calls the property manager, asks about the things on that list, and saves the answers.',
  ],
]

const GUEST_STEPS = [
  ['4', 'Ask, don’t search', '“Where’s the garage remote?” You get the answer for that unit, right away.'],
]

function Flow({ side, label, steps }) {
  return (
    <div className="flow-group">
      <span className={`side-tag ${side}`}>{label}</span>
      <ol className="intro-flow">
        {steps.map(([n, title, body]) => (
          <li key={n}>
            <span className="flow-n">{n}</span>
            <div>
              <b>{title}.</b> {body}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Intro({ onGo }) {
  return (
    <div className="screen intro">
      <div className="intro-lede">
        <h1>Improving the check-in experience</h1>
        <p>
          A guest gets to the building at 11pm. Which door? Is there a code, a fob, a lockbox? Where's
          the garage remote?
        </p>
      </div>

      <section className="intro-block">
        <h2>The problem</h2>
        <div className="problem-pair">
          <div>
            <span className="side-tag guest">Guest side</span>
            <p>
              The details are sent, in an email or a check-in doc. At the door that means scrolling a PDF
              for one code. There, but not very handy.
            </p>
          </div>
          <div>
            <span className="side-tag company">Company side</span>
            <p>
              About 25 facts per property, and every one differs, lock, garage, building entry. Across
              thousands of units, collecting and updating that is the real cost.
            </p>
          </div>
        </div>
      </section>

      <h1 className="intro-h1">How it helps</h1>

      <section className="intro-block">
        <Flow side="company" label="Company side: getting details in" steps={COMPANY_STEPS} />
        <Flow side="guest" label="Guest side: getting them out" steps={GUEST_STEPS} />
      </section>

      <section className="intro-block">
        <h2>Try it</h2>
        <div className="intro-cards">
          <button className="intro-card" onClick={() => onGo('onboard')}>
            <b>Onboard</b>
            <span>Type an address, then have it call a number you pick. This is the part that's new.</span>
          </button>
          <button className="intro-card" onClick={() => onGo('list')}>
            <b>Doors</b>
            <span>Example units, all their check-in details, and where each one came from.</span>
          </button>
          <button className="intro-card" onClick={() => onGo('help')}>
            <b>Help / Ask</b>
            <span>Pick a unit and ask it anything.</span>
          </button>
        </div>
      </section>

      <p className="intro-foot">
        This is a proof of concept, not a product. Expect rough edges. The example units are made up.
      </p>
    </div>
  )
}
