// field-registry.js — the single source of truth for a property's shape.
//
// Before this file the field list was hardcoded in three places (the push()
// list in rag.js, the card grid in DoorList.jsx, and ruleBasedQuestions), so
// adding a field meant three edits that could silently drift. The onboarding
// pipeline would have added two more (the enrichment schema and the voice
// agent's target list). Everything now derives from the array below.
//
// Each entry describes ONE leaf value:
//
//   key          dot path into the property record ('wifi.password')
//   label        how it reads to a human
//   section      display grouping; several leaves can share one
//   group        which block of the UI it belongs to
//   origin       where the value is expected to come from:
//                  'manual' — an operator types it
//                  'web'    — discoverable from public sources
//                  'voice'  — only the property contact knows it
//                  'both'   — try the web, fall back to the call
//   critical     stranding-risk if wrong: codes, locks, emergency contact
//   voiceTopic   what the agent should learn, phrased as a topic rather than
//                a question — the agent converses, it does not read a form
//   type         'string' | 'number' | 'string[]'
//   card         show on the property card grid

export const FIELDS = [
  // ---- Identity -----------------------------------------------------------
  { key: 'propertyName', label: 'Property', section: 'Property', group: 'identity', origin: 'web', type: 'string' },
  { key: 'doorNumber', label: 'Door/Unit number', section: 'Door/Unit number', group: 'identity', origin: 'manual', type: 'string' },
  { key: 'address', label: 'Address', section: 'Address', group: 'identity', origin: 'web', type: 'string' },
  { key: 'market', label: 'Market', section: 'Market', group: 'identity', origin: 'web', type: 'string' },
  { key: 'neighborhood', label: 'Neighborhood', section: 'Neighborhood', group: 'identity', origin: 'web', type: 'string' },
  { key: 'bedrooms', label: 'Bedrooms', section: 'Bedrooms', group: 'identity', origin: 'web', type: 'number' },
  { key: 'bathrooms', label: 'Bathrooms', section: 'Bathrooms', group: 'identity', origin: 'web', type: 'number' },
  { key: 'sqft', label: 'Square feet', section: 'Square feet', group: 'identity', origin: 'web', type: 'number' },
  {
    key: 'floor', label: 'Floor', section: 'Floor', group: 'identity', origin: 'both', type: 'number',
    voiceTopic: 'which floor the unit is on',
  },

  // ---- Access -------------------------------------------------------------
  {
    key: 'buildingEntrance.method', label: 'Method', section: 'Building entrance',
    group: 'access', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'how a guest gets into the building itself — what kind of entry it is (keypad, fob, callbox, unlocked lobby) and where the door is',
  },
  {
    key: 'buildingEntrance.code', label: 'Code', section: 'Building entrance',
    group: 'access', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'the building entry code or fob details, if there is one',
  },
  {
    key: 'buildingEntrance.notes', label: 'Notes', section: 'Building entrance',
    group: 'access', origin: 'voice', type: 'string',
    voiceTopic: 'any quirk about the building door that guests get tripped up by',
  },
  {
    key: 'unitDoor.method', label: 'Method', section: 'Unit door',
    group: 'access', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'what kind of lock is on the unit door itself — smart lock, lockbox, physical key, app — and the brand if they know it',
  },
  {
    key: 'unitDoor.code', label: 'Code', section: 'Unit door',
    group: 'access', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'the unit door code or lockbox combination',
  },
  {
    key: 'unitDoor.notes', label: 'Notes', section: 'Unit door',
    group: 'access', origin: 'voice', type: 'string',
    voiceTopic: 'the trick to actually working that lock — anything a guest would get wrong on the first try',
  },
  {
    key: 'lateCheckIn', label: 'Late check-in', section: 'Late / after-hours check-in',
    group: 'access', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'what a guest should do if they arrive late at night or the code does not work',
  },

  // ---- Parking ------------------------------------------------------------
  {
    key: 'parking.type', label: 'Type', section: 'Parking',
    group: 'parking', origin: 'both', type: 'string', card: true,
    voiceTopic: 'the parking situation — assigned spot, garage, street — and the spot number if there is one',
  },
  {
    key: 'parking.garageAccess', label: 'Garage access', section: 'Parking',
    group: 'parking', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'how the garage opens, and where the remote or clicker is kept inside the unit',
  },
  {
    key: 'parking.evCharging', label: 'EV charging', section: 'Parking',
    group: 'parking', origin: 'both', type: 'string',
    voiceTopic: 'whether there is EV charging on site',
  },

  // ---- Amenities ----------------------------------------------------------
  {
    key: 'pool.access', label: 'Pool', section: 'Pool', group: 'amenities',
    origin: 'both', type: 'string', card: true,
    voiceTopic: 'whether there is a pool and how guests get to it',
  },
  { key: 'pool.notes', label: 'Pool notes', section: 'Pool', group: 'amenities', origin: 'both', type: 'string' },
  {
    key: 'gym', label: 'Gym / fitness', section: 'Gym / fitness', group: 'amenities',
    origin: 'both', type: 'string', card: true,
    voiceTopic: 'whether there is a gym, its hours, and how to get in',
  },
  { key: 'amenities', label: 'Amenities', section: 'Amenities', group: 'amenities', origin: 'web', type: 'string[]' },

  // ---- Utilities ----------------------------------------------------------
  {
    key: 'wifi.network', label: 'Network', section: 'Wi-Fi',
    group: 'utilities', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'the Wi-Fi network name',
  },
  {
    key: 'wifi.password', label: 'Password', section: 'Wi-Fi',
    group: 'utilities', origin: 'voice', critical: true, type: 'string', card: true,
    voiceTopic: 'the Wi-Fi password',
  },
  {
    key: 'heatingCooling', label: 'Heating / cooling', section: 'Heating / cooling',
    group: 'utilities', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'the thermostat — what kind it is, where it is, and any temperature range guests should stay within',
  },
  {
    key: 'hotWater', label: 'Hot water', section: 'Hot water',
    group: 'utilities', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'the hot water setup and what to do if the water runs cold',
  },
  {
    key: 'laundry', label: 'Laundry', section: 'Laundry',
    group: 'utilities', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'laundry — in-unit, in-building, or off-site',
  },
  {
    key: 'trash', label: 'Trash / recycling', section: 'Trash / recycling',
    group: 'utilities', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'where trash and recycling go, and which days pickup is',
  },

  // ---- Policies -----------------------------------------------------------
  {
    key: 'pets', label: 'Pets', section: 'Pets', group: 'policies',
    origin: 'both', type: 'string', card: true,
    voiceTopic: 'the pet policy — whether pets are allowed, any limits or deposits',
  },
  {
    key: 'quietHours', label: 'Quiet hours', section: 'Quiet hours', group: 'policies',
    origin: 'both', type: 'string',
    voiceTopic: 'quiet hours or building noise rules',
  },
  {
    key: 'mailPackages', label: 'Mail / packages', section: 'Mail / packages',
    group: 'policies', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'where mail and packages are delivered and how guests retrieve them',
  },
  {
    key: 'checkoutInstructions', label: 'Checkout', section: 'Checkout instructions',
    group: 'policies', origin: 'voice', type: 'string', card: true,
    voiceTopic: 'what guests need to do on checkout day',
  },

  // ---- Contact ------------------------------------------------------------
  { key: 'ownerContact.name', label: 'Name', section: 'Owner / property contact', group: 'contact', origin: 'manual', type: 'string', card: true },
  { key: 'ownerContact.phone', label: 'Phone', section: 'Owner / property contact', group: 'contact', origin: 'manual', type: 'string', card: true },
  {
    key: 'emergencyContact', label: 'Emergency contact', section: 'Emergency contact',
    group: 'contact', origin: 'voice', critical: true, type: 'string',
    voiceTopic: 'who a guest should call for an emergency like a gas smell, a leak, or a lockout',
  },
]

