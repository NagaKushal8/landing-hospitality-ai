import { useEffect, useState, useCallback } from 'react'
import Intro from './Intro.jsx'
import DoorList from './DoorList.jsx'
import HelpScreen from './HelpScreen.jsx'
import Onboard from './Onboard.jsx'
import { fetchHomes, fetchStatus } from './api.js'

// Nav order follows the story rather than the build order: what this is, then
// the interesting half (collecting the data), then the data, then asking it
// questions.
const TABS = [
  { id: 'intro', label: 'Start here' },
  { id: 'onboard', label: 'Onboard' },
  { id: 'list', label: 'Doors' },
  { id: 'help', label: 'Help / Ask' },
]

export default function App() {
  const [screen, setScreen] = useState('intro')
  const [activeHomeId, setActiveHomeId] = useState(null)
  const [homes, setHomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [status, setStatus] = useState(null)

  const loadHomes = useCallback(async () => {
    setLoading(true)
    try {
      setHomes(await fetchHomes())
      setLoadError(null)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHomes()
    fetchStatus().then(setStatus)
  }, [loadHomes])

  const openHelp = (homeId = null) => {
    setActiveHomeId(homeId)
    setScreen('help')
  }

  const go = (id) => (id === 'help' ? openHelp(activeHomeId) : setScreen(id))

  const live = status?.openai === 'configured'

  // The intro is static copy, so it should not sit behind the properties
  // request — someone opening a cold link sees the point immediately rather
  // than a loading message.
  const needsHomes = screen !== 'intro'

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('intro')} title="Start here">
          <span className="brand-mark">▚</span>
          <div>
            <div className="brand-name">Property Concierge</div>
            <div className="brand-sub">{loading ? 'loading…' : `${homes.length} homes`} · 25+ fields each</div>
          </div>
        </button>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={screen === t.id ? 'nav-btn active' : 'nav-btn'}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
          <span
            className={live ? 'ai-pill live' : 'ai-pill mock'}
            title={live ? 'Server has an OpenAI key' : 'No key on the server — offline fallback answers'}
          >
            {live ? '● live' : '○ offline'}
          </span>
        </nav>
      </header>

      <main className="main">
        {screen === 'intro' ? (
          <Intro onGo={go} />
        ) : loadError ? (
          <div className="screen">
            <div className="empty">
              <p>Couldn't load properties: {loadError}</p>
              <button className="link-btn" onClick={loadHomes}>
                Retry
              </button>
            </div>
          </div>
        ) : needsHomes && loading ? (
          <div className="screen">
            <div className="empty">
              <p>Loading properties…</p>
            </div>
          </div>
        ) : screen === 'onboard' ? (
          <Onboard
            onOpenHelp={(id) => {
              // Reload first so the freshly-onboarded property is in the list
              // the concierge screen picks from.
              loadHomes().then(() => openHelp(id))
            }}
          />
        ) : screen === 'list' ? (
          <DoorList homes={homes} onAsk={openHelp} />
        ) : (
          <HelpScreen homes={homes} initialHomeId={activeHomeId} onBack={() => setScreen('list')} live={live} />
        )}
      </main>
    </div>
  )
}
