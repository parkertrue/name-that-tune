import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchDeck, resetDeck } from '../api/services/decksService'
import { getErrorMessage } from '../api/errors'
import MasteryDashboard from '../components/decks/MasteryDashboard'

export default function DeckDashboardPage() {
  const { id } = useParams()
  const [deck, setDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDeck(await fetchDeck(id))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleReset = async () => {
    if (!window.confirm('Reset all progress in this deck?')) return
    try {
      await resetDeck(id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="deck-dashboard-page">
      <div className="decks-container">
        <Link to="/decks" className="back-link">← Back to decks</Link>

        {loading && <div data-testid="dashboard-loading">Loading...</div>}
        {error && <div className="error-message" data-testid="error-message">{error}</div>}

        {deck && (
          <>
            <header className="page-banner page-banner--deck">
              <div className="page-banner-glow" aria-hidden="true" />
              <span className="page-banner-eyebrow">🎵 Deck</span>
              <h1>{deck.name}</h1>
              <div className="deck-dashboard-actions">
                {deck.active > 0 && (
                  <Link to={`/study/${deck.id}`} className="btn btn-primary">
                    ▶ Study
                  </Link>
                )}
              </div>
            </header>
            <MasteryDashboard deck={deck} onReset={handleReset} />
          </>
        )}
      </div>
    </div>
  )
}
