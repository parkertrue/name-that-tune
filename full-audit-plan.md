# Full Project Audit Plan

Comprehensive, systematic check of every file and system in the project.
Work through phases in order. Fix findings before advancing to the next phase —
later phases (tests, security) produce cleaner results on already-clean code.

Track findings inline: mark each item [ ] todo, [x] done, [~] deferred with reason.


---

## Prerequisites

Before starting, confirm:
- [x] `.venv` exists and dependencies are installed (`pip install -r requirements.txt`)
- [x] `.env.test` exists in project root (copy from `.env.examples`)
- [x] Docker is running (needed for Phases 4–5)
- [x] `pip-audit` installable (`pip install pip-audit`) — needed for Phase 3

---

## Phase 1 — Quick Static Fixes (no Docker, ~15–30 min)

Goal: clean up the easy surface issues before deeper analysis. These are cheap
to fix and make all subsequent phases faster and less noisy.

Run in this order — each command scopes itself to the full codebase.

### 1a. Debug statements → `/check-debug` ✅ DONE
Scope: `backend/app/`, `frontend/src/` (excluding test files)

Files most likely to have issues:
- `backend/app/__init__.py` — debug print block was removed; verify clean
- All 15 backend app files
- All 47 frontend src files

Results: No print()/pprint() in backend/app/. No console.log/warn/debugger in frontend/src/.
Two console.error() in LogoutDropdown.jsx are intentional error boundary logging — not debug.
ProductionConfig explicitly sets FLASK_DEBUG=False. docker-compose.yml and nginx are clean.
debug_redis.py (backend root) has prints but is already flagged for deletion in Phase 5a.

### 1b. Temporary comments → `/check-comments` ✅ DONE
Scope: `backend/app/`, `frontend/src/`

Key files to watch:
- `backend/app/__init__.py` — had inline dev notes in the removed print block
- `backend/app/routes/auth.py` — complex token logic; verify comments are accurate not stale
- `backend/tests/integration/test_redis_auth.py` — has `# In real implementation, would extract...`
  comment at line ~35 that may indicate incomplete test logic

Results:
- No TODO/FIXME/HACK/XXX/NOCOMMIT in any app or frontend file.
- Deleted 5 over-comments (restated obvious code): auth.py lines 63, 112, 132, 147; __init__.py line 71.
- All remaining comments are accurate and non-obvious — kept.
- test_redis_auth.py:35-36 stale dev note deferred to Phase 4a (test file, out of scope here).

### 1c. Ignore file gaps → `/check-ignores` ✅ DONE
Scope: `.gitignore`, `.dockerignore`, `git status`

Known gap to verify: `.env.examples` lists `MYSQL_PORT`/`REDIS_PORT` for test env but not dev/prod.
Not an ignore issue, but surface it here if it comes up.

Results:
- Both files are complete and consistent. No changes needed.
- `.dockerignore` is a proper superset of `.gitignore` — all extra entries are intentional
  (git metadata, README, compose files, dev scripts excluded from Docker images).
- All required entries present in both files: env files, nginx/certs/, .venv/, .coverage,
  .pytest_cache/, node_modules/, coverage/, playwright-report/, test-results/, __pycache__/.
- nginx/certs/ contains fullchain.pem and privkey.pem — both covered by the directory ignore.
- No sensitive untracked files. backend/debug_redis.py is untracked but non-sensitive;
  already flagged for deletion in Phase 5a.

---

## Phase 2 — Configuration & Environment Audit (no Docker, ~20 min)

### 2a. Environment variable completeness → `/check-env` ✅ DONE
Scope: `.env.examples`, `backend/app/config.py`

Results:
- Added `MYSQL_PORT=3306` and `REDIS_PORT=6379` to dev and prod sections of `.env.examples`.
- Added `E2E_MODE=true  # Uncomment...` comment-line to test section documenting the toggle.
- Changed `FLASK_DEBUG=1` → `FLASK_DEBUG=0` in test section; `IntegrationConfig` doesn't override
  it and there is no value in enabling the Flask debugger/reloader during integration tests.
