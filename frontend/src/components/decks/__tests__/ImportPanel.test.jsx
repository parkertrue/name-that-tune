import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ImportPanel from '../ImportPanel'

describe('ImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Only the auto-dismiss test fakes timers; make sure it cannot leak into
    // the others, which rely on real ones via waitFor.
    vi.useRealTimers()
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

  it('clears the success message after 4 seconds', async () => {
    // Fake timers have to be in place before the component schedules its
    // dismissal timeout, otherwise that timeout lands on the real clock and
    // advancing the fake one does nothing. waitFor is avoided here for the
    // same reason -- an async act() flushes the import promise without
    // needing real timers.
    vi.useFakeTimers()
    const onImport = vi.fn().mockResolvedValue({ added: 1 })
    render(<ImportPanel onImport={onImport} importing={false} />)

    fireEvent.change(screen.getByTestId('import-textarea'), {
      target: { value: 'Queen - Bohemian Rhapsody' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('import-submit'))
    })

    expect(screen.getByTestId('import-success')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByTestId('import-success')).not.toBeInTheDocument()
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
