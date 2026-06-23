# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Name That Tune** — a Spotify-powered song-flashcard trainer for trivia prep, built on a full-stack template: React (Vite) frontend, Flask backend, MySQL database, Redis caching, Nginx reverse proxy. Three Docker Compose environments: dev, test, and production.

Users create **decks** of songs, import tracks (via the Spotify playlist-extractor bookmarklet, which produces JSON pasted into the app), then **study**: a Spotify embed plays a clip with the album art + title masked, the user guesses the artist(s) and title, and an Anki-style adaptive weighting retires "mastered" songs. Answer grading happens server-side so answers stay hidden until submitted. Playback uses Spotify's **public embed iframe** (`open.spotify.com/embed/track/{id}`) — no Spotify API credentials are required.

## Environment Setup

Copy `.env.examples` to create `.env.dev`, `.env.prod`, and `.env.test` before running any environment.

## Development Workflow

**Step 1 — Start DB and Redis (Terminal 1):**
```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up
```

**Step 2 — Start backend (Terminal 2):**
```bash
cd backend && ./run_dev.sh
```

**Step 3 — Start frontend (Terminal 3):**
```bash
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/health

First-time setup: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` and `cd frontend && npm install`.

## Running Tests

### Backend
```bash
cd backend
./run_tests.sh unit              # Fast, SQLite in-memory, no Docker required
./run_tests.sh integration       # Real MySQL + Redis (spins up docker-compose.test.yml)
./run_tests.sh combined          # All tests with merged coverage report
./run_tests.sh unit --verbose    # Verbose output
./run_tests.sh unit --no-coverage
```

### Frontend
```bash
cd frontend
npm run test          # Watch mode
npm run test:run      # Run once (CI)
npm run test:coverage
npm run test:e2e      # Playwright against dockerized stack (https://localhost:8443)
npm run test:e2e:ui
npm run test:e2e:debug
```

### Running a single backend test
```bash
cd backend
source .venv/bin/activate
pytest tests/unit/test_routes/test_auth_routes.py::TestClassName::test_method_name -v
```

## Custom Commands

Slash commands for quality checks. Run these on demand — never automatically.

| Command | When to run |
|---------|-------------|
| `/security` | After any auth, config, or infra change; before every release |
| `/check-tests` | After adding or modifying any feature |
| `/check-readme` | After significant feature, architecture, or config changes |
| `/check-ignores` | When adding new file types, services, or dependencies |
| `/check-obsolete` | Periodically, or before a release |
| `/check-comments` | Before any PR or release |
| `/check-debug` | Before any PR or release |
| `/check-deps` | After adding/updating dependencies; before every release |
| `/check-env` | After adding new env variables or config classes |
| `/pre-publish` | Before any public release — runs all checks above in sequence |

The instructions for these commands live in `.claude/commands/`. To update a check (e.g., new file patterns to scan, new security rules), edit the corresponding file there.

## Production Build
```bash
docker compose --env-file .env.prod build
docker compose --env-file .env.prod up
```

## Architecture

### Request Flow
Browser → Nginx (port 80/443) → static React assets or `/api/*` proxied to Flask (Gunicorn) → MySQL/Redis

### Backend (`backend/app/`)
- **`__init__.py`** — App factory. Registers all Flask extensions (JWT, SQLAlchemy, CORS, Limiter, Redis) and blueprints.
- **`config.py`** — Config classes per environment (`DevelopmentConfig`, `TestingConfig`, `IntegrationConfig`, `ProductionConfig`). Controls DB URI, Redis usage, rate limiting, JWT settings.
- **`routes/`** — API blueprints: `auth` (login/register/logout/refresh), `health`, `decks` (deck CRUD + bulk track import + reset), `study` (`/study/next` interval-weighted picker that withholds the answer, `/study/grade` for the two-step `guess`/`reveal` → `rate` flow, plus the `master` shortcut). `/study/next?deck_id=all` studies across every deck (the virtual "All Songs" scope).
- **`models/`** — SQLAlchemy ORM models (User, Deck, Track). Auth logic lives on the User model; per-user study progress lives on the Track row as session-local SM-2 state (`ease_factor`, `interval`, `repetitions`, `mastered`), with `apply_review(quality)` implementing classic SM-2 (`INITIAL_EASE=2.5`, floor `MIN_EASE=1.3`; interval 1 → 6 → round(interval × ease); a lapse resets interval/repetitions). A card "graduates" — surfaced in the UI as `mastered` — once its interval reaches `GRADUATION_INTERVAL=21`. The Anki-style ratings map to SM-2 quality via `quality_for_rating` (again→1, hard→3, good→4, easy→5), and `selection_weight()` makes shorter-interval cards recur sooner within a session.
- **`schemas/`** — Pydantic schemas for request validation (deck, track/import, grade).
- **`utils/`** — Redis service (JWT blocklist + caching), error handlers, HTML sanitizer (`InputSanitizer.sanitize_text`), and `matching.py` (the server-side fuzzy answer grader).
- **`migrations/`** — Alembic migrations for MySQL.

### Frontend (`frontend/src/`)
- **`api/`** — Centralized Axios instance + service modules (auth, health, decks). All backend calls go through here.
- **`contexts/AuthContext`** — Global auth state (user, tokens, login/logout).
- **`hooks/`** — `useAuth`, `useHealth`, `useDecks` (deck list/create/delete/import), `useStudySession` (the study state machine: next/submitGuess/reveal/rate/master/skip).
- **`utils/`** — `importParser.js` (bookmarklet JSON → Spotify-URL → plain-text fallback) and `bookmarklet.js` (the extractor bookmarklet source).
- **`components/decks/`** — `DeckList`/`DeckCard`/`DeckForm`, `ImportPanel`, `StudyScreen` (masked Spotify embed + guess inputs), `GradeResult`, `MasteryDashboard`. Each with co-located unit tests in `__tests__/`.
- **`pages/`** — `DecksPage` (`/decks`), `DeckDashboardPage` (`/decks/:id`), `StudyPage` (`/study/:deckId`).
- **`e2e/`** — Playwright tests for full user journeys (`study-flow.spec.js`, `user-journey.spec.js`).

### Test Architecture
- **Backend unit tests**: `TestingConfig` uses SQLite in-memory, disables Redis and rate limiting. Fixtures in `tests/conftest.py`.
- **Backend integration tests**: `IntegrationConfig` connects to real MySQL (port 3307) and Redis (port 6380) from `docker-compose.test.yml`.
- **Frontend unit tests**: Vitest + jsdom + MSW (Mock Service Worker) for API mocking. Setup in `src/test/setup.js`.
- **E2E tests**: Playwright against the full stack via `docker-compose.test.yml` with the `e2e` profile. Ignores self-signed TLS cert errors.

### Docker Compose Files
| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Dev: MySQL + Redis only (backend/frontend run locally) |
| `docker-compose.test.yml` | Test: isolated MySQL (3307) + Redis (6380); `e2e` profile adds backend + Nginx |
| `docker-compose.yml` | Production: all services with resource limits and health checks |