- Replaced guessable placeholders (`password`, `SECRET_KEY=password`) with clearly-labeled
  `your_secret_key_here` / `your_db_password_here` / `your_redis_password_here` in dev and prod.
- Test section credentials (`testpass`, `testredispass`) are acceptable — test-only, non-guessable
  production values. `SECRET_KEY` renamed to `test-secret-key-for-ci-only` to make scope clear.
- `TestingConfig` structural issue: `super().__init__()` validates MySQL/Redis vars before overrides
  apply. `run_tests.sh` loads `.env.test` for all test types (line 115) to work around this.
  Running bare `pytest tests/unit/` without those vars in env will still fail. Deferred — the
  `run_tests.sh` workaround is documented and sufficient for now.

### 2b. Dependency audit → `/check-deps` ✅ DONE
Scope: `backend/requirements.txt`, `frontend/package.json`

Results:
- **Python CVEs fixed**: `cryptography` 46.0.3 → 46.0.6 (CVE-2026-26007, CVE-2026-34073),
  `Flask` 3.1.2 → 3.1.3 (CVE-2026-27205). `pip-audit` now clean.
- **JS CVEs fixed** via `npm audit fix`: `axios`, `flatted`, `picomatch`, `rollup` high-severity
  issues resolved.
- **JS moderate deferred**: `esbuild` ≤ 0.24.2 / `vite` moderate severity (dev server only,
  not a production risk). Fix requires `npm audit fix --force` which upgrades vite v5 → v8
  (breaking change). Deferred until vite v8 migration is planned.
- **Unused packages**: All Python packages have direct imports in `backend/app/`. All JS
  packages are used or are appropriate dev/build tooling.
- **Test-only in main deps**: `pytest`, `pytest-cov`, `pytest-flask` are in `requirements.txt`
  alongside app deps. Single-file convention is intentional for this template; not a blocker.

---

## Phase 3 — Security Audit (no Docker, ~30–45 min, uses Opus subagent)

### 3a. Full security review → `/security` ✅ DONE

10 findings. Fixed all HIGH and MEDIUM; LOW findings addressed or accepted.

**Fixes applied:**
- `backend/Dockerfile` — Added non-root user (`appuser`/`appgroup`) with `chown` + `USER` directive. (HIGH)
- `backend/app/config.py` — `ProductionConfig` `CORS_ORIGINS = None` is correct and intentional:
  Nginx serves both frontend and `/api/*` proxy under one domain, so all browser requests are
  same-origin and no CORS headers are needed. Not a finding. (HIGH — closed as not applicable)
- `backend/app/__init__.py` — Blocklist loader now fails **closed** (`return True`) when Redis is
  unavailable, forcing re-auth if Redis goes down instead of accepting all tokens. (MEDIUM)
- `backend/app/config.py` — `FLASK_DEBUG` base class now uses proper boolean parsing
  (`os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true')`) instead of raw string. (MEDIUM)
- `nginx/default.conf` — HSTS `max-age` increased from 86400 (1 day) to 31536000 (1 year)
  across all location blocks. (MEDIUM)
- `nginx/default.conf` — Added `X-Frame-Options` and `X-Content-Type-Options` to static assets
  location block. (LOW)
- `backend/app/__init__.py` — Redis init error log no longer includes exception (which could
  contain the Redis password). (LOW)
- `frontend/src/utils/storage.js` — Added accepted-risk comment explaining why localStorage
  is used for the access token and what mitigations are in place. (MEDIUM/accepted)

**Deferred / accepted:**
- CSP `unsafe-inline` on script-src (Finding 6 LOW) — Required by Vite SPA builds. Accepted.
- TestingConfig unused env var validation (Finding 10 LOW) — Design quirk documented in Phase 2a.
  Accepted; `run_tests.sh` workaround is in place.

