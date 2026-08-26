import { useEffect, useState, useCallback } from 'react'
import DoorList from './DoorList.jsx'
import HelpScreen from './HelpScreen.jsx'
import Onboard from './Onboard.jsx'
import { fetchHomes, fetchStatus } from './api.js'

export default function App() {
  const [screen, setScreen] = useState('list') // 'list' | 'help' | 'onboard'
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

  const live = status?.openai === 'configured'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▚</span>
          <div>
            <div className="brand-name">Property Concierge</div>
            <div className="brand-sub">
              {loading ? 'loading…' : `${homes.length} homes`} · 25+ fields each
            </div>
          </div>
        </div>
        <nav className="nav">
          <button className={screen === 'list' ? 'nav-btn active' : 'nav-btn'} onClick={() => setScreen('list')}>
            Doors
          </button>
          <button className={screen === 'help' ? 'nav-btn active' : 'nav-btn'} onClick={() => openHelp(activeHomeId)}>
            Help / Ask
          </button>
          <button className={screen === 'onboard' ? 'nav-btn active' : 'nav-btn'} onClick={() => setScreen('onboard')}>
            Onboard
          </button>
          <span
            className={live ? 'ai-pill live' : 'ai-pill mock'}
            title={live ? 'Server has an OpenAI key' : 'No key on the server — offline fallback answers'}
          >
            {live ? '● OpenAI live' : '○ offline demo'}
          </span>
        </nav>
      </header>

      <main className="main">
        {loadError ? (
          <div className="screen">
            <div className="empty">
              <p>Couldn't load properties: {loadError}</p>
              <button className="link-btn" onClick={loadHomes}>
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
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
