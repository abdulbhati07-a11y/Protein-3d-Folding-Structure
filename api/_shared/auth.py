"""Supabase JWT verification for Vercel serverless functions."""
import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    return PyJWKClient(
        f'{SUPABASE_URL}/auth/v1/.well-known/jwks.json',
        cache_keys=True,
    )


def verify_supabase_jwt(token: str) -> str | None:
    """
    Validate a Supabase access token.
    Returns the user_id (sub claim) or None if invalid.
    """
    # 1) ES256 / RS256 via JWKS
    if SUPABASE_URL:
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['ES256', 'RS256', 'EdDSA'],
                audience='authenticated',
                options={'verify_aud': True},
            )
            return payload.get('sub')
        except Exception:
            pass

    # 2) Legacy HS256
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=['HS256'],
                audience='authenticated',
                options={'verify_aud': True},
            )
            return payload.get('sub')
        except Exception:
            pass

    return None


def get_user_id(headers: dict) -> str | None:
    """Extract and verify user_id from Authorization header."""
    auth = headers.get('Authorization') or headers.get('authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    return verify_supabase_jwt(token)


def auth_enabled() -> bool:
    return bool(SUPABASE_URL)
