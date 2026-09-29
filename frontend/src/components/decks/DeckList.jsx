import { Link } from 'react-router-dom'
import DeckCard from './DeckCard'

export default function DeckList({ decks, allSongs, loading, onDelete }) {
  if (loading) {
    return (
      <div className="decks-loading" data-testid="decks-loading">
        Loading decks...
      </div>
    )
  }

  // "All Songs" totals come deduplicated from the server (a song shared across
  // decks is counted once), so they match the actual study session.
  const { total: totalTracks = 0, mastered: totalMastered = 0, active: totalActive = 0 } =
    allSongs || {}

  return (
    <div className="deck-list" data-testid="deck-list">
      {/* Virtual "All Songs" scope spanning every deck. */}
      {totalTracks > 0 && (
        <div className="deck-card deck-card--all" data-testid="all-songs-card">
          <div className="deck-card-body">
            <h3 className="deck-card-name">🎵 All Songs</h3>
            <div className="deck-card-stats">
              {totalActive} active / {totalTracks} total · {totalMastered} mastered
            </div>
          </div>
          <div className="deck-card-actions">
            <Link to="/study/all" className="btn btn-primary" data-testid="study-all-link">
              ▶ Study All
            </Link>
          </div>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="decks-empty" data-testid="decks-empty">
          <p>No decks yet. Create one above and import songs to start studying!</p>
        </div>
      ) : (
        <div className="deck-list-scroll" data-testid="deck-list-scroll">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
