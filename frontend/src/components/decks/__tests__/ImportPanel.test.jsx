import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImportPanel from '../ImportPanel'

describe('ImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses pasted text and calls onImport with structured tracks', async () => {
    const onImport = vi.fn().mockResolvedValue({ added: 2 })
    render(<ImportPanel onImport={onImport} importing={false} />)

    fireEvent.change(screen.getByTestId('import-textarea'), {
      target: { value: 'Queen - Bohemian Rhapsody\nMadonna - Like a Prayer' },
    })
    fireEvent.click(screen.getByTestId('import-submit'))

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    const tracks = onImport.mock.calls[0][0]
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toEqual({
      spotify_id: null, title: 'Bohemian Rhapsody', artists: ['Queen'],
    })
  })

  it('shows a success message after import', async () => {
    const onImport = vi.fn().mockResolvedValue({ added: 1 })
    render(<ImportPanel onImport={onImport} importing={false} />)

    fireEvent.change(screen.getByTestId('import-textarea'), {
      target: { value: 'Queen - Bohemian Rhapsody' },
    })
    fireEvent.click(screen.getByTestId('import-submit'))

    await waitFor(() =>
      expect(screen.getByTestId('import-success')).toHaveTextContent(/imported 1 song/i)
    )
  })

  it('shows an error when nothing parses', async () => {
    const onImport = vi.fn()
    render(<ImportPanel onImport={onImport} importing={false} />)

    fireEvent.change(screen.getByTestId('import-textarea'), {
      target: { value: 'gibberish without separators' },
    })
    fireEvent.click(screen.getByTestId('import-submit'))

    await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument())
    expect(onImport).not.toHaveBeenCalled()
  })

  it('exposes the bookmarklet code for copying', () => {
    render(<ImportPanel onImport={vi.fn()} importing={false} />)
    expect(screen.getByTestId('bookmarklet-code').value).toContain('javascript:')
  })
})
