import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useStudySession } from '../useStudySession'
import * as decksService from '../../api/services/decksService'

vi.mock('../../api/services/decksService')

const sampleCard = {
  track_id: 10,
  spotify_id: 'abc',
  num_artists: 1,
  ease_factor: 2.5,
  interval: 0,
  repetitions: 0,
  remaining: 2,
  total: 3,
  mastered_count: 1,
  correct_total: 0,
  wrong_total: 0,
}

describe('useStudySession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first card on mount', async () => {
    decksService.studyNext.mockResolvedValue(sampleCard)
    const { result } = renderHook(() => useStudySession('all'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.card.track_id).toBe(10)
    expect(result.current.progress.remaining).toBe(2)
    expect(decksService.studyNext).toHaveBeenCalledWith('all', null)
  })

  it('marks the session done when nothing is left', async () => {
    decksService.studyNext.mockResolvedValue({ done: true })
    const { result } = renderHook(() => useStudySession('all'))

    await waitFor(() => expect(result.current.done).toBe(true))
    expect(result.current.card).toBeNull()
  })

  it('submitGuess reveals the answer without scheduling or tallying', async () => {
    decksService.studyNext.mockResolvedValue(sampleCard)
    decksService.gradeAnswer.mockResolvedValue({
      correct: true, title: 'Song', artists: ['A'], interval: 0, repetitions: 0,
      ease_factor: 2.5, mastered: false, correct_total: 0, wrong_total: 0,
    })
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.submitGuess(['A'], 'Song')
    })

    expect(decksService.gradeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: 10, action: 'guess', guessArtists: ['A'], guessTitle: 'Song', deckId: 'all',
      })
    )
    expect(result.current.result.correct).toBe(true)
    // The tally only moves when the card is rated.
    expect(result.current.score).toEqual({ correct: 0, wrong: 0 })
  })

  it('rate applies the rating, bumps the tally, and advances', async () => {
    decksService.studyNext
      .mockResolvedValueOnce(sampleCard)
      .mockResolvedValueOnce({ ...sampleCard, track_id: 11, correct_total: 1, wrong_total: 0 })
    decksService.gradeAnswer.mockResolvedValue({
      correct: true, title: 'Song', artists: ['A'], interval: 1, repetitions: 1,
      ease_factor: 2.5, mastered: false, correct_total: 1, wrong_total: 0,
    })
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.rate('good')
    })

    expect(decksService.gradeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rate', rating: 'good' })
    )
    expect(result.current.score).toEqual({ correct: 1, wrong: 0 })
    await waitFor(() => expect(result.current.card.track_id).toBe(11))
  })

  it('reveal shows the answer without tallying', async () => {
    decksService.studyNext.mockResolvedValue(sampleCard)
    decksService.gradeAnswer.mockResolvedValue({
      correct: false, title: 'Song', artists: ['A'], interval: 0, repetitions: 0,
      ease_factor: 2.5, mastered: false, correct_total: 0, wrong_total: 0,
    })
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.reveal()
    })
    expect(result.current.score).toEqual({ correct: 0, wrong: 0 })
    expect(result.current.result.correct).toBe(false)
  })

  it('master grades and advances to the next card', async () => {
    decksService.studyNext
      .mockResolvedValueOnce(sampleCard)
      .mockResolvedValueOnce({ ...sampleCard, track_id: 11, correct_total: 1, wrong_total: 0 })
    decksService.gradeAnswer.mockResolvedValue({
      correct: true, title: 'Song', artists: ['A'], interval: 21, repetitions: 3,
      ease_factor: 2.5, mastered: true, correct_total: 1, wrong_total: 0,
    })
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.master()
    })
    expect(decksService.gradeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'master' })
    )
    expect(result.current.score.correct).toBe(1)
    await waitFor(() => expect(result.current.card.track_id).toBe(11))
  })

  it('deleteCurrent removes the song and advances', async () => {
    decksService.studyNext
      .mockResolvedValueOnce(sampleCard)
      .mockResolvedValueOnce({ ...sampleCard, track_id: 11, remaining: 1, total: 2 })
    decksService.deleteTrack.mockResolvedValue(undefined)
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteCurrent()
    })

    expect(decksService.deleteTrack).toHaveBeenCalledWith(10)
    // loadNext re-reads the scope, so the totals reflect the deletion.
    await waitFor(() => expect(result.current.card.track_id).toBe(11))
    expect(result.current.progress.total).toBe(2)
    expect(result.current.error).toBeNull()
  })

  it('deleteCurrent surfaces an error and keeps the current card', async () => {
    decksService.studyNext.mockResolvedValue(sampleCard)
    decksService.deleteTrack.mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteCurrent()
    })

    expect(result.current.error).toBeTruthy()
    // The card must not advance when the delete failed.
    expect(result.current.card.track_id).toBe(10)
    expect(result.current.grading).toBe(false)
  })

  it('next excludes the current card on the next fetch', async () => {
    decksService.studyNext
      .mockResolvedValueOnce(sampleCard)
      .mockResolvedValueOnce({ ...sampleCard, track_id: 12 })
    const { result } = renderHook(() => useStudySession('all'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.next()
    })
    expect(decksService.studyNext).toHaveBeenLastCalledWith('all', 10)
  })
})
