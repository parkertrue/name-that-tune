import pytest
import os
import sys
from datetime import timedelta

from app.config import (
    Config,
    DevelopmentConfig,
    TestingConfig,
    IntegrationConfig,
    ProductionConfig,
    get_config
)


@pytest.fixture(autouse=True)
def isolate_config_tests():
    """Isolate config tests from session env vars."""
    if 'app.config' in sys.modules:
        del sys.modules['app.config']
    yield
    if 'app.config' in sys.modules:
        del sys.modules['app.config']


class TestConfigClasses:
    """Test Config class attributes"""

    def test_config_class_reads_env_vars(self, monkeypatch):
        """Config class should read environment variables"""
        # Clear any existing port overrides from .env.test
        if 'MYSQL_PORT' in os.environ:
            monkeypatch.delenv('MYSQL_PORT')
        if 'REDIS_PORT' in os.environ:
            monkeypatch.delenv('REDIS_PORT')

        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

        assert config.DB_USER == 'test'
        assert config.DB_PASSWORD == 'test'
        assert config.DB_HOST == 'localhost'
        assert config.DB_PORT == 3306  # Default port
        assert config.DB_DATABASE == 'test'
        assert config.REDIS_HOST == 'localhost'
        assert config.REDIS_PORT == 6379  # Default port
        assert config.REDIS_DB == '0'
        assert config.REDIS_PASSWORD == 'redispass'
        assert config.JWT_SECRET_KEY == 'testsecret'
        assert config.SQLALCHEMY_DATABASE_URI == "mysql+pymysql://test:test@localhost:3306/test"
        assert config.REDIS_URI == "redis://:redispass@localhost:6379/0"
        assert config.RATELIMIT_STORAGE_URI == "redis://:redispass@localhost:6379/0"

    def test_config_with_custom_ports(self, monkeypatch):
        """Config class should accept custom ports via environment variables"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_PORT', '3307')  # Custom MySQL port
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_PORT', '6380')  # Custom Redis port
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

        assert config.DB_PORT == 3307  # Custom port
        assert config.REDIS_PORT == 6380  # Custom port
        assert config.SQLALCHEMY_DATABASE_URI == "mysql+pymysql://test:test@localhost:3307/test"
        assert config.REDIS_URI == "redis://:redispass@localhost:6380/0"

    def test_development_config_attributes(self, monkeypatch):
        """DevelopmentConfig should have correct attributes"""
        # Ensure clean environment for this test
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()

        assert config.FLASK_ENV == 'development'
        assert hasattr(config, 'CORS_ORIGINS')
        assert 'http://localhost:5173' in config.CORS_ORIGINS
        assert config.REDIS_ENABLED is True
        assert config.RATELIMIT_ENABLED is True

    def test_testing_config_attributes(self, monkeypatch):
        """TestingConfig should have correct attributes"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = TestingConfig()

        assert config.FLASK_ENV == 'testing'
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'
        assert config.REDIS_ENABLED is False
        assert config.RATELIMIT_ENABLED is False

    def test_integration_config_attributes(self, monkeypatch):
        """IntegrationConfig should have correct attributes for testing"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')
        # Clear FLASK_DEBUG to test default
        if 'FLASK_DEBUG' in os.environ:
            monkeypatch.delenv('FLASK_DEBUG')
        # Clear E2E_MODE to test default
        if 'E2E_MODE' in os.environ:
            monkeypatch.delenv('E2E_MODE')

        config = IntegrationConfig()

        # Should have integration settings
        assert config.FLASK_ENV == 'integration'
        assert config.FLASK_DEBUG is False
        assert config.REDIS_ENABLED is True

        # Rate limiting disabled for tests
        assert config.RATELIMIT_ENABLED is False

        # CORS enabled for test environments
        assert config.CORS_ORIGINS == [
            "http://localhost:5173",
            "https://localhost",
            "https://localhost:8443"
        ]

        # JWT cookie security depends on E2E_MODE
        # Default should be False (HTTP for pytest)
        assert config.JWT_COOKIE_SECURE is False

    def test_integration_config_with_e2e_mode(self, monkeypatch):
        """IntegrationConfig should enable secure cookies when E2E_MODE=true"""
        monkeypatch.setenv('E2E_MODE', 'true')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = IntegrationConfig()

        # Should enable secure cookies for HTTPS (Playwright E2E)
        assert config.JWT_COOKIE_SECURE is True

    def test_production_config_attributes(self, monkeypatch):
        """ProductionConfig should have correct attributes"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = ProductionConfig()

        assert config.FLASK_ENV == 'production'
        assert config.FLASK_DEBUG is False
        assert config.JWT_COOKIE_SECURE is True
        assert config.REDIS_ENABLED is True
        assert config.RATELIMIT_ENABLED is True