---

## Phase 4 — Test Suite Audit (comprehensive)

This phase reviews every test file for correctness, coverage, and consistency
before executing anything. Fix structural issues first, then run.

Total test inventory: 288 backend tests + ~608 frontend unit tests + 14 E2E tests.

---

### 4a. Backend — Structural correctness ✅ DONE

**`backend/tests/unit/test_schemas/test_notes_schema.py`** — MISPLACED TESTS ✅ FIXED
Removed `TestNoteModel` class (16 tests, all duplicates of `test_notes_model.py`).
`TestCreateNoteRequestSchema` is now the only class in the file. Cleaned up imports.

**`backend/tests/integration/test_redis_auth.py:63`** — SUSPECTED BROKEN TEST ✅ VERIFIED OK
Test already had a login step at line 47–55 before the logout call. Flask test client
maintains cookies between requests, so the refresh cookie is properly sent on logout.
Removed stale dev comment (lines 35–36) from `test_login_stores_refresh_token_in_redis`.

**`backend/tests/unit/test_routes/test_auth_routes.py` — CSRF token coverage** ✅ FIXED
Added docstring to `TestRefreshTokenRotation` documenting that old token revocation
is Redis behavior tested in `test_redis_auth.py`, not in unit tests.

**`backend/app/config.py` — port type bug** ✅ FIXED (found during test run)
`DB_PORT` and `REDIS_PORT` were stored as strings from `os.getenv()`. Tests expected
integers. Fixed with `int(os.getenv('MYSQL_PORT', '3306'))` / `int(os.getenv('REDIS_PORT',
'6379'))`. Also added default port values (3306/6379) so tests can omit those env vars.
All 272 unit tests now pass (was 264 passing + 8 failing).

---

### 4b. Backend — Coverage gaps

**`notes.py` routes — GET and POST only**
The route file only implements `GET /api/notes` and `POST /api/notes`. There are no
PUT/PATCH or DELETE endpoints. However, `frontend/e2e/notes-crud.spec.js` has:
- `test('can update a note', ...)`
- `test('can delete a note', ...)`
These E2E tests will fail against the real backend. Decision required:
Option A — implement update/delete routes and add tests at all levels.
Option B — remove those E2E tests until the feature is built.
This must be resolved before E2E tests run. Mark as blocker.

**`backend/tests/unit/test_routes/test_auth_routes.py` — Redis-disabled behavior**
Unit tests run with `TestingConfig` where `REDIS_ENABLED = False`, meaning
`redis_service is None` for all auth tests. The auth routes have `if redis_service:` guards
everywhere, so they silently skip token storage. This means unit tests never exercise the
`redis_service` call paths in `auth.py`. Confirm that the integration tests in
`test_redis_auth.py` fully cover those paths (they do for storage/rotation/revocation,
but there is no integration test for the `if not success: raise RuntimeError(...)` path
in login/refresh if `store_refresh_token` fails). Consider adding this case.

**`backend/tests/unit/test_config.py`** — `IntegrationConfig` CSRF behavior
`test_integration_config_with_e2e_mode` exists, but confirm it tests that
`JWT_COOKIE_CSRF_PROTECT = False` when `E2E_MODE != 'true'` and
`JWT_COOKIE_CSRF_PROTECT = True` when `E2E_MODE = 'true'`. This was newly added to
`IntegrationConfig` and is a security-relevant toggle.

---

### 4c. Frontend — Structural correctness

**`frontend/src/test/integration/auth-flow.test.jsx`** — VERIFY DISCOVERY
This file lives at `src/test/integration/` — check `vitest.config.js` `include` pattern
to confirm Vitest picks it up. If the pattern is `src/**/__tests__/**` or
`src/**/*.test.{js,jsx}`, the file is discovered. If the pattern excludes `src/test/`,
it silently doesn't run. Read `vitest.config.js` to confirm.

