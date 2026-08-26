// Screen 1 — the door list. Shows the raw per-property spec data so the
// "look how many facts live behind each door" point lands visually.
//
// The field grid now comes from the registry rather than a hardcoded list, so
// a property that was just created by phone renders without touching this file.

import { FieldGrid } from './Field.jsx'
import { computeGaps } from '../shared/field-registry.js'

function HomeCard({ home, onAsk }) {
  const gaps = computeGaps(home)
  const byPhone = Object.values(home._meta?.fields || {}).filter((m) => m.source === 'voice').length

  return (
    <div className="card">
      <div className="card-head">
        <div className="door-badge">{home.doorNumber}</div>
        <div className="card-title">
          <div className="card-name">{home.propertyName}</div>
          <div className="card-addr">
            {[home.neighborhood, home.market].filter(Boolean).join(' · ')}
            {home.bedrooms ? ` · ${home.bedrooms}BR / ${home.bathrooms}BA` : ''}
            {home.sqft ? ` · ${home.sqft} sqft` : ''}
          </div>
          <div className="card-meta">
            {byPhone > 0 && <span className="tag voice">{byPhone} fields from a call</span>}
            {gaps.length > 0 && <span className="tag gap">{gaps.length} still missing</span>}
          </div>
        </div>
        <button className="ask-btn" onClick={() => onAsk(home.id)}>
          Ask about this home →
        </button>
      </div>

      <FieldGrid home={home} only="card" />
    </div>
  )
}

export default function DoorList({ homes, onAsk }) {
  return (
    <div className="screen">
      <div className="screen-intro">
        <h1>Doors</h1>
        <p>
          Every home carries 25+ operational facts — access codes, parking, trash, hot water, pets, checkout.
          Across 6,000+ homes that's ~180,000 details no static FAQ or handbook can keep current. Open <b>Help / Ask</b> on
          any home to query just that property.
        </p>
      </div>
      <div className="cards">
        {homes.map((home) => (
          <HomeCard key={home.id} home={home} onAsk={onAsk} />
        ))}
      </div>
    </div>
  )
}
