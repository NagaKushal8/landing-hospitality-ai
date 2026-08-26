// Screen 1 — the door list. Shows the raw per-property spec data so the
// "look how many facts live behind each door" point lands visually.

function Field({ label, children }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{children}</span>
    </div>
  )
}

function codeChip(val) {
  if (!val) return null
  return <span className="code-chip">{val}</span>
}

function HomeCard({ home, onAsk }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="door-badge">{home.doorNumber}</div>
        <div className="card-title">
          <div className="card-name">{home.propertyName}</div>
          <div className="card-addr">
            {home.neighborhood} · {home.market} · {home.bedrooms}BR / {home.bathrooms}BA · {home.sqft} sqft
          </div>
        </div>
        <button className="ask-btn" onClick={() => onAsk(home.id)}>
          Ask about this home →
        </button>
      </div>

      <div className="card-grid">
        <Field label="Building entrance">
          {home.buildingEntrance?.method} {codeChip(home.buildingEntrance?.code)}
        </Field>
        <Field label="Unit door">
          {home.unitDoor?.method} {codeChip(home.unitDoor?.code)}
        </Field>
        <Field label="Parking">{home.parking?.type}</Field>
        <Field label="Garage access">{home.parking?.garageAccess}</Field>
        <Field label="Pool">{home.pool ? home.pool.access : '— none at this property'}</Field>
        <Field label="Gym">{home.gym}</Field>
        <Field label="Wi-Fi">
          {home.wifi ? `${home.wifi.network} / ${home.wifi.password}` : null}
        </Field>
        <Field label="Hot water">{home.hotWater}</Field>
        <Field label="Heating / cooling">{home.heatingCooling}</Field>
        <Field label="Trash">{home.trash}</Field>
        <Field label="Pets">{home.pets}</Field>
        <Field label="Laundry">{home.laundry}</Field>
        <Field label="Mail / packages">{home.mailPackages}</Field>
        <Field label="Late check-in">{home.lateCheckIn}</Field>
        <Field label="Owner contact">
          {home.ownerContact ? `${home.ownerContact.name} · ${home.ownerContact.phone}` : null}
        </Field>
        <Field label="Checkout">{home.checkoutInstructions}</Field>
      </div>
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