// A parent object that is explicitly `null` means "this property does not have
// one" — as opposed to `undefined`, which means "we do not know yet". The
// distinction matters: the concierge should confidently say there is no pool
// rather than deflecting to the property contact.
export const ABSENT_TEXT = {
  pool: 'No pool at this property',
}

export const GROUP_LABELS = {
  identity: 'Property',
  access: 'Access',
  parking: 'Parking',
  amenities: 'Amenities',
  utilities: 'Utilities',
  policies: 'Policies',
  contact: 'Contacts',
}

// ---- Path helpers ----------------------------------------------------------

export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj)
}

export function setByPath(obj, path, value) {
  const parts = path.split('.')
  const last = parts.pop()
  let cur = obj
  for (const k of parts) {
    // Walks through an explicit null too — writing pool.access to a property
    // previously marked "no pool" should revive the object, not throw.
    if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[last] = value
  return obj
}

export function isEmpty(val) {
  if (val === null || val === undefined || val === '') return true
  if (Array.isArray(val)) return val.length === 0
  return false
}

export function fieldByKey(key) {
  return FIELDS.find((f) => f.key === key)
}

// ---- Selection -------------------------------------------------------------

export const webFields = () => FIELDS.filter((f) => f.origin === 'web' || f.origin === 'both')
export const voiceFields = () => FIELDS.filter((f) => f.origin === 'voice' || f.origin === 'both')

// Which voice-answerable fields this property still needs. This is the whole
// point of doing enrichment first: the call agent is briefed on these and
// nothing else, so it never re-asks something already known.
export function computeGaps(home) {
  return voiceFields().filter((f) => {
    const parent = f.key.includes('.') ? f.key.split('.')[0] : null
    // An explicit null parent is an answer ("no pool"), not a gap.
    if (parent && home[parent] === null) return false
    return isEmpty(getByPath(home, f.key))
  })
}

export function filledSummary(home) {
  return FIELDS.filter((f) => !isEmpty(getByPath(home, f.key))).map(
    (f) => `${f.section}${f.section === f.label ? '' : ` (${f.label})`}`
  )
}

// ---- Context ---------------------------------------------------------------

// Flatten a property into the labeled block the model gets as ground truth.
// Leaves are grouped back under their section so the shape matches what the
// original hand-written buildContext produced.
export function buildContext(home) {
  const lines = []
  const seen = new Set()

  for (const f of FIELDS) {
    if (seen.has(f.section)) continue
    seen.add(f.section)

    const inSection = FIELDS.filter((x) => x.section === f.section)
    const parent = f.key.includes('.') ? f.key.split('.')[0] : null

    if (parent && home[parent] === null && ABSENT_TEXT[parent]) {
      lines.push(`${f.section}: ${ABSENT_TEXT[parent]}`)
      continue
    }

    const parts = []
    for (const leaf of inSection) {
      const val = getByPath(home, leaf.key)
      if (isEmpty(val)) continue
      const rendered = Array.isArray(val) ? val.join(', ') : val
      parts.push(inSection.length === 1 ? String(rendered) : `${leaf.label.toLowerCase()}: ${rendered}`)
    }
    if (parts.length) lines.push(`${f.section}: ${parts.join('; ')}`)
  }

  return lines.join('\n')
}

// ---- JSON Schema generation ------------------------------------------------

// Builds a strict schema for a set of fields, used for both web enrichment and
// call extraction. Every value is wrapped so the model has to say where it got
// it — a bare value with no provenance is not useful to us.
export function jsonSchemaFor(fields, { evidenceLabel = 'evidence' } = {}) {
  const properties = {}
  for (const f of fields) {
    properties[f.key] = {
      type: 'object',
      description: f.voiceTopic || f.label,
      properties: {
        value:
          f.type === 'string[]'
            ? { type: 'array', items: { type: 'string' } }
            : { type: f.type === 'number' ? 'number' : 'string' },
        confidence: { type: 'number', description: '0 to 1' },
        [evidenceLabel]: { type: 'string' },
      },
      required: ['value', 'confidence'],
    }
  }
  return { type: 'object', properties, additionalProperties: false }
}
