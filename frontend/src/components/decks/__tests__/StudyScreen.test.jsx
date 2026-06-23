import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudyScreen from '../StudyScreen'

const baseProps = {
  card: { track_id: 1, spotify_id: 'abc', num_artists: 1, interval: 0 },
  result: null,
  grading: false,
  score: { correct: 0, wrong: 0 },
  progress: { remaining: 3, total: 3, masteredCount: 0 },
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
  onRate: vi.fn(),
  onMaster: vi.fn(),
}

function setup(overrides = {}) {
  const props = { ...baseProps, ...overrides }
  render(<StudyScreen {...props} />)
  return props
}

describe('StudyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one artist field and the title field', () => {
    setup()
    expect(screen.getByTestId('guess-artist-0')).toBeInTheDocument()
    expect(screen.getByTestId('guess-title')).toBeInTheDocument()
  })

  it('renders an artist field per artist', () => {
    setup({ card: { track_id: 2, spotify_id: 'x', num_artists: 2, interval: 0 } })
    expect(screen.getByTestId('guess-artist-0')).toBeInTheDocument()
    expect(screen.getByTestId('guess-artist-1')).toBeInTheDocument()
  })

  it('renders the Spotify embed with masks while unrevealed', () => {
    setup()
    const wrap = screen.getByTestId('embed-wrap')
    expect(wrap.querySelector('iframe')).toBeTruthy()
    expect(wrap.className).not.toContain('revealed')
    expect(wrap.querySelector('.embed-mask')).toBeTruthy()
  })

  it('shows text-only mode when there is no spotify id', () => {
    setup({ card: { track_id: 3, spotify_id: null, num_artists: 1, interval: 0 } })
    expect(screen.getByTestId('text-only')).toBeInTheDocument()
  })

  it('submits the typed guess', () => {
    const props = setup()
    fireEvent.change(screen.getByTestId('guess-artist-0'), { target: { value: 'Queen' } })
    fireEvent.change(screen.getByTestId('guess-title'), { target: { value: 'Bohemian Rhapsody' } })
    fireEvent.click(screen.getByTestId('guess-submit'))
    expect(props.onSubmit).toHaveBeenCalledWith(['Queen'], 'Bohemian Rhapsody')
  })

  it('calls the reveal handler and has no skip button', () => {
    const props = setup()
    expect(screen.queryByTestId('skip-btn')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('reveal-btn'))
    expect(props.onReveal).toHaveBeenCalled()
  })

  it('hides the Mastered button until revealed', () => {
    setup()
    expect(screen.queryByTestId('master-btn')).not.toBeInTheDocument()
  })

  it('shows the graded result, rating buttons and Mastered once revealed', () => {
    const props = setup({
      result: { correct: true, title: 'Song', artists: ['A'], interval: 1, mastered: false },
    })
    expect(screen.getByTestId('grade-result')).toHaveTextContent('Correct')
    expect(screen.queryByTestId('guess-submit')).not.toBeInTheDocument()
    expect(screen.getByTestId('rating-actions')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rate-good'))
    expect(props.onRate).toHaveBeenCalledWith('good')
    fireEvent.click(screen.getByTestId('master-btn'))
    expect(props.onMaster).toHaveBeenCalled()
  })
})
