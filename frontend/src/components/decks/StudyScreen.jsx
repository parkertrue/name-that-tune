import { useEffect, useRef, useState } from 'react'
import GradeResult from './GradeResult'

// Anki-style rating buttons shown after the answer is revealed.
const RATINGS = [
  { key: 'again', label: 'Again', className: 'btn-rate-again' },
  { key: 'hard', label: 'Hard', className: 'btn-rate-hard' },
  { key: 'good', label: 'Good', className: 'btn-rate-good' },
  { key: 'easy', label: 'Easy', className: 'btn-rate-easy' },
]

// Short human label for a card's current SM-2 interval.
function intervalLabel(interval) {
  if (!interval) return 'new'
  return `${interval}d`
}

export default function StudyScreen({
  card,
  result,
  grading,
  score,
  progress,
  onSubmit,
  onReveal,
  onRate,
  onMaster,
}) {
  const numArtists = card.num_artists || 1
  const [artists, setArtists] = useState(() => Array(numArtists).fill(''))
  const [title, setTitle] = useState('')
  const inputRefs = useRef([])

  // Reset guess fields whenever a new card is shown.
  useEffect(() => {
    setArtists(Array(numArtists).fill(''))
    setTitle('')
    // Focus the first artist field for fast keyboard entry.
    const first = inputRefs.current[0]
    if (first) first.focus()
  }, [card.track_id, numArtists])

  const revealed = !!result
  const hasAudio = !!card.spotify_id

  const handleArtistChange = (i, value) => {
    setArtists((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (revealed || grading) return
    onSubmit(artists, title)
  }

  // Enter chains artist0 -> artist1 -> ... -> title -> submit.
  const handleKeyDown = (i, e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = inputRefs.current[i + 1]
    if (next) {
      next.focus()
    } else {
      onSubmit(artists, title)
    }
  }

  const pct = progress.total ? Math.round((progress.masteredCount / progress.total) * 100) : 0
  const interval = result?.interval ?? card.interval

  return (
    <div className="study-screen" data-testid="study-screen">
      <div className="study-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="study-meta">
          <span className="card-interval" aria-label={`interval ${intervalLabel(interval)}`}>
            🔁 {intervalLabel(interval)}
          </span>
          <span>{progress.remaining} remaining</span>
        </div>
      </div>

      <div className="study-card">
        {hasAudio ? (
          <div className={`embed-wrap ${revealed ? 'revealed' : ''}`} data-testid="embed-wrap">
            <iframe
              title="Spotify clip"
              src={`https://open.spotify.com/embed/track/${card.spotify_id}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              loading="lazy"
            />
            {!revealed && (
              <>
                <div className="embed-mask">
                  <span>🎵 ???</span>
                </div>
                <div className="embed-mask-corner" />
              </>
            )}
          </div>
        ) : (
          <div className="text-only" data-testid="text-only">
            🔇 Text-only mode — no audio
          </div>
        )}

        {!revealed ? (
          <form className="guess-form" onSubmit={handleSubmit}>
            <div className="guess-label">
              {numArtists > 1 ? `Artists (${numArtists})` : 'Artist'}
            </div>
            {Array.from({ length: numArtists }).map((_, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                className="guess-input"
                placeholder={numArtists > 1 ? `Artist ${i + 1}...` : 'Artist name...'}
                value={artists[i] || ''}
                onChange={(e) => handleArtistChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                data-testid={`guess-artist-${i}`}
                disabled={grading}
              />
            ))}
            <div className="guess-label">Song Title</div>
            <input
              ref={(el) => (inputRefs.current[numArtists] = el)}
              className="guess-input"
              placeholder="Song title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(numArtists, e)}
              data-testid="guess-title"
              disabled={grading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="guess-submit"
              disabled={grading}
            >
              Submit Guess
            </button>
          </form>
        ) : (
          <>
            <GradeResult result={result} />
            <div className="rating-prompt">How well did you know it?</div>
            <div className="rating-actions" data-testid="rating-actions">
              {RATINGS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`btn btn-rate ${r.className}`}
                  data-testid={`rate-${r.key}`}
                  onClick={() => onRate(r.key)}
                  disabled={grading}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="study-actions">
              <button type="button" className="btn btn-secondary" data-testid="master-btn"
                      onClick={onMaster} disabled={grading}>
                🏆 Mastered
              </button>
            </div>
          </>
        )}
      </div>

      {!revealed && (
        <div className="study-actions">
          <button type="button" className="btn btn-secondary" data-testid="reveal-btn"
                  onClick={onReveal} disabled={grading}>
            👁 Reveal
          </button>
        </div>
      )}

      <div className="study-tally" data-testid="study-tally">
        <span className="tally-correct">✓ {score.correct}</span>
        <span className="tally-sep">|</span>
        <span className="tally-wrong">✗ {score.wrong}</span>
        <span className="tally-sep">|</span>
        <span className="tally-mastered">🏆 {progress.masteredCount}</span>
      </div>
    </div>
  )
}
