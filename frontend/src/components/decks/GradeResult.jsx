export default function GradeResult({ result }) {
  if (!result) return null

  return (
    <div
      className={`grade-result ${result.correct ? 'grade-result--ok' : 'grade-result--no'}`}
      data-testid="grade-result"
    >
      <div className="grade-result-verdict">
        {result.correct ? '✅ Correct!' : '❌ Not quite!'}
      </div>
      <div className="grade-result-title">{result.title}</div>
      <div className="grade-result-artists">by {result.artists.join(', ')}</div>
      {result.mastered && (
        <div className="grade-result-mastered">🏆 Mastered!</div>
      )}
    </div>
  )
}
