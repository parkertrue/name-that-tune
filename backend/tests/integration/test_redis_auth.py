import pytest
import json
from flask_jwt_extended import decode_token


class TestRedisTokenStorage:
    """Test token storage in Redis"""

    def test_login_stores_refresh_token_in_redis(
        self, integration_client, integration_user, integration_redis
    ):
        """Login should store refresh token JTI in Redis"""

        payload = {
            'email': 'integration@test.com',
            'password': 'TestPassword123'
        }

        response = integration_client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Extract refresh token from cookies
        cookies = response.headers.getlist('Set-Cookie')
        refresh_cookie = next(
            (c for c in cookies if 'refresh_token_cookie' in c), None)
        assert refresh_cookie is not None

        data = json.loads(response.data)
        keys = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        assert len(keys) == 1  # Should have one token stored

    def test_logout_revokes_token_in_redis(
        self, integration_client, integration_user, integration_redis
    ):
        """Logout should remove refresh token from Redis"""

        # Login first
        login_response = integration_client.post(
            '/api/auth/login',
            data=json.dumps({
                'email': 'integration@test.com',
                'password': 'TestPassword123'
            }),
            content_type='application/json'
        )
        assert login_response.status_code == 200

        # Verify token exists
        keys_before = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        assert len(keys_before) == 1

        # Logout
        logout_response = integration_client.post('/api/auth/logout')

        # Token should be removed
        keys_after = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        assert len(keys_after) == 0

    def test_logout_all_revokes_all_user_tokens(
        self, integration_client, integration_user, integration_redis
    ):
        """Logout-all should remove all user tokens from Redis"""

        # Login multiple times (simulate multiple devices)
        for _ in range(3):
            integration_client.post(
                '/api/auth/login',
                data=json.dumps({
                    'email': 'integration@test.com',
                    'password': 'TestPassword123'
                }),
                content_type='application/json'
            )

        # Should have 3 tokens
        keys_before = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        assert len(keys_before) == 3

        # Logout all
        integration_client.post('/api/auth/logout-all')

        # All tokens should be removed
        keys_after = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        assert len(keys_after) == 0


class TestTokenRotation:
    """Test refresh token rotation"""

    def test_refresh_revokes_old_token(
        self, integration_client, integration_user, integration_redis
    ):
        """Token refresh should revoke old token and create new one"""

        # Login
        login_response = integration_client.post(
            '/api/auth/login',
            data=json.dumps({
                'email': 'integration@test.com',
                'password': 'TestPassword123'
            }),
            content_type='application/json'
        )

        # Get old token JTI
        keys_before = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        old_jti = keys_before[0].split(':')[-1]

        # Refresh
        refresh_response = integration_client.post('/api/auth/refresh')
        assert refresh_response.status_code == 200

        # Get new token JTI
        keys_after = integration_redis.get_client().keys(
            f'refresh_token:{integration_user.id}:*')
        new_jti = keys_after[0].split(':')[-1]

        # JTI should be different
        assert old_jti != new_jti

        # Should still only have one token
        assert len(keys_after) == 1
