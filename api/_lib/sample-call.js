// sample-call.js — the fallback shown before any real call has been recorded.
//
// This is written, not transcribed. It exists so the demo has something to show
// on day one, and it is labelled 'sample' everywhere it surfaces so nobody
// mistakes it for a real conversation. Once a real call completes, replay.js
// prefers that and this stops being used.
//
// It is written to look like what actually comes back: interruptions, a
// volunteered detail the agent then does not re-ask, a hedge the extractor
// should mark down, and a code read back for confirmation.

export const SAMPLE_CALL = {
  transcript: `AI: Hi! I'm an AI assistant calling on behalf of the property team to verify a few access and check-in details for 1400 East 6th Street. It should only take about five minutes — is now an okay time?
Contact: Yeah, sure, I've got a few minutes. What do you need?
AI: Great, thank you. Let's start with getting in — how does a guest get into the building itself?
Contact: So there's a keypad right at the glass front door on 6th. Code's 8842. Oh and that same code does the garage gate too, so they only need the one.
AI: Perfect, so eight-eight-four-two for both the front door and the garage gate — is that right?
Contact: That's right. One thing though, the front door sticks. You have to pull it firmly after it beeps or it doesn't actually catch.
AI: Good to know, I'll note that. And once they're inside, what about the unit door itself?
Contact: That's a Schlage smart lock. Code is 1195. You punch in the code, hit the Schlage logo, then hold the handle down about three seconds. People always miss the handle part and think it's broken.
AI: Understood — one-one-nine-five, then the logo, then hold the handle down for three seconds. You mentioned the garage opens with the same code. Is there a remote as well?
Contact: There's a clicker in the kitchen drawer, the one by the fridge, as a backup. And the spot is 4B, it's assigned.
AI: Got it. What about Wi-Fi?
Contact: Network's Foundry-4B and the password is riverside-720, all lowercase with a dash.
AI: Foundry-4B, password riverside-720. And if someone arrives late and the code doesn't work?
Contact: After eleven they should call the building line, 512-555-0164. That rings the on-call concierge. Same number for anything urgent, gas smell, a leak, whatever.
AI: That's helpful, thank you. Two quick ones — trash, and the thermostat?
Contact: Trash chute's at the end of the hallway on each floor. Recycling bins are down in the garage by spot 1. Pickup is Tuesday and Friday I think, don't quote me on the days.
AI: No problem. The thermostat?
Contact: It's a Nest, on the living room wall. We ask people to keep it between 65 and 78.
AI: That's everything I needed. Thank you — this means guests can get in without having to call anyone.
Contact: No problem, good luck with it.`,

  applied: [
    {
      key: 'buildingEntrance.method',
      label: 'Method',
      section: 'Building entrance',
      value: 'Keypad at the glass front door on E 6th St',
      source: 'voice',
      confidence: 0.95,
      critical: true,
      evidence: "there's a keypad right at the glass front door on 6th",
    },
    {
      key: 'buildingEntrance.code',
      label: 'Code',
      section: 'Building entrance',
      value: '8842',
      source: 'voice',
      confidence: 0.98,
      critical: true,
      evidence: 'so eight-eight-four-two for both the front door and the garage gate — is that right? / That’s right.',
    },
    {
      key: 'buildingEntrance.notes',
      label: 'Notes',
      section: 'Building entrance',
      value: 'The front door sticks — pull it firmly after the beep or it will not catch.',
      source: 'voice',
      confidence: 0.9,
      evidence: 'the front door sticks. You have to pull it firmly after it beeps',
    },
    {
      key: 'unitDoor.method',
      label: 'Method',
      section: 'Unit door',
      value: 'Schlage smart lock, code entry',
      source: 'voice',
      confidence: 0.95,
      critical: true,
      evidence: "That's a Schlage smart lock",
    },
    {
      key: 'unitDoor.code',
      label: 'Code',
      section: 'Unit door',
      value: '1195',
      source: 'voice',
      confidence: 0.97,
      critical: true,
      evidence: 'Code is 1195',
    },
    {
      key: 'unitDoor.notes',
      label: 'Notes',
      section: 'Unit door',
      value: 'Enter the code, press the Schlage logo, then hold the handle down for about 3 seconds to unlatch.',
      source: 'voice',
      confidence: 0.92,
      evidence: 'People always miss the handle part and think it’s broken',
    },
    {
      key: 'parking.garageAccess',
      label: 'Garage access',
      section: 'Parking',
      value: 'Same keypad code 8842 opens the garage gate. Backup clicker is in the kitchen drawer by the fridge.',
      source: 'voice',
      confidence: 0.94,
      critical: true,
      evidence: "There's a clicker in the kitchen drawer, the one by the fridge, as a backup",
    },
    {
      key: 'wifi.network',
      label: 'Network',
      section: 'Wi-Fi',
      value: 'Foundry-4B',
      source: 'voice',
      confidence: 0.95,
      critical: true,
      evidence: "Network's Foundry-4B",
    },
    {
      key: 'wifi.password',
      label: 'Password',
      section: 'Wi-Fi',
      value: 'riverside-720',
      source: 'voice',
      confidence: 0.95,
      critical: true,
      evidence: 'the password is riverside-720, all lowercase with a dash',
    },
    {
      key: 'lateCheckIn',
      label: 'Late check-in',
      section: 'Late / after-hours check-in',
      value: 'After 11 PM, call the building line at 512-555-0164 — it rings the on-call concierge.',
      source: 'voice',
      confidence: 0.93,
      critical: true,
      evidence: 'After eleven they should call the building line, 512-555-0164',
    },
    {
      key: 'emergencyContact',
      label: 'Emergency contact',
      section: 'Emergency contact',
      value: 'Call 512-555-0164 for anything urgent — gas smell, leak, lockout.',
      source: 'voice',
      confidence: 0.9,
      critical: true,
      evidence: 'Same number for anything urgent, gas smell, a leak, whatever',
    },
    {
      key: 'trash',
      label: 'Trash / recycling',
      section: 'Trash / recycling',
      value:
        'Trash chute at the end of each floor hallway. Recycling bins in the garage by spot 1. Pickup is reportedly Tuesday and Friday (contact was unsure of the days).',
      // The contact hedged on the days, so the extractor marks it down and the
      // uncertainty survives into the value rather than being smoothed away.
      source: 'voice',
      confidence: 0.55,
      evidence: "Pickup is Tuesday and Friday I think, don't quote me on the days",
    },
    {
      key: 'heatingCooling',
      label: 'Heating / cooling',
      section: 'Heating / cooling',
      value: 'Nest thermostat on the living room wall. Keep between 65–78°F.',
      source: 'voice',
      confidence: 0.94,
      evidence: "It's a Nest, on the living room wall. We ask people to keep it between 65 and 78",
    },
  ],
}