class TestGetConfigFactory:
    """Test get_config() factory function"""

    def test_get_config_development(self, monkeypatch):
        """get_config should return DevelopmentConfig for dev env"""
        # Clear port overrides for default port test
        if 'MYSQL_PORT' in os.environ:
            monkeypatch.delenv('MYSQL_PORT')
        if 'REDIS_PORT' in os.environ:
            monkeypatch.delenv('REDIS_PORT')

        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'testuser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'testpass')
        monkeypatch.setenv('MYSQL_HOST', 'testhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'testdb')
        monkeypatch.setenv('REDIS_HOST', 'redishost')
        monkeypatch.setenv('REDIS_DB', '1')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert isinstance(config, DevelopmentConfig)
        assert config.FLASK_ENV == 'development'
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://testuser:testpass@testhost:3306/testdb'
        assert config.REDIS_URI == 'redis://:redispass@redishost:6379/1'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:redispass@redishost:6379/1'

    def test_get_config_testing(self, monkeypatch):
        """get_config should return TestingConfig for testing env"""
        monkeypatch.setenv('FLASK_ENV', 'testing')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'testpass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert isinstance(config, TestingConfig)
        assert config.FLASK_ENV == 'testing'
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'
        assert config.REDIS_ENABLED is False
        assert config.RATELIMIT_ENABLED is False

    def test_get_config_integration(self, monkeypatch):
        """get_config should return IntegrationConfig for integration env"""
        monkeypatch.setenv('FLASK_ENV', 'integration')
        monkeypatch.setenv('MYSQL_USER', 'testuser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'testpass')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_PORT', '3307')  # Test port
        monkeypatch.setenv('MYSQL_DATABASE', 'test_db')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_PORT', '6380')  # Test port
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'testpass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert isinstance(config, IntegrationConfig)
        assert config.FLASK_ENV == 'integration'
        assert config.DB_PORT == 3307
        assert config.REDIS_PORT == 6380
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://testuser:testpass@localhost:3307/test_db'
        assert config.REDIS_URI == 'redis://:testpass@localhost:6380/0'

    def test_get_config_production(self, monkeypatch):
        """get_config should return ProductionConfig for prod env"""
        # Clear port overrides for default port test
        if 'MYSQL_PORT' in os.environ:
            monkeypatch.delenv('MYSQL_PORT')
        if 'REDIS_PORT' in os.environ:
            monkeypatch.delenv('REDIS_PORT')

        monkeypatch.setenv('FLASK_ENV', 'production')
        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', 'prodsecret')

        config = get_config()

        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://produser:prodpass@prodhost:3306/proddb'
        assert config.REDIS_URI == 'redis://:prodredispass@prodredis:6379/0'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:prodredispass@prodredis:6379/0'

    def test_get_config_invalid_env(self, monkeypatch):
        """get_config should raise error for invalid FLASK_ENV"""
        monkeypatch.setenv('FLASK_ENV', 'invalid')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)
        assert 'invalid' in str(exc_info.value)

    def test_get_config_defaults_to_production(self, monkeypatch):
        """get_config should default to production if FLASK_ENV not set"""
        # Clear port overrides
        if 'MYSQL_PORT' in os.environ:
            monkeypatch.delenv('MYSQL_PORT')
        if 'REDIS_PORT' in os.environ:
            monkeypatch.delenv('REDIS_PORT')
        if 'FLASK_ENV' in os.environ:
            monkeypatch.delenv('FLASK_ENV')

        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', 'prodsecret')

        config = get_config()

        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'


