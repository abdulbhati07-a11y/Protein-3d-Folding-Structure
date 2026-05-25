"""Verify Supabase JWT access tokens on API requests."""

from functools import wraps

import jwt
from flask import current_app, g, jsonify, request
from jwt import PyJWKClient

from protein_fold.app.database import supabase_configured

_jwks_clients: dict[str, PyJWKClient] = {}


def auth_enabled():
    """Auth is required when Supabase URL is configured (JWKS or JWT secret)."""
    if current_app.config.get('TESTING'):
        return False
    return bool(current_app.config.get('SUPABASE_URL'))


def _get_jwks_client(supabase_url: str) -> PyJWKClient:
    url = supabase_url.rstrip('/')
    if url not in _jwks_clients:
        _jwks_clients[url] = PyJWKClient(
            f'{url}/auth/v1/.well-known/jwks.json',
            cache_keys=True,
        )
    return _jwks_clients[url]


def verify_supabase_jwt(token):
    """
    Decode and validate a Supabase access token.
    Supports ES256 (JWKS, current default) and legacy HS256 (JWT secret).
    Returns user id (sub claim) or None if invalid.
    """
    supabase_url = (current_app.config.get('SUPABASE_URL') or '').rstrip('/')
    secret = current_app.config.get('SUPABASE_JWT_SECRET')

    decode_opts = {'verify_aud': True}
    audience = 'authenticated'

    # 1) ES256 / RS256 via JWKS (modern Supabase projects)
    if supabase_url:
        try:
            jwks_client = _get_jwks_client(supabase_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['ES256', 'RS256', 'EdDSA'],
                audience=audience,
                options=decode_opts,
            )
            return payload.get('sub')
        except jwt.PyJWTError:
            pass
        except Exception:
            pass

    # 2) Legacy HS256 with JWT secret
    if secret:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=['HS256'],
                audience=audience,
                options=decode_opts,
            )
            return payload.get('sub')
        except jwt.PyJWTError:
            pass

    return None


def get_current_user_id():
    """Extract user id from Authorization: Bearer <token> header."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None
    return verify_supabase_jwt(token)


def require_auth(view):
    """Require a valid Supabase JWT when auth is enabled."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if not auth_enabled():
            g.user_id = None
            return view(*args, **kwargs)

        user_id = get_current_user_id()
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required. Sign in with Supabase.',
            }), 401

        if not supabase_configured():
            return jsonify({
                'status': 'error',
                'message': 'Database not configured. Set SUPABASE_SERVICE_ROLE_KEY.',
            }), 503

        g.user_id = user_id
        return view(*args, **kwargs)

    return wrapped
