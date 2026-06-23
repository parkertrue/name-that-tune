import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '../../App'

// Create MSW server for this test file. The "All Songs" summary is fetched
// alongside the deck list, so provide a default handler the tests can rely on.
const server = setupServer(
  http.get('/api/decks/all', () =>
    HttpResponse.json({ total: 0, mastered: 0, active: 0 }, { status: 200 })
  )
)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
})

afterAll(() => {
  server.close()
})

// Helper to render App with MemoryRouter at a specific route
function renderAppAt(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

describe('Authentication Flow Integration Tests', () => {
  describe('Registration Flow', () => {
    it('should complete registration and show success message', async () => {
      const user = userEvent.setup()

      // Mock successful registration
      server.use(
        http.post('/api/auth/register', () => {
          return HttpResponse.json({ message: 'User created' }, { status: 201 })
        })
      )

      // Start at register page
      renderAppAt('/register')

      // Wait for form to be visible
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
      })

      // Fill registration form using labels (id attribute)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const registerButton = screen.getByRole('button', { name: /register/i })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'Password123')
      await user.type(confirmPasswordInput, 'Password123')
      await user.click(registerButton)

      // After successful registration, should redirect to login page
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should show error message on registration failure', async () => {
      const user = userEvent.setup()

      // Mock failed registration
      server.use(
        http.post('/api/auth/register', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'EMAIL_ALREADY_EXISTS',
                message: 'Email already registered'
              }
            },
            { status: 409 }
          )
        })
      )

      renderAppAt('/register')

      // Wait for form
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const registerButton = screen.getByRole('button', { name: /register/i })

      await user.type(emailInput, 'existing@example.com')
      await user.type(passwordInput, 'Password123')
      await user.type(confirmPasswordInput, 'Password123')
      await user.click(registerButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      expect(screen.getByTestId('error-message')).toHaveTextContent(/email already registered/i)
    })
  })

  describe('Login Flow', () => {
    it('should login and load user decks', async () => {
      const user = userEvent.setup()

      const mockDecks = [
        { id: 1, name: 'First deck', created_at: '2024-01-01T00:00:00Z', total: 3, mastered: 0, active: 3 },
        { id: 2, name: 'Second deck', created_at: '2024-01-02T00:00:00Z', total: 1, mastered: 1, active: 0 }
      ]

      // Mock successful login and decks fetch
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            {
              access_token: 'mock-access-token',
              refresh_csrf: 'mock-csrf-token'
            },
            { status: 200 }
          )
        }),
        http.get('/api/decks', ({ request }) => {
          const authHeader = request.headers.get('authorization')
          if (!authHeader) {
            return HttpResponse.json(
              { error: { code: 'AUTH_MISSING_TOKEN', message: 'No token provided' } },
              { status: 401 }
            )
          }
          return HttpResponse.json(mockDecks, { status: 200 })
        })
      )

      renderAppAt('/login')

      // Wait for login form
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'Password123')
      await user.click(loginButton)

      // Should display decks (name appears in the card and the import select)
      await waitFor(() => {
        expect(screen.getAllByText('First deck').length).toBeGreaterThan(0)
      }, { timeout: 3000 })
      expect(screen.getAllByText('Second deck').length).toBeGreaterThan(0)
    })

    it('should show error on invalid credentials', async () => {
      const user = userEvent.setup()

      // Mock failed login
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
              }
            },
            { status: 401 }
          )
        })
      )

      renderAppAt('/login')

      // Wait for login form
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'WrongPassword123')
      await user.click(loginButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
      })
      expect(screen.getByTestId('error-message')).toHaveTextContent(/invalid email or password/i)
    })
  })

  describe('Deck Operations', () => {
    it('should create a new deck', async () => {
      const user = userEvent.setup()

      // Mock authenticated session
      localStorage.setItem('access_token', 'mock-token')

      server.use(
        http.get('/api/decks', () => {
          return HttpResponse.json([], { status: 200 })
        }),
        http.post('/api/decks', async ({ request }) => {
          const body = await request.json()
          return HttpResponse.json(
            {
              id: 1,
              name: body.name,
              created_at: new Date().toISOString(),
              total: 0,
              mastered: 0,
              active: 0
            },
            { status: 201 }
          )
        })
      )

      renderAppAt('/decks')

      // Wait for decks page to load and empty state to appear
      await waitFor(() => {
        expect(screen.getByText(/no decks yet/i)).toBeInTheDocument()
      })

      // Create a deck - use testid for the button since text changes
      const deckInput = screen.getByTestId('deck-name-input')
      const addButton = screen.getByTestId('deck-submit')

      await user.type(deckInput, 'My new deck')

      // Wait for button to be enabled (it's disabled when input is empty)
      await waitFor(() => {
        expect(addButton).not.toBeDisabled()
      })

      await user.click(addButton)

      // Should display the new deck
      await waitFor(() => {
        expect(screen.getAllByText('My new deck').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Authentication State', () => {
    it('should maintain authentication across page refreshes', async () => {
      // Mock authenticated session
      localStorage.setItem('access_token', 'mock-token')

      const mockDecks = [
        { id: 1, name: 'Persisted deck', created_at: '2024-01-01T00:00:00Z', total: 2, mastered: 0, active: 2 }
      ]

      server.use(
        http.get('/api/decks', () => {
          return HttpResponse.json(mockDecks, { status: 200 })
        })
      )

      renderAppAt('/decks')

      // Should load decks without requiring login
      await waitFor(() => {
        expect(screen.getAllByText('Persisted deck').length).toBeGreaterThan(0)
      })
    })

    it('should redirect to login when token is missing', async () => {
      // No token in localStorage
      server.use(
        http.get('/api/decks', () => {
          return HttpResponse.json(
            { error: { code: 'AUTH_MISSING_TOKEN', message: 'No token provided' } },
            { status: 401 }
          )
        })
      )

      renderAppAt('/decks')

      // Should show login form or redirect message
      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /login/i }) ||
          screen.queryByText(/please log in/i) ||
          screen.queryByText(/unauthorized/i)
        ).toBeTruthy()
      }, { timeout: 3000 })
    })
  })
})