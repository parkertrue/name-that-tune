# Name That Tune

A Spotify-powered song-flashcard trainer for music-trivia prep. Build **decks** of songs, import tracks straight from a Spotify playlist, then **study**: a Spotify clip plays with the album art and title masked, you guess the artist(s) and title, and an Anki-style spaced-repetition engine retires songs as you master them.

Grading happens **server-side**, so the answer is never sent to the browser until you submit — the game can't be cheated by inspecting network traffic. Playback uses Spotify's **public embed iframe** (`open.spotify.com/embed/track/{id}`), so **no Spotify API credentials are required**.

**Stack**

* **Frontend**: React (Vite), React Router, Axios
* **Backend**: Flask + SQLAlchemy + Alembic, JWT auth, Pydantic validation
* **Database**: MySQL 8
* **Cache / sessions**: Redis (JWT refresh-token blocklist + caching)
* **Reverse proxy (prod)**: Nginx (HTTPS, security headers, rate limiting)
* **Containers**: Docker / Docker Compose (dev, test, prod)

---

## How It Works

1. **Import** — Run the in-app extractor bookmarklet on a Spotify playlist to copy its tracks as JSON, then paste into a deck. The parser also accepts loose `open.spotify.com/track/...` URLs or plain `Artist - Title` lines as fallbacks.
2. **Study** — A masked Spotify embed plays a clip. You type the artist(s) and title.
3. **Grade** — The backend fuzzy-matches your guess (case/punctuation-insensitive, handles `feat.`/`&`, requires every artist to be named) and reveals the answer.
4. **Rate** — You rate the card *Again / Hard / Good / Easy*. A session-local **SM-2** algorithm schedules how soon the card recurs; a card "graduates" (shown as **mastered**) once its interval reaches 21. Study a single deck or the virtual **All Songs** scope across every deck.

---

## Required Software

