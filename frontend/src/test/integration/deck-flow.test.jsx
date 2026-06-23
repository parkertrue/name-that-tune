import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../../App'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
})
afterAll(() => server.close())

function renderAppAt(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )
}

describe('Study flow integration', () => {
  it('plays a card and grades a correct guess without leaking the answer early', async () => {
    const user = userEvent.setup()
    localStorage.setItem('access_token', 'mock-token')

    let graded = false
    server.use(
      http.get('/api/study/next', () => {
        if (graded) return HttpResponse.json({ done: true }, { status: 200 })
        return HttpResponse.json(
          {
            track_id: 42,
            spotify_id: 'abc123',
            num_artists: 1,
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            remaining: 1,
            total: 1,
            mastered_count: 0,
          },
          { status: 200 }
        )
      }),
      http.post('/api/study/grade', async ({ request }) => {
        const body = await request.json()
        graded = true
        return HttpResponse.json(
          {
            correct: body.guess_title === 'Bohemian Rhapsody',
            title: 'Bohemian Rhapsody',
            artists: ['Queen'],
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            mastered: false,
          },
          { status: 200 }
        )
      })
    )

    renderAppAt('/study/all')

    // Card loads; answer is NOT visible yet.
    await waitFor(() => expect(screen.getByTestId('study-screen')).toBeInTheDocument())
    expect(screen.queryByText('Bohemian Rhapsody')).not.toBeInTheDocument()

    await user.type(screen.getByTestId('guess-artist-0'), 'Queen')
    await user.type(screen.getByTestId('guess-title'), 'Bohemian Rhapsody')
    await user.click(screen.getByTestId('guess-submit'))

    // Now the graded answer is revealed.
    await waitFor(() =>
      expect(screen.getByTestId('grade-result')).toHaveTextContent('Correct')
    )
    expect(screen.getByTestId('grade-result')).toHaveTextContent('Bohemian Rhapsody')
  })
})
