// Screen 0 — the landing page.
//
// Anchored on check-in, deliberately. That is the moment the operational pain
// actually shows up, and every other problem here is downstream of it: the
// concierge exists because check-in details have to reach a guest, and the
// onboarding pipeline exists because they have to be collected first. Framing
// this as "property data management" would be true and would lose the reader.
//
// The heading names the area of work rather than opening on a scene, so it
// matches the words the problem was described in. The scene follows
// immediately underneath, which is where it does its work.
//
// Plain on purpose. Whoever opens the link has about thirty seconds and no
// context. No pitch, no metrics, no hero copy.

export default function Intro({ onGo }) {
  return (
    <div className="screen intro">
      <div className="intro-lede">
        <h1>Improving the check-in experience</h1>
        <p>
          A guest lands at 11pm outside a building they have never seen. Which door? Is there a code, or
          a fob, or a lockbox? Where does the garage remote live? What is the Wi-Fi?
        </p>
        <p>
          Every property answers those differently — a keypad here, a Schlage lock there, a key under a
          plant beside the main door. There is no template, and there are thousands of units.
        </p>
      </div>

      <section className="intro-block">
        <h2>One problem, two halves</h2>
        <ol className="intro-flow">
          <li>
            <span className="flow-n">A</span>
            <div>
              <b>Getting check-in details to the guest.</b> Right now they call or text someone and wait —
              usually while standing at a door they cannot open. Out of hours, that wait is long.
            </div>
          </li>
          <li>
            <span className="flow-n">B</span>
            <div>
              <b>Getting the details in the first place.</b> The harder half. Roughly 25 facts per unit —
              locks, codes, garage, parking, building access, Wi-Fi, thermostat, trash — and most of them
              live only in one busy property manager's head.
            </div>
          </li>
        </ol>
      </section>

      <section className="intro-block">
        <h2>What this prototype does</h2>
        <ol className="intro-flow">
          <li>
            <span className="flow-n">1</span>
            <div>
              <b>Looks up what is public.</b> Give it an address and it researches the building — beds,
              baths, amenities, parking — from listing pages.
            </div>
          </li>
          <li>
            <span className="flow-n">2</span>
            <div>
              <b>Works out what is missing.</b> Nobody publishes a door code. Whatever the web cannot
              answer becomes a short list.
            </div>
          </li>
          <li>
            <span className="flow-n">3</span>
            <div>
              <b>Phones the property contact.</b> An AI agent calls, has a normal conversation about
              exactly those missing things, and writes the answers into the record. It never asks about
              anything it already found.
            </div>
          </li>
          <li>
            <span className="flow-n">4</span>
            <div>
              <b>Answers the guest from it.</b> "Where is the garage remote?" gets the real answer for
              that specific unit, instantly, at 11pm.
            </div>
          </li>
        </ol>
      </section>

      <section className="intro-block">
        <h2>Try it</h2>
        <div className="intro-cards">
          <button className="intro-card" onClick={() => onGo('onboard')}>
            <b>Onboard — collecting the details</b>
            <span>
              Put in an address, watch it research, then have the agent call a number you choose. This is
              the half that does not exist today.
            </span>
          </button>
          <button className="intro-card" onClick={() => onGo('list')}>
            <b>Doors — what a unit knows</b>
            <span>
              Example units and every check-in detail behind each, with where each fact came from.
            </span>
          </button>
          <button className="intro-card" onClick={() => onGo('help')}>
            <b>Help / Ask — the guest side</b>
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
