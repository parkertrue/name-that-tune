import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DecksPage from '../DecksPage'
import { AuthProvider } from '../../contexts/AuthContext'
import { storage } from '../../utils/storage'
import * as decksService from '../../api/services/decksService'

vi.mock('../../utils/storage')
vi.mock('../../api/services/decksService')

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  )
}

describe('DecksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.getAccessToken.mockReturnValue('token')
    storage.getRefreshCsrf.mockReturnValue(null)
    storage.getEmail.mockReturnValue(null)
    decksService.fetchAllSongsSummary.mockResolvedValue({
      total: 0, mastered: 0, active: 0,
    })
  })

  it('renders the page heading', async () => {
    decksService.fetchDecks.mockResolvedValue([])
    renderWithProviders(<DecksPage />)
    expect(screen.getByRole('heading', { name: /name that tune/i })).toBeInTheDocument()
  })

  it('shows the empty state when there are no decks', async () => {
    decksService.fetchDecks.mockResolvedValue([])
    renderWithProviders(<DecksPage />)
    await waitFor(() => expect(screen.getByTestId('decks-empty')).toBeInTheDocument())
  })

  it('renders deck cards and the All Songs card when decks exist', async () => {
    decksService.fetchDecks.mockResolvedValue([
      { id: 1, name: 'Rock', total: 3, mastered: 1, active: 2 },
    ])
    decksService.fetchAllSongsSummary.mockResolvedValue({
      total: 3, mastered: 1, active: 2,
    })
    renderWithProviders(<DecksPage />)

    await waitFor(() => expect(screen.getByTestId('deck-card')).toBeInTheDocument())
    expect(screen.getByTestId('all-songs-card')).toBeInTheDocument()
    expect(screen.getAllByText('Rock').length).toBeGreaterThan(0)
  })

  it('shows the import section only when decks exist', async () => {
    decksService.fetchDecks.mockResolvedValue([
      { id: 1, name: 'Rock', total: 1, mastered: 0, active: 1 },
    ])
    renderWithProviders(<DecksPage />)
    await waitFor(() => expect(screen.getByTestId('import-panel')).toBeInTheDocument())
  })
})
