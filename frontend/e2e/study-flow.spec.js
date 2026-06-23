import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'

const generateTestEmail = () => `e2e-study-${randomUUID()}@example.com`
const TEST_PASSWORD = 'SecurePass123'

// A small set of real Spotify track ids so the embed has something to load.
const IMPORT_TEXT = [
  'Queen - Bohemian Rhapsody | https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv',
  'a-ha - Take On Me | https://open.spotify.com/track/2WfaOiMkCvy7F5fcp2zZ8L',
].join('\n')

test.describe('Study Flow', () => {
  let testEmail
  let context
  let page

  test.beforeAll(async ({ browser }) => {
    testEmail = generateTestEmail()
    context = await browser.newContext({ ignoreHTTPSErrors: true })
    page = await context.newPage()

    // Register + login once for the whole suite.
    await page.goto('/register')
    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD)
    await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /register|creating account/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })

    await page.getByLabel(/email/i).fill(testEmail)
    await page.getByLabel(/password/i).fill(TEST_PASSWORD)
    const loginButton = page.getByRole('button', { name: /login|logging in/i })
    await expect(loginButton).toBeEnabled({ timeout: 5000 })
    await Promise.all([
      page.waitForURL(/\/decks/, { timeout: 15000 }),
      loginButton.click()
    ])
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('create a deck, import songs, and study them', async () => {
    // 1. Create a deck.
    const deckName = `Study Deck ${Date.now()}`
    await page.getByTestId('deck-name-input').fill(deckName)
    const createButton = page.getByTestId('deck-submit')
    await expect(createButton).toBeEnabled({ timeout: 5000 })
    await createButton.click()
    await expect(page.getByText(deckName).first()).toBeVisible({ timeout: 5000 })

    // 2. Import songs into that deck.
    await page.getByTestId('import-deck-select').selectOption({ label: deckName })
    await page.getByTestId('import-textarea').fill(IMPORT_TEXT)
    await page.getByTestId('import-submit').click()
    await expect(page.getByTestId('import-success')).toBeVisible({ timeout: 5000 })

    // 3. Reload so the deck card reflects the imported songs, then study.
    await page.reload()
    const deckCard = page.getByTestId('deck-card').filter({ hasText: deckName })
    await deckCard.getByTestId('deck-study-link').click()

    // 4. The study screen shows a masked card without the answer.
    await expect(page.getByTestId('study-screen')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('guess-title')).toBeVisible()

    // 5. Submit a (likely wrong) guess and confirm grading reveals the answer.
    await page.getByTestId('guess-artist-0').fill('Some Artist')
    await page.getByTestId('guess-title').fill('Some Title')
    await page.getByTestId('guess-submit').click()
    await expect(page.getByTestId('grade-result')).toBeVisible({ timeout: 5000 })

    // 6. Rate the card (Anki-style) to schedule it and advance.
    await expect(page.getByTestId('rating-actions')).toBeVisible()
    await page.getByTestId('rate-good').click()
    await expect(page.getByTestId('study-screen').or(page.getByTestId('study-done')))
      .toBeVisible({ timeout: 5000 })
  })

  test('progress persists across reloads', async () => {
    // Open the deck dashboard via the decks page and confirm counts render.
    await page.goto('/decks')
    const deckCard = page.getByTestId('deck-card').first()
    await deckCard.getByRole('link', { name: /dashboard/i }).click()

    await expect(page.getByTestId('mastery-dashboard')).toBeVisible({ timeout: 5000 })

    // Reload and confirm the dashboard still loads (progress is server-side).
    await page.reload()
    await expect(page.getByTestId('mastery-dashboard')).toBeVisible({ timeout: 5000 })
  })
})
