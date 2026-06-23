import pytest
import time
from datetime import timedelta
from flask_jwt_extended import create_access_token, create_refresh_token

import app as _app_module
from app import create_app, db as _db
from app.models import User, Deck, Track


# ============================================================================
# UNIT TEST FIXTURES (Fast, SQLite in-memory, no Redis)
# ============================================================================

@pytest.fixture(scope='session')
def app():
    """Unit test app - fast SQLite in-memory, no real services needed

    Uses TestingConfig which:
    - Sets FLASK_ENV=testing
    - Uses SQLite in-memory (no MySQL needed)
    - Disables Redis
    - Disables rate limiting

    Note: Config reads from environment, but TestingConfig overrides with
    in-memory SQLite regardless of MYSQL_* env vars.
    """
    import os

    # Only set FLASK_ENV to trigger TestingConfig
    # All other config is handled by TestingConfig defaults
    os.environ['FLASK_ENV'] = 'testing'

    # SECRET_KEY must be set as it's required by Config base class
    if 'SECRET_KEY' not in os.environ:
        os.environ['SECRET_KEY'] = 'test-secret-key-12345'

    app = create_app()

    with app.app_context():
        yield app


@pytest.fixture(scope='function')
def db(app):
    """Unit test database - SQLite in-memory"""
    with app.app_context():
        # Enable foreign keys for SQLite
        from sqlalchemy import event
        from sqlalchemy.engine import Engine

        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Unit test client"""
    return app.test_client()


# ============================================================================
# INTEGRATION TEST FIXTURES (Real MySQL + Redis from docker-compose.test.yml)
# ============================================================================

@pytest.fixture(scope='session')
def integration_app():
    """Integration test app - uses real MySQL + Redis

    Uses IntegrationConfig which:
    - Reads MySQL/Redis connection details from environment (loaded by run_tests.sh)
    - Connects to test services on ports 3307 (MySQL) and 6380 (Redis)
    - Disables rate limiting for test speed
    - Enables CORS for testing

    Note: Environment variables should be loaded by run_tests.sh from .env.test.
    If running pytest directly, ensure .env.test is loaded first.
    """
    import os

    # Set integration mode
    os.environ['FLASK_ENV'] = 'integration'

    # Verify critical env vars are set
    required_vars = ['MYSQL_DATABASE', 'MYSQL_HOST', 'REDIS_HOST']
    missing = [v for v in required_vars if v not in os.environ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {missing}\n"
            f"Make sure to run tests with ./run_tests.sh which loads .env.test"
        )

    app = create_app()

    with app.app_context():
        # Wait for test services to be ready
        max_retries = 30
        retry_delay = 1

        for attempt in range(1, max_retries + 1):
            try:
                # Test database connection
                _db.engine.connect()

                # Test Redis connection (if enabled)
                if _app_module.redis_service:
                    _app_module.redis_service.get_client().ping()
                    print(
                        f"✅ Test services ready (attempt {attempt}/{max_retries})")
                else:
                    print(f"⚠️  Redis is disabled in IntegrationConfig")

                break

            except Exception as e:
                if attempt == max_retries:
                    raise RuntimeError(
                        f"Test services not ready after {max_retries} attempts ({max_retries}s). "
                        f"Error: {e}\n"
                        f"Make sure 'docker compose -f docker-compose.test.yml up -d' is running."
                    )
                time.sleep(retry_delay)

        yield app


@pytest.fixture(scope='function')
def integration_db(integration_app):
    """Integration test database - real MySQL

    Creates fresh schema before each test and drops it after.
    This ensures test isolation.
    """
    with integration_app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def integration_client(integration_app, integration_db):
    """Integration test client"""
    return integration_app.test_client()


@pytest.fixture(scope='function')
def integration_redis(integration_app):
    """Integration test Redis - real Redis

    Returns redis_service if available, None if Redis is disabled.
    Flushes Redis after each test to ensure isolation.
    """
    with integration_app.app_context():
        if _app_module.redis_service is None:
            pytest.skip("Redis is not enabled for integration tests")

        yield _app_module.redis_service

        # Clean up Redis after test
        if _app_module.redis_service:
            try:
                _app_module.redis_service.get_client().flushdb()
            except Exception as e:
                print(f"⚠️  Failed to flush Redis: {e}")


# ============================================================================
# SHARED FIXTURES - User, Deck and Track fixtures for unit/integration tests
# ============================================================================

@pytest.fixture
def sample_user(db):
    """Sample user for unit tests"""
    user = User(email='test@example.com')
    user.set_password('TestPassword123')
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user


@pytest.fixture
def integration_user(integration_db):
    """Sample user for integration tests"""
    user = User(email='integration@test.com')
    user.set_password('TestPassword123')
    integration_db.session.add(user)
    integration_db.session.commit()
    integration_db.session.refresh(user)
    return user


@pytest.fixture
def second_user(db):
    """Second user for authorization tests"""
    user = User(email='other@example.com')
    user.set_password('OtherPassword123')
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user


@pytest.fixture
def auth_token(app, sample_user):
    """Generate a valid JWT token for the sample user"""
    with app.app_context():
        token = create_access_token(identity=str(sample_user.id))
        return token


@pytest.fixture
def second_auth_token(app, second_user):
    """Generate a valid JWT token for the second user"""
    with app.app_context():
        token = create_access_token(identity=str(second_user.id))
        return token


@pytest.fixture
def expired_token(app, sample_user):
    """Generate an expired JWT token"""
    with app.app_context():
        token = create_access_token(
            identity=str(sample_user.id),
            expires_delta=timedelta(seconds=-1)
        )
        return token


@pytest.fixture
def sample_deck(db, sample_user):
    """Create a single empty deck for the sample user"""
    deck = Deck(user_id=sample_user.id, name='My Deck')
    db.session.add(deck)
    db.session.commit()
    db.session.refresh(deck)
    return deck


@pytest.fixture
def sample_tracks(db, sample_deck):
    """Create a deck populated with three tracks for the sample user"""
    tracks = [
        Track(deck_id=sample_deck.id, title='Bohemian Rhapsody',
              artists=['Queen'], spotify_id='4u7EnebtmKWzUH433cf5Qv'),
        Track(deck_id=sample_deck.id, title='Crazy in Love',
              artists=['Beyonce', 'Jay-Z'], spotify_id='5IVuqXILoxVWvWEPm82Bkj'),
        Track(deck_id=sample_deck.id, title='Text Only Song',
              artists=['Some Artist'], spotify_id=None),
    ]
    db.session.add_all(tracks)
    db.session.commit()
    for track in tracks:
        db.session.refresh(track)
    return tracks


@pytest.fixture
def other_user_deck(db, second_user):
    """Create a deck (with one track) belonging to a different user"""
    deck = Deck(user_id=second_user.id, name='Other Deck')
    db.session.add(deck)
    db.session.commit()
    track = Track(deck_id=deck.id, title='Other Song', artists=['Other Artist'])
    db.session.add(track)
    db.session.commit()
    db.session.refresh(deck)
    db.session.refresh(track)
    return deck


@pytest.fixture
def auth_headers(auth_token):
    """Generate authorization headers with valid token"""
    return {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def second_auth_headers(second_auth_token):
    """Generate authorization headers for second user"""
    return {
        'Authorization': f'Bearer {second_auth_token}',
        'Content-Type': 'application/json'
    }