class TestConfigValidation:
    """Test validation in Config classes"""

    def test_config_requires_database_vars(self, monkeypatch):
        """Config should raise error if DB vars missing"""
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        # Missing all DB vars
        for var in ['MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_HOST', 'MYSQL_DATABASE']:
            if var in os.environ:
                monkeypatch.delenv(var)

        with pytest.raises(ValueError) as exc_info:
            Config()

        assert 'MySQL' in str(exc_info.value)

    def test_config_requires_redis_vars(self, monkeypatch):
        """Config should raise error if Redis vars missing"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        # Missing all Redis vars
        for var in ['REDIS_HOST', 'REDIS_DB', 'REDIS_PASSWORD']:
            if var in os.environ:
                monkeypatch.delenv(var)

        with pytest.raises(ValueError) as exc_info:
            Config()

        assert 'Redis' in str(exc_info.value)

    def test_config_requires_secret_key(self, monkeypatch):
        """Config should raise error if SECRET_KEY missing"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')

        if 'SECRET_KEY' in os.environ:
            monkeypatch.delenv('SECRET_KEY')

        with pytest.raises(ValueError) as exc_info:
            Config()

        assert 'SECRET_KEY' in str(exc_info.value)


class TestPortConfiguration:
    """Test port configuration behavior"""

    def test_default_ports_when_not_specified(self, monkeypatch):
        """Should use default ports when MYSQL_PORT and REDIS_PORT not specified"""
        # Clear port overrides from .env.test
        if 'MYSQL_PORT' in os.environ:
            monkeypatch.delenv('MYSQL_PORT')
        if 'REDIS_PORT' in os.environ:
            monkeypatch.delenv('REDIS_PORT')

        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

        assert config.DB_PORT == 3306  # Default MySQL port
        assert config.REDIS_PORT == 6379  # Default Redis port

    def test_custom_ports_from_env_vars(self, monkeypatch):
        """Should use custom ports when specified in environment"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_PORT', '3307')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_PORT', '6380')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

        assert config.DB_PORT == 3307  # Custom MySQL port
        assert config.REDIS_PORT == 6380  # Custom Redis port
        assert 'localhost:3307' in config.SQLALCHEMY_DATABASE_URI
        assert 'localhost:6380' in config.REDIS_URI


class TestConfigInheritance:
    """Test that child configs inherit from base Config"""

    def test_development_inherits_jwt_settings(self, monkeypatch):
        """DevelopmentConfig should inherit JWT settings from Config"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_REFRESH_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_SECRET_KEY')

    def test_integration_inherits_redis_settings(self, monkeypatch):
        """IntegrationConfig should inherit Redis settings from Config"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = IntegrationConfig()

        assert hasattr(config, 'REDIS_HOST')
        assert hasattr(config, 'REDIS_PORT')
        assert hasattr(config, 'REDIS_DB')
        assert hasattr(config, 'REDIS_PASSWORD')
        assert hasattr(config, 'REDIS_MAX_CONNECTIONS')


class TestRateLimitBehavior:
    """Test rate limiting configuration across environments"""

    def test_rate_limiting_enabled_in_development(self, monkeypatch):
        """Rate limiting should be enabled in development"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()
        assert config.RATELIMIT_ENABLED is True

    def test_rate_limiting_disabled_in_testing(self, monkeypatch):
        """Rate limiting should be disabled in testing"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = TestingConfig()
        assert config.RATELIMIT_ENABLED is False

    def test_rate_limiting_disabled_in_integration(self, monkeypatch):
        """Rate limiting should be disabled in integration"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = IntegrationConfig()
        assert config.RATELIMIT_ENABLED is False

    def test_rate_limiting_enabled_in_production(self, monkeypatch):
        """Rate limiting should be enabled in production"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = ProductionConfig()
        assert config.RATELIMIT_ENABLED is True
