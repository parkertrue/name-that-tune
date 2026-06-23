import { useParams, Link } from 'react-router-dom'
import { useStudySession } from '../hooks/useStudySession'
import StudyScreen from '../components/decks/StudyScreen'

export default function StudyPage() {
  const { deckId } = useParams()
  const session = useStudySession(deckId)
  const {
    card, result, done, loading, grading, error, score, progress,
    submitGuess, reveal, rate, master, next,
  } = session

  return (
    <div className="study-page">
      <div className="study-container">
        <div className="study-header">
          <Link to="/decks" className="back-link">← Menu</Link>
        </div>

        {error && <div className="error-message" data-testid="error-message">{error}</div>}

        {loading && !card && (
          <div className="study-loading" data-testid="study-loading">Loading...</div>
        )}

        {done && (
          <div className="study-done" data-testid="study-done">
            <div className="study-done-emoji">🎉</div>
            <h2>All caught up!</h2>
            <p>You've mastered every active song in this set.</p>
            <div className="study-tally">
              <span className="tally-correct">✓ {score.correct}</span>
              <span className="tally-sep">|</span>
              <span className="tally-wrong">✗ {score.wrong}</span>
            </div>
            <Link to="/decks" className="btn btn-primary">Back to decks</Link>
          </div>
        )}

        {card && (
          <StudyScreen
            card={card}
            result={result}
            grading={grading}
            score={score}
            progress={progress}
            onSubmit={submitGuess}
            onReveal={reveal}
            onRate={rate}
            onMaster={master}
          />
        )}
      </div>
    </div>
  )
}