**`frontend/src/api/__tests__/api.test.js` — THIN (5 tests)**
Only tests Axios configuration (baseURL, headers, interceptor presence). Does not test:
- Refresh token interceptor behavior — when a 401 is received, does it retry with a
  refreshed token? This is the most critical frontend auth path.
- CSRF token header (`X-CSRF-REFRESH-TOKEN`) being sent on refresh calls
- What happens when the refresh itself returns 401 (should force logout)
Read `api.js` to understand the interceptor logic, then audit whether it's tested.

---

### 4d. Frontend — Coverage gaps by layer

**API services layer:**

`notesService.test.js` — 6 tests (vs. 38 for authService)
Missing coverage:
- 401 Unauthorized response (token expired mid-session)
- 422 validation error from backend sanitizer
- Network failure during note creation
- Service-level behavior when response shape is unexpected

`healthService.test.js` — 3 tests
Missing coverage:
- Non-200 status response
- Network timeout
These are low-priority given health is read-only, but worth adding for consistency.

**Hooks layer:**

`useAuth.test.jsx` — 4 tests
The hook is a thin wrapper over `AuthContext`, so 4 tests is likely sufficient.
Verify the tests cover: reading context values, the error thrown outside provider.
No gaps found in current test list, but confirm by reading the source.

`useNotes.test.jsx` — 11 tests
Missing:
- `addNote` error state properly clears on next successful add
- Behavior when `loadNotes` is called while already loading (race condition guard)
These are edge cases; flag but don't block.

**Context layer:**

`AuthContext.test.jsx` — 9 tests
Missing:
- Token refresh flow — does AuthContext expose or trigger a refresh mechanism?
  Read `AuthContext.jsx` to determine if a refresh function exists before flagging this.
- Token expiry detection — is expired token handled in context or in the Axios interceptor?
  Wherever it lives, that path needs a test.

**Component layer — gaps:**

`NotesList.test.jsx` — 18 tests
Missing: behavior when a note has content that was sanitized server-side (e.g., rendered
as plain text after XSS stripping). Confirm components use text rendering not innerHTML.

`LogoutDropdown.test.jsx` — 41 tests (well covered)
`NoteForm.test.jsx` — 64 tests (well covered)
`Navbar.test.jsx` — 37 tests (well covered)
`LoginPage.test.jsx` — 47 tests (well covered)
`RegisterPage.test.jsx` — 52 tests (well covered)

`HomePage.test.jsx` — 20 tests
Missing: what renders when `useHealth` is in the `checking` state vs error state.
Current tests check both but confirm the `checking` initial state case is covered.

**Pages layer — `NotesPage.test.jsx`** — 20 tests
Missing: what happens when `addNote` receives a 422 (validation/XSS rejection from backend).
The test `should display error when note creation fails` covers generic error — confirm it
specifically tests the 422 error code message path as well.

---

### 4e. Frontend — MSW handler completeness

MSW handlers mock the backend API. If a handler is missing for an endpoint a test
exercises, the request falls through and the test behavior is undefined.

Read `frontend/src/test/setup.js` and identify all MSW handlers defined.
Verify handlers exist for every endpoint used across all test files:
- `POST /api/auth/register` ✓ (authService tests)
- `POST /api/auth/login` ✓ (authService tests)
- `POST /api/auth/logout` ✓ (authService tests)
- `POST /api/auth/logout-all` ✓ (authService tests)
- `POST /api/auth/refresh` — verify handler exists; used by Axios interceptor on 401
- `GET /api/notes` ✓ (notesService tests)
- `POST /api/notes` ✓ (notesService tests)
- `GET /api/health` ✓ (healthService tests)
- Error scenarios (401, 422, 500, network failure) — verify each has a handler or
  uses MSW's `HttpResponse` error helpers

---

### 4f. E2E — Spec file audit

**`notes-crud.spec.js` — BROKEN (2 tests will fail)**
`can update a note` and `can delete a note` test against endpoints that don't exist in
`backend/app/routes/notes.py`. These tests will fail at the network layer.
Must be resolved in Phase 4b (implement routes or remove tests) before running E2E.

