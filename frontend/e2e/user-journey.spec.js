import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'

// Generate truly unique email for each test run
const generateTestEmail = () => `e2e-test-${randomUUID()}@example.com`
const TEST_PASSWORD = 'SecurePass123'

test.describe('Critical User Journey', () => {
  let testEmail

  test.beforeEach(() => {
    testEmail = generateTestEmail()
    console.log('Test email:', testEmail) // For debugging
  })

  test('complete user journey: register → login → create deck → logout', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto('/')
    await expect(page.getByText(/Name That Tune/i).first()).toBeVisible()

    // 2. Register new user - click "Get Started" button (primary CTA)
    await page.getByRole('link', { name: /get started/i }).click()
    await expect(page).toHaveURL(/\/register/)

    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)

    // Click register button
    await page.getByRole('button', { name: /register|creating account/i }).click()

    // Wait a moment for the request to process
    await page.waitForTimeout(2000)

    // Check if there's an error message (registration failed)
    const errorMessage = page.locator('.error-message, [data-testid="error-message"]').first()
    const hasError = await errorMessage.isVisible().catch(() => false)

    if (hasError) {
      const errorText = await errorMessage.textContent()
      console.error('Registration error:', errorText)
      throw new Error(`Registration failed: ${errorText}. Check screenshot and backend logs.`)
    }

    // Wait for redirect to login page (registration successful)
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })

    // 3. Login with newly created account
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/password/i).fill(TEST_PASSWORD)

    // Wait for login button to be enabled and ready
    const loginButton = page.getByRole('button', { name: /login|logging in/i })
    await expect(loginButton).toBeEnabled({ timeout: 5000 })

    // Click and wait for navigation
    await Promise.all([
      page.waitForURL(/\/decks/, { timeout: 15000 }),
      loginButton.click()
    ])
    await expect(page.getByRole('heading', { name: /name that tune/i })).toBeVisible()

    // 4. Create a deck
    const deckName = `Journey Deck ${Date.now()}`
    await page.getByTestId('deck-name-input').fill(deckName)
    const createButton = page.getByTestId('deck-submit')
    await expect(createButton).toBeEnabled({ timeout: 5000 })
    await createButton.click()

    // Verify deck appears in list
    await expect(page.getByText(deckName).first()).toBeVisible({ timeout: 5000 })

    // 5. Verify session persistence (page refresh)
    await page.reload()
    await expect(page).toHaveURL(/\/decks/)
    await expect(page.getByText(deckName).first()).toBeVisible()

    // 6. Logout - click dropdown, then logout option
    const logoutButton = page.getByRole('button', { name: /logout/i })
    await logoutButton.click()
    await page.getByText(/logout this device/i).click()

    // Should redirect to home or login page (both valid for logged out state)
    await page.waitForURL(/\/(login)?$/, { timeout: 10000 })

    // Verify user is logged out by checking they can't access decks
    await page.goto('/decks')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('cannot access protected routes without authentication', async ({ page }) => {
    // Try to access decks page directly
    await page.goto('/decks')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('nonexistent@example.com')
    await page.getByLabel(/password/i).fill('WrongPassword123')
    await page.getByRole('button', { name: /login|logging in/i }).click()

    // Should show error message (wait for it to appear)
    await expect(page.locator('.error-message, [data-testid="error-message"]').first()).toBeVisible({ timeout: 5000 })
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('registration with existing email shows error', async ({ page }) => {
    // First, register a user
    const existingEmail = `existing-${randomUUID()}@example.com`
    
    await page.goto('/register')
    await page.getByLabel(/email/i).fill(existingEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /register|creating account/i }).click()
    
    // Wait for registration to complete and redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    // Extra wait to ensure registration fully completes in database
    await page.waitForTimeout(1000)
    
    // Try to register again with same email
    await page.goto('/register')
    await page.getByLabel(/email/i).fill(existingEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /register|creating account/i }).click()
    
    // Should show error about email already existing
    await expect(page.locator('.error-message, [data-testid="error-message"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/register/)
  })
})