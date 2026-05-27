from flask import Blueprint, g, jsonify, request

from protein_fold.app.auth import require_auth
from protein_fold.app.database import get_profile, update_profile

profiles_bp = Blueprint('profiles', __name__)


def _scoped_user_id():
    """Get the logged-in user ID."""
    return getattr(g, 'user_id', None)


@profiles_bp.route('/profile', methods=['GET'])
@require_auth
def get_user_profile():
    """Get the current user's profile."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    profile = get_profile(user_id)
    if not profile:
        return jsonify({
            "status": "error",
            "message": "Profile not found",
        }), 404

    return jsonify({
        "status": "success",
        "profile": profile,
    })


@profiles_bp.route('/profile', methods=['PUT'])
@require_auth
def update_user_profile():
    """Update the current user's profile."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.json or {}
    display_name = data.get('display_name')
    theme = data.get('theme')
    bio = data.get('bio')

    if not any([display_name is not None, theme is not None, bio is not None]):
        return jsonify({
            "status": "error",
            "message": "At least one field (display_name, theme, bio) is required",
        }), 400

    if not update_profile(
        user_id,
        display_name=display_name,
        theme=theme,
        bio=bio,
    ):
        return jsonify({
            "status": "error",
            "message": "Failed to update profile",
        }), 500

    return jsonify({"status": "success"})
