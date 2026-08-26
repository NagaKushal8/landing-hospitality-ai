import { useState } from 'react'
import homes from './data/homes.json'
import DoorList from './DoorList.jsx'
import HelpScreen from './HelpScreen.jsx'
import { hasApiKey } from './rag.js'

export default function App() {
  const [screen, setScreen] = useState('list') // 'list' | 'help'
  const [activeHomeId, setActiveHomeId] = useState(null)

  const openHelp = (homeId = null) => {
    setActiveHomeId(homeId)
    setScreen('help')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▚</span>
          <div>
            <div className="brand-name">Property Concierge</div>
            <div className="brand-sub">RAG demo · {homes.length} homes · 25+ fields each</div>
          </div>
        </div>
        <nav className="nav">
          <button className={screen === 'list' ? 'nav-btn active' : 'nav-btn'} onClick={() => setScreen('list')}>
            Doors
          </button>
          <button className={screen === 'help' ? 'nav-btn active' : 'nav-btn'} onClick={() => openHelp(activeHomeId)}>
            Help / Ask
          </button>
          <span className={hasApiKey() ? 'ai-pill live' : 'ai-pill mock'} title={hasApiKey() ? 'OpenAI key detected' : 'No key — offline demo mode'}>
            {hasApiKey() ? '● OpenAI live' : '○ offline demo'}
          </span>
        </nav>
      </header>

      <main className="main">
        {screen === 'list' ? (
          <DoorList homes={homes} onAsk={openHelp} />
        ) : (
          <HelpScreen homes={homes} initialHomeId={activeHomeId} onBack={() => setScreen('list')} />
        )}
      </main>
    </div>
  )
}
