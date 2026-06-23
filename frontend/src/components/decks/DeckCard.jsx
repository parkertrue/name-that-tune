import { Link } from 'react-router-dom'

function progressPct(deck) {
  if (!deck.total) return 0
  return Math.round((deck.mastered / deck.total) * 100)
}

export default function DeckCard({ deck, onDelete }) {
  const pct = progressPct(deck)

  return (
    <div className="deck-card" data-testid="deck-card">
      <div className="deck-card-body">
        <div className="deck-card-header">
          <h3 className="deck-card-name">{deck.name}</h3>
          {onDelete && (
            <button
              type="button"
              className="deck-delete-btn"
              aria-label={`Delete ${deck.name}`}
              data-testid="deck-delete"
              onClick={() => onDelete(deck)}
            >
              ✕
            </button>
          )}
        </div>
        <div className="deck-card-stats">
          {deck.active} active / {deck.total} total · {deck.mastered} mastered
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="deck-card-actions">
        <Link
          to={`/study/${deck.id}`}
          className="btn btn-primary"
          data-testid="deck-study-link"
          aria-disabled={deck.active === 0}
        >
          ▶ Study
        </Link>
        <Link to={`/decks/${deck.id}`} className="btn btn-secondary">
          📊 Dashboard
        </Link>
      </div>
    </div>
  )
}
