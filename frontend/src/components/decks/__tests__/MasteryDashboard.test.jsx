import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MasteryDashboard from '../MasteryDashboard'

const deck = {
  total: 2,
  mastered: 1,
  tracks: [
    { id: 1, title: 'Learning Song', artists: ['A'], interval: 1, ease_factor: 2.5, mastered: false },
    { id: 2, title: 'Done Song', artists: ['B'], interval: 21, ease_factor: 2.5, mastered: true },
  ],
}

describe('MasteryDashboard', () => {
  it('renders a delete button per track and reports the clicked track', () => {
    const onDeleteTrack = vi.fn()
    render(<MasteryDashboard deck={deck} onReset={vi.fn()} onDeleteTrack={onDeleteTrack} />)

    const deleteButtons = screen.getAllByTestId('track-delete')
    expect(deleteButtons).toHaveLength(2)

    fireEvent.click(deleteButtons[0])
    expect(onDeleteTrack).toHaveBeenCalledWith(deck.tracks[0])
  })
})
