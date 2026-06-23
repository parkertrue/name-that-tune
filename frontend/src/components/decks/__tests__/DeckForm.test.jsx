import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeckForm from '../DeckForm'

describe('DeckForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an input and submit button', () => {
    render(<DeckForm onSubmit={vi.fn()} loading={false} />)
    expect(screen.getByTestId('deck-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('deck-submit')).toBeInTheDocument()
  })

  it('disables submit when empty', () => {
    render(<DeckForm onSubmit={vi.fn()} loading={false} />)
    expect(screen.getByTestId('deck-submit')).toBeDisabled()
  })

  it('submits the trimmed name', async () => {
    const onSubmit = vi.fn().mockResolvedValue({})
    render(<DeckForm onSubmit={onSubmit} loading={false} />)

    fireEvent.change(screen.getByTestId('deck-name-input'), {
      target: { value: '  80s Rock  ' },
    })
    fireEvent.click(screen.getByTestId('deck-submit'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('80s Rock'))
  })

  it('clears the input after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({})
    render(<DeckForm onSubmit={onSubmit} loading={false} />)

    const input = screen.getByTestId('deck-name-input')
    fireEvent.change(input, { target: { value: 'Pop' } })
    fireEvent.click(screen.getByTestId('deck-submit'))

    await waitFor(() => expect(input.value).toBe(''))
  })
})
