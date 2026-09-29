import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchDecks,
  fetchAllSongsSummary,
  createDeck,
  fetchDeck,
  deleteDeck,
  deleteTrack,
  importTracks,
  resetDeck,
  studyNext,
  gradeAnswer,
} from '../decksService'
import { api } from '../../api'

vi.mock('../../api')

describe('decksService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchDecks calls GET /decks', async () => {
    api.get.mockResolvedValue({ data: [{ id: 1 }] })
    const result = await fetchDecks()
    expect(api.get).toHaveBeenCalledWith('/decks')
    expect(result).toEqual([{ id: 1 }])
  })

  it('fetchAllSongsSummary calls GET /decks/all', async () => {
    api.get.mockResolvedValue({ data: { total: 3, mastered: 1, active: 2 } })
    const result = await fetchAllSongsSummary()
    expect(api.get).toHaveBeenCalledWith('/decks/all')
    expect(result).toEqual({ total: 3, mastered: 1, active: 2 })
  })

  it('createDeck POSTs name', async () => {
    api.post.mockResolvedValue({ data: { id: 1, name: 'Rock' } })
    const result = await createDeck('Rock')
    expect(api.post).toHaveBeenCalledWith('/decks', { name: 'Rock' })
    expect(result.name).toBe('Rock')
  })

  it('fetchDeck calls GET /decks/:id', async () => {
    api.get.mockResolvedValue({ data: { id: 7 } })
    await fetchDeck(7)
    expect(api.get).toHaveBeenCalledWith('/decks/7')
  })

  it('deleteDeck calls DELETE /decks/:id', async () => {
    api.delete.mockResolvedValue({})
    await deleteDeck(7)
    expect(api.delete).toHaveBeenCalledWith('/decks/7')
  })

  it('deleteTrack calls DELETE /decks/tracks/:id', async () => {
    api.delete.mockResolvedValue({})
    await deleteTrack(42)
    expect(api.delete).toHaveBeenCalledWith('/decks/tracks/42')
  })

  it('importTracks POSTs tracks', async () => {
    const tracks = [{ title: 'S', artists: ['A'] }]
    api.post.mockResolvedValue({ data: { added: 1 } })
    const result = await importTracks(3, tracks)
    expect(api.post).toHaveBeenCalledWith('/decks/3/tracks', { tracks })
    expect(result.added).toBe(1)
  })

  it('resetDeck POSTs reset', async () => {
    api.post.mockResolvedValue({ data: { message: 'ok' } })
    await resetDeck(3)
    expect(api.post).toHaveBeenCalledWith('/decks/3/reset')
  })

  it('studyNext passes deck_id and exclude params', async () => {
    api.get.mockResolvedValue({ data: { track_id: 1 } })
    await studyNext('all', 5)
    expect(api.get).toHaveBeenCalledWith('/study/next', {
      params: { deck_id: 'all', exclude: 5 },
    })
  })

  it('studyNext omits exclude when not provided', async () => {
    api.get.mockResolvedValue({ data: { done: true } })
    await studyNext(2)
    expect(api.get).toHaveBeenCalledWith('/study/next', { params: { deck_id: 2 } })
  })

  it('gradeAnswer POSTs snake_case payload', async () => {
    api.post.mockResolvedValue({ data: { correct: true } })
    await gradeAnswer({
      trackId: 9,
      action: 'guess',
      guessArtists: ['Queen'],
      guessTitle: 'Bohemian Rhapsody',
      deckId: 'all',
    })
    expect(api.post).toHaveBeenCalledWith('/study/grade', {
      track_id: 9,
      action: 'guess',
      rating: null,
      guess_artists: ['Queen'],
      guess_title: 'Bohemian Rhapsody',
      deck_id: 'all',
    })
  })

  it('gradeAnswer passes the rating for a rate action', async () => {
    api.post.mockResolvedValue({ data: { correct: true } })
    await gradeAnswer({ trackId: 9, action: 'rate', rating: 'good', deckId: 'all' })
    expect(api.post).toHaveBeenCalledWith('/study/grade', expect.objectContaining({
      track_id: 9,
      action: 'rate',
      rating: 'good',
    }))
  })
})
