import uuid
from flask import Blueprint, g, jsonify, request

from protein_fold.app.auth import require_auth
from protein_fold.app.database import (
    create_project,
    delete_project,
    get_projects,
    update_project,
)

projects_bp = Blueprint('projects', __name__)


def _scoped_user_id():
    """Get the logged-in user ID."""
    return getattr(g, 'user_id', None)


@projects_bp.route('/projects', methods=['GET'])
@require_auth
def list_projects():
    """Get all projects for the logged-in user."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    limit = request.args.get('limit', default=50, type=int)
    projects = get_projects(user_id, limit=limit)
    return jsonify({"projects": projects})


@projects_bp.route('/projects', methods=['POST'])
@require_auth
def create_new_project():
    """Create a new project."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.json or {}
    name = data.get('name')
    description = data.get('description', '')

    if not name:
        return jsonify({
            "status": "error",
            "message": "Project name is required",
        }), 400

    project_id = f"proj_{uuid.uuid4().hex[:12]}"

    if not create_project(user_id, project_id, name, description):
        return jsonify({
            "status": "error",
            "message": "Failed to create project",
        }), 500

    return jsonify({
        "status": "success",
        "project_id": project_id,
        "name": name,
        "description": description,
    }), 201


@projects_bp.route('/projects/<project_id>', methods=['PUT'])
@require_auth
def update_existing_project(project_id):
    """Update an existing project."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.json or {}
    name = data.get('name')
    description = data.get('description')

    if not name and description is None:
        return jsonify({
            "status": "error",
            "message": "At least one field (name, description) is required",
        }), 400

    if not update_project(project_id, user_id, name=name, description=description):
        return jsonify({
            "status": "error",
            "message": "Failed to update project or project not found",
        }), 500

    return jsonify({"status": "success"})


@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
@require_auth
def delete_existing_project(project_id):
    """Delete a project."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    if not delete_project(project_id, user_id):
        return jsonify({
            "status": "error",
            "message": "Failed to delete project or project not found",
        }), 404

    return jsonify({"status": "success"})
