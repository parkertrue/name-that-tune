// Short human label for a card's current SM-2 interval.
function intervalLabel(interval) {
  if (!interval) return 'new'
  return `${interval}d`
}

function TrackRow({ track, mastered }) {
  return (
    <div className={`track-row ${mastered ? 'track-row--mastered' : ''}`} data-testid="track-row">
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-artists">{track.artists.join(', ')}</div>
      </div>
      {!mastered && (
        <div className="track-interval" title={`ease ${track.ease_factor.toFixed(2)}`}>
          🔁 {intervalLabel(track.interval)}
        </div>
      )}
    </div>
  )
}

export default function MasteryDashboard({ deck, onReset }) {
  const tracks = deck.tracks || []
  // Show the cards nearest review (shortest interval) first.
  const learning = tracks
    .filter((t) => !t.mastered)
    .sort((a, b) => a.interval - b.interval)
  const mastered = tracks.filter((t) => t.mastered)
  const pct = deck.total ? Math.round((deck.mastered / deck.total) * 100) : 0

  return (
    <div className="mastery-dashboard" data-testid="mastery-dashboard">
      <p className="dashboard-summary">
        {deck.mastered} mastered of {deck.total}
      </p>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {learning.length > 0 && (
        <section className="track-section">
          <h3>Still Learning ({learning.length})</h3>
          <div className="track-list" data-testid="learning-list">
            {learning.map((t) => (
              <TrackRow key={t.id} track={t} mastered={false} />
            ))}
          </div>
        </section>
      )}

      {mastered.length > 0 && (
        <section className="track-section">
          <h3 className="mastered-heading">Mastered ({mastered.length})</h3>
          <div className="track-list" data-testid="mastered-list">
            {mastered.map((t) => (
              <TrackRow key={t.id} track={t} mastered />
            ))}
          </div>
        </section>
      )}

      {tracks.length === 0 ? (
        <p className="dashboard-empty" data-testid="dashboard-empty">
          This deck has no songs yet. Import some from the Decks page.
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-danger"
          data-testid="reset-deck"
          onClick={onReset}
        >
          Reset progress
        </button>
      )}
    </div>
  )
}
