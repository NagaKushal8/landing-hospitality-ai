// Screen 0 — the landing page.
//
// Written to be read in under a minute, so it is aggressively short. Every
// sentence that survived is doing work; anything that merely sounded good is
// gone.
//
// The guest half is NOT "there is no information" — the company already
// documents check-in details and emails them over. The problem is that the
// answer is buried in a document at the moment someone is standing at a door.
// That distinction is the difference between building a database and building
// a way to ask one.

const COMPANY_STEPS = [
  ['1', 'Look it up', 'Give it an address; it researches the building from listing pages.'],
  ['2', 'Find the gaps', "Nobody publishes a door code. What the web can't answer becomes a short list."],
  [
    '3',
    'Call the contact',
    'An AI agent phones the property manager, asks only about those gaps, and writes the answers in.',
  ],
]

const GUEST_STEPS = [
  ['4', 'Ask, don’t search', '“Where’s the garage remote?” — answered for that exact unit, instantly.'],
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
          A guest reaches a building at 11pm. Which door? Is there a code, a fob, a lockbox? Where is the
          garage remote?
        </p>
      </div>

      <section className="intro-block">
        <h2>The problem</h2>
        <div className="problem-pair">
          <div>
            <span className="side-tag guest">Guest side</span>
            <p>
              The details <b>are</b> sent — in an email or a check-in doc. At the door that means scrolling
              a PDF for one code. There, but not usable.
            </p>
          </div>
          <div>
            <span className="side-tag company">Company side</span>
            <p>
              About <b>25 facts per property</b>, and every one differs — lock, garage, building entry.
              Across thousands of units, collecting and updating that is the real cost.
            </p>
          </div>
        </div>
      </section>

      <h1 className="intro-h1">How it helps</h1>

      <section className="intro-block">
        <Flow side="company" label="Company side — details in" steps={COMPANY_STEPS} />
        <Flow side="guest" label="Guest side — details out" steps={GUEST_STEPS} />
      </section>

      <section className="intro-block">
        <h2>Try it</h2>
        <div className="intro-cards">
          <button className="intro-card" onClick={() => onGo('onboard')}>
            <b>Onboard</b>
            <span>An address, then a real call to a number you pick. The half that doesn't exist today.</span>
          </button>
          <button className="intro-card" onClick={() => onGo('list')}>
            <b>Doors</b>
            <span>Example units, every check-in detail, and where each fact came from.</span>
          </button>
          <button className="intro-card" onClick={() => onGo('help')}>
            <b>Help / Ask</b>
            <span>Pick a unit and ask it anything.</span>
          </button>
        </div>
      </section>

      <p className="intro-foot">
        A proof of concept, not a product — rough edges expected, and the example units are made up.
      </p>
    </div>
  )
}
