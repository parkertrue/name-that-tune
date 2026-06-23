import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDecks } from '../useDecks'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'
import * as decksService from '../../api/services/decksService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/decksService')

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

describe('useDecks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue('token')
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
    decksService.fetchAllSongsSummary.mockResolvedValue({
      total: 0, mastered: 0, active: 0,
    })
  })

  it('loads decks on mount when authenticated', async () => {
    decksService.fetchDecks.mockResolvedValue([
      { id: 1, name: 'Rock', total: 2, mastered: 0, active: 2 },
    ])
    const { result } = renderHook(() => useDecks(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.decks).toHaveLength(1)
    expect(result.current.decks[0].name).toBe('Rock')
  })

  it('loads the deduplicated All Songs summary', async () => {
    decksService.fetchDecks.mockResolvedValue([])
    decksService.fetchAllSongsSummary.mockResolvedValue({
      total: 5, mastered: 2, active: 3,
    })
    const { result } = renderHook(() => useDecks(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.allSongs).toEqual({ total: 5, mastered: 2, active: 3 })
  })

  it('does not load decks when unauthenticated', async () => {
    storage.getAccessToken.mockReturnValue(null)
    const { result } = renderHook(() => useDecks(), { wrapper })

    await waitFor(() => expect(result.current.decks).toEqual([]))
    expect(decksService.fetchDecks).not.toHaveBeenCalled()
  })

  it('addDeck appends the created deck', async () => {
    decksService.fetchDecks.mockResolvedValue([])
    decksService.createDeck.mockResolvedValue({ id: 2, name: 'Pop' })

    const { result } = renderHook(() => useDecks(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addDeck('Pop')
    })
    expect(result.current.decks).toContainEqual({ id: 2, name: 'Pop' })
  })

  it('removeDeck drops the deck from state', async () => {
    decksService.fetchDecks.mockResolvedValue([{ id: 1, name: 'Rock' }])
    decksService.deleteDeck.mockResolvedValue()

    const { result } = renderHook(() => useDecks(), { wrapper })
    await waitFor(() => expect(result.current.decks).toHaveLength(1))

    await act(async () => {
      await result.current.removeDeck(1)
    })
    expect(result.current.decks).toHaveLength(0)
  })

  it('sets an error message on load failure', async () => {
    decksService.fetchDecks.mockRejectedValue({
      response: { data: { error: { message: 'Boom' } } },
    })
    const { result } = renderHook(() => useDecks(), { wrapper })
    await waitFor(() => expect(result.current.error).toBe('Boom'))
  })
})