**`user-journey.spec.js` — 4 tests**
`complete user journey: register → login → create note → logout` — core happy path. ✓
`cannot access protected routes without authentication` — security path. ✓
`login with invalid credentials shows error` — error path. ✓
`registration with existing email shows error` — duplicate registration. ✓
Missing: token refresh mid-session (long-running session), logout-all from multiple sessions.
These are complex to automate in E2E and can be deferred.

**`health-check.spec.js` — 4 tests**
`registration API returns expected response` — this hits the real API, not the frontend.
Confirm this is intentional (it is: it's a smoke test). ✓

---

### 4g. Cross-layer consistency checks

These require reading paired source + test files side by side.

**Password validation consistency:**
`utils/validation.js` frontend validator vs. `schemas/auth.py` Pydantic validator.
Both must enforce the same rules: min 8, max 128, uppercase, lowercase, number.
`validation.test.js` has 60 tests — verify the boundary values (exactly 8, exactly 128)
match what `test_auth_schema.py` tests.

**Error code consistency:**
Backend returns error codes like `AUTH_INVALID_TOKEN`, `VALIDATION_ERROR`, etc. from
`utils/errors.py`. Frontend `errors.js` parses these. Verify:
- Every error code the backend can return has a corresponding test in `test_errors.py`
- `errors.test.js` frontend tests cover the same code strings
- No error code is tested on one side but not the other

**XSS sanitization consistency:**
The sanitizer is tested in `test_sanitizer.py` (30 tests), schema-level in
`test_notes_schema.py`, route-level in `test_notes_routes.py` (`TestNotesXSS` — 9 tests),
and `NoteForm.test.jsx` covers frontend validation.
Verify the exact same XSS patterns are tested at every layer (script tag, event handler,
javascript: protocol, SVG onload). If a pattern is tested at the sanitizer unit level but
not at the route level, flag it.

**Fixture consistency:**
`conftest.py` defines both unit fixtures (`client`, `db`, `sample_user`) and integration
fixtures (`integration_client`, `integration_db`, `integration_user`). Verify:
- No test file mixes unit and integration fixtures accidentally
- `integration_user` email (`integration@test.com`) is consistent across all integration tests
- `sample_user` email (`test@example.com`) is consistent across all unit tests

---

### 4h. Test execution (after all fixes from 4a–4g are applied)

Run in this order. Do not advance if tests fail.

```bash
# Backend unit (fast, no Docker)
cd backend && ./run_tests.sh unit

# Frontend unit (fast, no Docker)
cd frontend && npm run test:run

# Backend integration (Docker required)
cd backend && ./run_tests.sh integration

# Combined coverage report
cd backend && ./run_tests.sh combined

# E2E (Docker required, requires nginx/certs/)
cd frontend && npm run test:e2e
```

For each run: record pass/fail count and coverage %. Note any uncovered lines in
`backend/app/` that should have test coverage and flag for addition.

### 4h. Results (2026-06-22 re-verification) ✅ DONE

- Backend unit: **272/272 passed**.
- Frontend unit: **421/421 passed** (23 test files).
- Backend integration: **4/4 passed** (MySQL + Redis via `docker-compose.test.yml`).
- E2E: **14/14 passed** after fixing 3 infra bugs found during this run (all now fixed):
  1. `frontend/playwright.config.js` — `webServer.command` prefixed the docker compose
     command with bash-style `E2E_MODE=true `, which fails on Windows (cmd.exe). The
     `env:` block already set it for the child process; removed the redundant prefix.
  2. `frontend/playwright.config.js` — `webServer.command` referenced `.env.test` and
     `docker-compose.test.yml` as if cwd were the repo root, but Playwright runs it from
     `frontend/`. Added `cwd: '..'`.
  3. `docker-compose.test.yml` — the `backend` service's `env_file: .env.test` carries
     `MYSQL_HOST=localhost`/`REDIS_HOST=localhost` and `MYSQL_PORT=3307`/`REDIS_PORT=6380`,
     which are correct for the *host* (pytest connecting via mapped ports) but wrong
     *inside* the backend container, where MySQL/Redis live at the `db`/`redis` service
     names on their container-internal ports 3306/6379. Backend looped forever on
     "MySQL not ready" / crashed on migration. Added an `environment:` override on the
     `backend` service (`MYSQL_HOST: db`, `MYSQL_PORT: 3306`, `REDIS_HOST: redis`,
     `REDIS_PORT: 6379`) — `environment:` takes precedence over `env_file:`.
  4. `frontend/e2e/health-check.spec.js` — two tests hardcoded `https://localhost`
     (port 443) instead of using the configured `baseURL` (`https://localhost:8443`,
     since nginx maps 8443→443 in the test stack). Port 443 isn't published on the host,
     so both always failed. Changed to relative paths (`/api/health`, `/api/auth/register`).
  5. Also rebuilt the `backend_test` image — it was stale (built before `IntegrationConfig`/
     `FLASK_ENV=integration` support existed in `config.py`), causing a `ValueError` on
     startup. `docker compose up` does not rebuild automatically; use `--build` or
     `docker compose build` after backend source changes.

**Confirmed (not fixed) — dead E2E coverage:** `notes-crud.spec.js` `can update a note`
and `can delete a note` both pass, but trivially: each guards its assertions behind
`if (await editButton.isVisible())` / `if (await deleteButton.isVisible())`. Since
`backend/app/routes/notes.py` only implements GET/POST (no PUT/PATCH/DELETE — see 4b)
and the frontend has no edit/delete UI, the button is never visible, the `if` body never
runs, and the test exits green without asserting anything. This is the same blocker as
4b/4f, just manifesting as a false-positive pass instead of a failure. Decision still
needed: implement update/delete end-to-end, or rewrite these two tests to assert the
feature is absent (or delete them) so they stop reporting false coverage.

---

## Phase 5 — Code Quality & Obsolescence (no Docker, ~20 min)

### 5a. Dead code and unused files → `/check-obsolete`
Specific known items to address:
- `backend/debug_redis.py` — temporary debug file, should be deleted
- Deleted integration test files — confirm they are fully replaced by `test_redis_auth.py`
  and the new unit test structure under `tests/unit/test_routes/`

### 5b. Verify new unit test routes structure
`backend/tests/unit/test_routes/` is new (untracked). Confirm:
- It contains test files for auth, health, and notes routes
- These replace the deleted `tests/integration/test_routes/` files at the unit level
- Coverage is equivalent or better

---

## Phase 6 — Documentation (no Docker, ~15 min)

### 6a. README audit → `/check-readme`
Key sections to verify after the integration testing feature:
- Test commands table — `./run_tests.sh` options have changed significantly
  (old: `all/unit/integration/models/schemas/routes/auth/notes`, new: `all/unit/integration/combined`)
- E2E test setup — now uses `docker-compose.test.yml --profile e2e`, not `docker-compose.yml`
- Environment files section — `.env.test` is now a required file; should be documented
- Ports table — Playwright now targets `https://localhost:8443`, not `https://localhost`

### 6b. CLAUDE.md review
Confirm the Commands section added in this session is accurate and complete.
No other sections should need updating for this feature.

---

## Scope: Full File Inventory

Every file that must be reviewed before this audit is complete.

### Backend application (15 files)
- [ ] `backend/app/__init__.py`
- [ ] `backend/app/config.py`
- [ ] `backend/app/routes/__init__.py`
- [ ] `backend/app/routes/auth.py`
- [ ] `backend/app/routes/health.py`
- [ ] `backend/app/routes/notes.py`
- [ ] `backend/app/models/__init__.py`
- [ ] `backend/app/models/auth.py`
- [ ] `backend/app/models/notes.py`
- [ ] `backend/app/schemas/__init__.py`
- [ ] `backend/app/schemas/auth.py`
- [ ] `backend/app/schemas/notes.py`
- [ ] `backend/app/utils/errors.py`
- [ ] `backend/app/utils/redis_service.py`
- [ ] `backend/app/utils/sanitizer.py`

### Backend tests (new/changed)
- [ ] `backend/tests/conftest.py`
- [ ] `backend/tests/integration/test_redis_auth.py`
- [ ] `backend/tests/unit/test_routes/` (all files — new, untracked)
- [ ] `backend/tests/unit/test_config.py`
- [ ] `backend/tests/unit/test_utils/test_redis_service.py`

### Backend config/scripts
- [ ] `backend/run_tests.sh`
- [ ] `backend/requirements.txt`

### Frontend application (key files)
- [ ] `frontend/src/api/api.js`
- [ ] `frontend/src/api/errors.js`
- [ ] `frontend/src/api/services/authService.js`
- [ ] `frontend/src/api/services/notesService.js`
- [ ] `frontend/src/api/services/healthService.js`
- [ ] `frontend/src/contexts/AuthContext.jsx`
- [ ] `frontend/src/utils/storage.js`
- [ ] `frontend/src/utils/validation.js`
- [ ] `frontend/src/hooks/useAuth.js`
- [ ] `frontend/src/hooks/useNotes.js`
- [ ] `frontend/src/hooks/useHealth.js`
- [ ] `frontend/src/components/auth/ProtectedRoute.jsx`
- [ ] `frontend/src/components/layout/Navbar.jsx`
- [ ] `frontend/src/components/layout/Layout.jsx`
- [ ] `frontend/src/components/layout/LogoutDropdown.jsx`
- [ ] `frontend/src/components/notes/NoteForm.jsx`
- [ ] `frontend/src/components/notes/NotesList.jsx`
- [ ] `frontend/src/pages/HomePage.jsx`
- [ ] `frontend/src/pages/LoginPage.jsx`
- [ ] `frontend/src/pages/RegisterPage.jsx`
- [ ] `frontend/src/pages/NotesPage.jsx`
- [ ] `frontend/src/App.jsx`
- [ ] `frontend/src/main.jsx`
- [ ] `frontend/src/test/integration/auth-flow.test.jsx` (new)

### Frontend config
- [ ] `frontend/package.json`
- [ ] `frontend/playwright.config.js`
- [ ] `frontend/vite.config.mjs`
- [ ] `frontend/vitest.config.js`

### Infrastructure
- [ ] `nginx/default.conf`
- [ ] `nginx/nginx.conf`
- [ ] `nginx/proxy_params.conf`
- [ ] `nginx/Dockerfile`
- [ ] `backend/Dockerfile`
- [ ] `docker-compose.yml`
- [ ] `docker-compose.dev.yml`
- [ ] `docker-compose.test.yml`

### Project root
- [ ] `.env.examples`
- [ ] `.gitignore`
- [ ] `.dockerignore`
- [ ] `README.md`
- [ ] `CLAUDE.md`

---

## Known Issues to Resolve (carried from prior review)

These were identified in the integration testing feature review and must be
addressed during this audit, not deferred:

- [x] `.env.examples` — placeholder credentials in dev/prod sections (`SECRET_KEY=password`)
      should use clearly-labeled placeholders, not guessable values
- [x] `.env.examples` — `MYSQL_PORT`/`REDIS_PORT` missing from dev and prod sections
- [x] `.env.examples` — `FLASK_DEBUG=1` in test section; clarify intent
- [ ] `test_redis_auth.py:63` — `test_logout_revokes_token_in_redis` may not pass a session
      cookie to the logout endpoint, making the assertion unreliable
- [ ] `run_tests.sh` — `sleep 10` readiness wait; consider `docker compose up --wait`
- [ ] `backend/debug_redis.py` — temporary file, delete
