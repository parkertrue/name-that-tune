import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DeckDashboardPage from '../DeckDashboardPage'
import * as decksService from '../../api/services/decksService'

vi.mock('../../api/services/decksService')

const deck = {
  id: 1,
  name: 'Rock',
  total: 2,
  mastered: 1,
  active: 1,
  tracks: [
    {
      id: 11, title: 'Learning Song', artists: ['A'],
      interval: 1, ease_factor: 2.5, mastered: false,
    },
    {
      id: 12, title: 'Done Song', artists: ['B'],
      interval: 21, ease_factor: 2.5, mastered: true,
    },
  ],
}

// Routed rather than mocking useParams, so the real :id lookup is exercised.
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/decks/1']}>
      <Routes>
        <Route path="/decks/:id" element={<DeckDashboardPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function firstDeleteButton() {
  await waitFor(() =>
    expect(screen.getAllByTestId('track-delete')).toHaveLength(2)
  )
  // Learning tracks render before mastered ones, so index 0 is track 11.
  return screen.getAllByTestId('track-delete')[0]
}

describe('DeckDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    decksService.fetchDeck.mockResolvedValue(deck)
    decksService.deleteTrack.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes the track and reloads once the confirm is accepted', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    renderPage()

    fireEvent.click(await firstDeleteButton())

    await waitFor(() =>
      expect(decksService.deleteTrack).toHaveBeenCalledWith(11)
    )
    // The page refetches so the list and counts reflect the deletion.
    await waitFor(() => expect(decksService.fetchDeck).toHaveBeenCalledTimes(2))
  })

  it('deletes nothing when the confirm is dismissed', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    renderPage()

    fireEvent.click(await firstDeleteButton())

    expect(decksService.deleteTrack).not.toHaveBeenCalled()
    expect(decksService.fetchDeck).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error when the delete fails', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    decksService.deleteTrack.mockRejectedValue(new Error('boom'))
    renderPage()

    fireEvent.click(await firstDeleteButton())

    await waitFor(() =>
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    )
  })
})