* **Docker & Docker Compose** — MySQL, Redis, and production builds. [Install](https://www.docker.com/products/docker-desktop/)
* **Python 3.12+** — Flask backend. [Install](https://www.python.org/downloads/)
* **Node.js 20+ (includes npm)** — React frontend (Vite). [Install](https://nodejs.org/)
* **Git Bash (Windows only)** — a Unix-like shell so the commands below match Linux/macOS. Installed with [Git for Windows](https://git-scm.com/download/win).

> ⚠️ **Windows users:** use Git Bash for all commands in this README.
> ⚠️ **All users:** make sure Docker is running before any `docker compose` command.

---

## Environment Files

Create these locally (they are **not** committed). Copy the matching block from [`.env.examples`](.env.examples):

| File | Purpose |
|------|---------|
| `.env.dev` | Development — local backend + frontend, Dockerized MySQL + Redis |
| `.env.test` | Integration/E2E testing — isolated Dockerized MySQL (3307) + Redis (6380) |
| `.env.prod` | Production — fully Dockerized |

Set strong, unique values for `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `REDIS_PASSWORD`, and `SECRET_KEY`, and use different credentials for each environment. Generate secure values with:

```bash
python3 -c "import uuid; print(uuid.uuid4().hex)"
```

---

## Development Mode

The database and Redis run in Docker; Flask and React run locally for hot reloading and easier debugging.

| Component | Where |
|-----------|-------|
| MySQL, Redis | Docker |
| Flask, React | Local machine |

### One-Time Setup

**1. Build the dev DB + Redis images:**

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml build
```

**2. Backend virtual environment** (from `backend/`):

```bash
python -m venv .venv
source .venv/Scripts/activate   # Windows (Git Bash)
source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
```

**3. Frontend dependencies** (from `frontend/`):

```bash
npm install
```

### Daily Workflow

Run each in its own terminal.

**Terminal 1 — Database + Redis:**

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up
```

MySQL is exposed on `127.0.0.1:3306`, Redis on `127.0.0.1:6379`.

**Terminal 2 — Backend** (from `backend/`):

```bash
./run_dev.sh
```

This loads `.env.dev`, activates the virtualenv if needed, waits for MySQL/Redis, runs `flask db upgrade`, and starts Flask.

**Terminal 3 — Frontend** (from `frontend/`):

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | [http://localhost:5173](http://localhost:5173) |
| Backend health | [http://localhost:5000/api/health](http://localhost:5000/api/health) |

### Database Schema Changes

After editing SQLAlchemy models (from `backend/`):

```bash
flask db migrate -m "describe change"
flask db upgrade
```

### Stopping Dev

`CTRL+C` in each terminal, then tear down the containers:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

---

## Testing

### Backend (from `backend/`)

```bash
./run_tests.sh unit          # Fast: SQLite in-memory, no Docker, Redis/rate-limiting disabled
./run_tests.sh integration   # Real MySQL (3307) + Redis (6380) via docker-compose.test.yml
./run_tests.sh combined      # All tests with a merged coverage report (htmlcov/)
./run_tests.sh all           # Unit + integration with separate reports
./run_tests.sh help          # All options (--verbose, --no-coverage)
```

Integration tests require Docker and a `.env.test` file in the project root.

### Frontend (from `frontend/`)

```bash
npm run test          # Watch mode
npm run test:run      # Run once (CI)
npm run test:coverage # Coverage report (coverage/)
```

Unit tests use Vitest + jsdom with **MSW** (Mock Service Worker) mocking the API at the network layer.

### End-to-End (from `frontend/`)

Playwright drives the full Dockerized stack over HTTPS. Start the stack with the `e2e` profile first:

```bash
docker compose --env-file .env.test -f docker-compose.test.yml --profile e2e up --build
```

Then, in another terminal:

```bash
npm run test:e2e          # Headless against https://localhost:8443
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:debug    # Step-through debugging
```

The e2e stack serves the app via Nginx on `8443` (HTTPS) and `8080` (HTTP). Self-signed cert errors are ignored by the test config.

---

## SSL / HTTPS

The production and e2e stacks run over HTTPS. Nginx ([`nginx/default.conf`](nginx/default.conf)) is already configured for TLS — it redirects HTTP→HTTPS, terminates TLS on 443, and adds HSTS/CSP/security headers. The only setup step is providing certificates in `nginx/certs/`.

### Self-Signed Certificate (local / production testing)

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/C=US/ST=California/L=San Francisco/O=Dev/CN=localhost"
```

Then start the production stack (below) and visit `https://localhost`, bypassing the browser warning (expected for self-signed certs).

### Let's Encrypt (real domain)

```bash
sudo apt install certbot                                    # Ubuntu/Debian
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Update `server_name` in [`nginx/default.conf`](nginx/default.conf), mount your `/etc/letsencrypt` certs into the `nginx` service in [`docker-compose.yml`](docker-compose.yml), and rebuild.

---

## Production Mode (Docker)

All services run in containers with resource limits and health checks.

| Component | Where |
|-----------|-------|
| MySQL, Redis | Docker |
| Flask (Gunicorn) | Docker |
| React | Built and served by Nginx |

**Build:**

```bash
docker compose --env-file .env.prod build
```

**Start:**

```bash
docker compose --env-file .env.prod up
```

The app is served at **[https://localhost](https://localhost)** (HTTP on port 80 redirects to HTTPS). Provide certs in `nginx/certs/` first — see [SSL / HTTPS](#ssl--https).

Frontend changes require a rebuild (React is compiled into `dist/` and served by Nginx):

```bash
docker compose --env-file .env.prod up --build
```

**Stop:**

```bash
docker compose --env-file .env.prod down
```

**Full reset (⚠️ deletes the database):**

```bash
docker compose --env-file .env.prod down --volumes --remove-orphans
```

---

## Architecture

### Request Flow

```
Browser → Nginx (80/443) → static React assets, or /api/* proxied to Flask (Gunicorn) → MySQL / Redis
```

### Backend (`backend/app/`)

* **`__init__.py`** — App factory; registers extensions (JWT, SQLAlchemy, CORS, Limiter, Redis) and blueprints.
* **`config.py`** — Per-environment config (`Development`, `Testing`, `Integration`, `Production`).
* **`routes/`** — API blueprints:
  * `auth` — `register`, `login`, `refresh`, `logout`, `logout-all` (refresh tokens via httpOnly cookies; revocation through a Redis blocklist).
  * `health` — `/api/health`.
  * `decks` — deck CRUD, bulk track import (`/<id>/tracks`), and `/<id>/reset`; `/decks/all` for the All Songs view.
  * `study` — `/study/next` (interval-weighted picker that withholds the answer) and `/study/grade` (two-step `guess`/`reveal` → `rate` flow, plus a `master` shortcut).
* **`models/`** — SQLAlchemy models (`User`, `Deck`, `Track`). Per-card SM-2 state lives on the `Track` row; `apply_review(quality)` implements classic SM-2 and `selection_weight()` makes shorter-interval cards recur sooner.
* **`schemas/`** — Pydantic request/response schemas.
* **`utils/`** — Redis service, error handlers, HTML sanitizer (nh3), and `matching.py` (the server-side fuzzy grader).
* **`migrations/`** — Alembic migrations for MySQL.

### Frontend (`frontend/src/`)

* **`api/`** — Central Axios instance + service modules (auth, decks).
* **`contexts/AuthContext`** — global auth state.
* **`hooks/`** — `useAuth`, `useDecks`, `useStudySession` (the study state machine).
* **`utils/`** — `importParser.js` (paste → tracks) and `bookmarklet.js` (the extractor source).
* **`components/decks/`** — `DeckList`/`DeckCard`/`DeckForm`, `ImportPanel`, `StudyScreen`, `GradeResult`, `MasteryDashboard`, each with co-located tests.
* **`pages/`** — `DecksPage`, `DeckDashboardPage`, `StudyPage`.

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Dev: MySQL (3306) + Redis (6379) only |
| `docker-compose.test.yml` | Test: isolated MySQL (3307) + Redis (6380); `e2e` profile adds backend + Nginx (8443/8080) |
| `docker-compose.yml` | Production: all services with resource limits and health checks |

---

## Environment Summary

| Mode | MySQL | Redis | Backend | Frontend | E2E proxy |
|------|-------|-------|---------|----------|-----------|
| Dev | Docker (3306) | Docker (6379) | Local | Local | — |
| Test (unit) | SQLite in-memory | Disabled | Local | Local (jsdom) | — |
| Test (integration/E2E) | Docker (3307) | Docker (6380) | Local / Docker | — | Nginx (8443) |
| Prod | Docker | Docker | Docker | Nginx | Nginx (443) |
