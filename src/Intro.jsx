// Screen 0 — the landing page.
//
// Deliberately plain. Whoever opens the link has about thirty seconds of
// patience and no context, so this says what the problem is, what the thing
// does, and where to click. No pitch, no metrics, no hero copy.

export default function Intro({ onGo }) {
  return (
    <div className="screen intro">
      <div className="intro-lede">
        <h1>Every door is different.</h1>
        <p>
          A corporate housing company might run thousands of units. Each one has its own lock, its own
          code, its own place where the garage remote lives, its own Wi-Fi password. None of it is
          written down anywhere a guest can reach at 11pm.
        </p>
      </div>

      <section className="intro-block">
        <h2>The problem</h2>
        <p>
          Two halves, and the second is the hard one.
        </p>
        <ul>
          <li>
            <b>Guests can't get answers.</b> They call or text someone, and wait — usually while standing
            at a door they can't open.
          </li>
          <li>
            <b>Nobody wants to collect the data.</b> Getting 25 operational details for one unit means
            chasing a property manager who is busy and has told someone this already. Multiply by every
            unit.
          </li>
        </ul>
      </section>

      <section className="intro-block">
        <h2>What this prototype does</h2>
        <ol className="intro-flow">
          <li>
            <span className="flow-n">1</span>
            <div>
              <b>Looks up what's public.</b> Give it an address and it researches the building — beds,
              baths, amenities, parking — from listing pages.
            </div>
          </li>
          <li>
            <span className="flow-n">2</span>
            <div>
              <b>Works out what's missing.</b> Nobody publishes a door code. Whatever the web can't
              answer becomes a short list.
            </div>
          </li>
          <li>
            <span className="flow-n">3</span>
            <div>
              <b>Phones the property contact.</b> An AI agent calls, has a normal conversation about
              exactly those missing things, and writes the answers into the record.
            </div>
          </li>
          <li>
            <span className="flow-n">4</span>
            <div>
              <b>Answers guests from it.</b> "Where's the garage remote?" gets the real answer, for that
              specific unit.
            </div>
          </li>
        </ol>
      </section>

      <section className="intro-block">
        <h2>Try it</h2>
        <div className="intro-cards">
          <button className="intro-card" onClick={() => onGo('onboard')}>
            <b>Onboard</b>
            <span>
              Put in an address, watch it research, then have the agent call a number you choose. This is
              the interesting one.
            </span>
          </button>
          <button className="intro-card" onClick={() => onGo('list')}>
            <b>Doors</b>
            <span>Six example units and every operational detail behind each, with where it came from.</span>
          </button>
          <button className="intro-card" onClick={() => onGo('help')}>
            <b>Help / Ask</b>
            <span>Pick a unit and ask it anything. It only answers from that unit's record.</span>
          </button>
        </div>
      </section>

      <p className="intro-foot">
        Rough edges are expected — this is a proof of concept built to show the idea works, not a product.
        The data in the example units is made up.
      </p>
    </div>
  )
}
