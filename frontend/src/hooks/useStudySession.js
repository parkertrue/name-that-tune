import { useState, useEffect, useCallback, useRef } from 'react'
import { studyNext, gradeAnswer } from '../api/services/decksService'
import { getErrorMessage } from '../api/errors'

// Drives one study session over a deck (real id) or the virtual "all" scope.
// Mirrors the prototype's session state machine, but the answer is fetched from
// the server only when the card is graded.
export function useStudySession(deckId) {
  const [card, setCard] = useState(null)
  const [result, setResult] = useState(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState(null)
  const [score, setScore] = useState({ correct: 0, wrong: 0 })
  const [progress, setProgress] = useState({ remaining: 0, total: 0, masteredCount: 0 })

  const lastTrackId = useRef(null)

  const loadNext = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const data = await studyNext(deckId, lastTrackId.current)
      if (data.done) {
        setCard(null)
        setDone(true)
      } else {
        setCard(data)
        setDone(false)
        lastTrackId.current = data.track_id
        setProgress({
          remaining: data.remaining,
          total: data.total,
          masteredCount: data.mastered_count,
        })
        // The tally is server-side, so seed it from the scope's totals.
        setScore({ correct: data.correct_total, wrong: data.wrong_total })
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    lastTrackId.current = null
    loadNext()
  }, [loadNext])

  const grade = useCallback(async (action, { rating, guessArtists = [], guessTitle = '' } = {}) => {
    if (!card) return null
    setGrading(true)
    setError(null)
    try {
      const res = await gradeAnswer({
        trackId: card.track_id,
        action,
        rating,
        guessArtists,
        guessTitle,
        deckId,
      })
      return res
    } catch (err) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setGrading(false)
    }
  }, [card, deckId])

  // The grade response carries the deck's cumulative tally; trust it as truth.
  const applyTotals = (res) =>
    setScore({ correct: res.correct_total, wrong: res.wrong_total })

  // Step 1: reveal the answer. The card is scheduled later by rate().
  const submitGuess = useCallback(async (guessArtists, guessTitle) => {
    const res = await grade('guess', { guessArtists, guessTitle })
    if (!res) return
    setResult(res)
  }, [grade])

  const reveal = useCallback(async () => {
    const res = await grade('reveal')
    if (!res) return
    setResult(res)
  }, [grade])

  // Step 2: apply the Again/Hard/Good/Easy rating, then advance.
  const rate = useCallback(async (rating) => {
    const res = await grade('rate', { rating })
    if (!res) return
    applyTotals(res)
    await loadNext()
  }, [grade, loadNext])

  const master = useCallback(async () => {
    const res = await grade('master')
    if (!res) return
    applyTotals(res)
    await loadNext()
  }, [grade, loadNext])

  return {
    card,
    result,
    done,
    loading,
    grading,
    error,
    score,
    progress,
    submitGuess,
    reveal,
    rate,
    master,
    next: loadNext,
  }
}
