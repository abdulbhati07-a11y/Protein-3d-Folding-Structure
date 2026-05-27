"""Prediction storage — Supabase Postgres (production) or in-memory (tests)."""

from __future__ import annotations

from flask import current_app, has_app_context
import datetime

_memory_store: dict[str, dict] = {}
_memory_profiles: dict[str, dict] = {}
_memory_projects: dict[str, dict] = {}


def _use_memory_store() -> bool:
    if has_app_context() and current_app.config.get('TESTING'):
        return True
    return False


def _get_supabase_client():
    from supabase import create_client

    url = current_app.config.get('SUPABASE_URL', '')
    key = current_app.config.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url or not key:
        raise RuntimeError(
            'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        )
    return create_client(url, key)


def supabase_configured() -> bool:
    if not has_app_context():
        return False
    return bool(
        current_app.config.get('SUPABASE_URL')
        and current_app.config.get('SUPABASE_SERVICE_ROLE_KEY')
    )


def init_db():
    """Verify Supabase connectivity on startup (no-op for in-memory tests)."""
    if _use_memory_store():
        return True
    if not supabase_configured():
        missing = []
        if not current_app.config.get('SUPABASE_URL'):
            missing.append('SUPABASE_URL')
        if not current_app.config.get('SUPABASE_SERVICE_ROLE_KEY'):
            missing.append('SUPABASE_SERVICE_ROLE_KEY')
        print(
            'WARNING: Supabase database not configured. '
            f'Missing: {", ".join(missing)}. '
            'Create backend/.env (copy from .env.example).',
        )
        return False
    try:
        client = _get_supabase_client()
        client.table('predictions').select('id').limit(1).execute()
        return True
    except Exception as exc:
        print(f'WARNING: Supabase connection check failed: {exc}')
        return False


def check_db_status() -> str:
    if _use_memory_store():
        return 'memory (tests)'
    if not supabase_configured():
        return 'not_configured'
    try:
        client = _get_supabase_client()
        client.table('predictions').select('id').limit(1).execute()
        return 'connected'
    except Exception:
        return 'error'


def _row_to_history_item(row: dict) -> dict:
    created = row.get('created_at') or row.get('timestamp', '')
    if hasattr(created, 'isoformat'):
        created = created.isoformat()
    return {
        'prediction_id': row['id'],
        'sequence': row['sequence'],
        'length': row['length'],
        'structure': row['structure_info'],
        'model_source': row['model_source'],
        'project_id': row.get('project_id'),
        'is_public': row.get('is_public', False),
        'notes': row.get('notes'),
        'tags': row.get('tags', []),
        'timestamp': str(created),
    }


def _row_to_detail(row: dict) -> dict:
    item = _row_to_history_item(row)
    item.update({
        'coordinates': row['coordinates'],
        'binding_pockets': row['binding_pockets'],
        'status': 'success',
    })
    return item


def save_prediction(
    pred_id,
    sequence,
    structure_info,
    coordinates,
    binding_pockets,
    model_source,
    timestamp,
    user_id=None,
    project_id=None,
    is_public=False,
    notes=None,
    tags=None,
):
    """Save prediction to Supabase or in-memory store."""
    if not user_id and not _use_memory_store():
        print('Error saving prediction: user_id is required')
        return False

    row = {
        'id': pred_id,
        'sequence': sequence,
        'length': len(sequence),
        'structure_info': structure_info,
        'coordinates': coordinates,
        'binding_pockets': binding_pockets,
        'model_source': model_source,
        'created_at': timestamp,
        'updated_at': timestamp,
        'user_id': user_id,
        'project_id': project_id,
        'is_public': is_public,
        'notes': notes,
        'tags': tags or [],
    }

    if _use_memory_store():
        _memory_store[pred_id] = row
        return True

    try:
        client = _get_supabase_client()
        payload = {**row}
        client.table('predictions').upsert(payload, on_conflict='id').execute()
        return True
    except Exception as exc:
        print(f'Error saving prediction to Supabase: {exc}')
        return False


def get_prediction_history(limit=10, user_id=None):
    """Retrieve prediction list for a user (newest first)."""
    if _use_memory_store():
        rows = list(_memory_store.values())
        if user_id:
            rows = [r for r in rows if r.get('user_id') == user_id]
        rows.sort(key=lambda r: r.get('created_at', ''), reverse=True)
        return [_row_to_history_item(r) for r in rows[:limit]]

    if not user_id:
        return []

    try:
        client = _get_supabase_client()
        response = (
            client.table('predictions')
            .select(
                'id, sequence, length, structure_info, model_source, created_at, '
                'project_id, is_public, notes, tags'
            )
            .eq('user_id', user_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return [_row_to_history_item(row) for row in (response.data or [])]
    except Exception as exc:
        print(f'Error reading prediction history from Supabase: {exc}')
        return []


def get_prediction_by_id(pred_id, user_id=None):
    """Retrieve full prediction including coordinates."""
    if _use_memory_store():
        row = _memory_store.get(pred_id)
        if not row:
            return None
        if user_id and row.get('user_id') != user_id:
            return None
        return _row_to_detail(row)

    if not user_id:
        return None

    try:
        client = _get_supabase_client()
        response = (
            client.table('predictions')
            .select(
                'id, sequence, length, structure_info, coordinates, '
                'binding_pockets, model_source, created_at, project_id, '
                'is_public, notes, tags'
            )
            .eq('id', pred_id)
            .eq('user_id', user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None
        return _row_to_detail(rows[0])
    except Exception as exc:
        print(f'Error reading prediction by id from Supabase: {exc}')
        return None


def get_prediction_by_sequence(sequence):
    """Check if the exact sequence has been predicted by ANY user globally."""
    if _use_memory_store():
        for row in _memory_store.values():
            if row.get('sequence') == sequence:
                return _row_to_detail(row)
        return None

    try:
        client = _get_supabase_client()
        response = (
            client.table('predictions')
            .select(
                'id, sequence, length, structure_info, coordinates, '
                'binding_pockets, model_source, created_at, project_id, '
                'is_public, notes, tags'
            )
            .eq('sequence', sequence)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None
        return _row_to_detail(rows[0])
    except Exception as exc:
        print(f'Error reading prediction by sequence from Supabase: {exc}')
        return None


def clear_memory_store():
    """Test helper."""
    _memory_store.clear()
    _memory_profiles.clear()
    _memory_projects.clear()


def delete_prediction(pred_id: str, user_id: str | None = None) -> bool:
    """Delete a prediction. Returns True if a row was deleted, False if not found."""
    if _use_memory_store():
        row = _memory_store.get(pred_id)
        if not row:
            return False
        if user_id and row.get('user_id') != user_id:
            return False
        del _memory_store[pred_id]
        return True

    if not user_id:
        return False

    try:
        client = _get_supabase_client()
        response = (
            client.table('predictions')
            .delete()
            .eq('id', pred_id)
            .eq('user_id', user_id)
            .execute()
        )
        # Supabase returns the deleted rows; empty list means nothing matched
        return bool(response.data)
    except Exception as exc:
        print(f'Error deleting prediction from Supabase: {exc}')
        return False


# ============================================================================
# Profile Management
# ============================================================================

def get_profile(user_id: str) -> dict | None:
    """Get user profile."""
    if _use_memory_store():
        return _memory_profiles.get(user_id)

    try:
        client = _get_supabase_client()
        response = (
            client.table('profiles')
            .select('user_id, display_name, theme, bio, updated_at')
            .eq('user_id', user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None
        return rows[0]
    except Exception as exc:
        print(f'Error reading profile from Supabase: {exc}')
        return None


def update_profile(user_id: str, display_name=None, theme=None, bio=None) -> bool:
    """Update user profile."""
    if not user_id:
        return False

    if _use_memory_store():
        profile = _memory_profiles.get(user_id, {'user_id': user_id, 'display_name': None, 'theme': 'light', 'bio': None})
        if display_name is not None:
            profile['display_name'] = display_name
        if theme is not None:
            profile['theme'] = theme
        if bio is not None:
            profile['bio'] = bio
        profile['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()
        _memory_profiles[user_id] = profile
        return True

    try:
        client = _get_supabase_client()
        payload = {'user_id': user_id}
        if display_name is not None:
            payload['display_name'] = display_name
        if theme is not None:
            payload['theme'] = theme
        if bio is not None:
            payload['bio'] = bio
        payload['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()

        client.table('profiles').upsert(payload, on_conflict='user_id').execute()
        return True
    except Exception as exc:
        print(f'Error updating profile in Supabase: {exc}')
        return False


# ============================================================================
# Project Management
# ============================================================================

def create_project(user_id: str, project_id: str, name: str, description: str = None) -> bool:
    """Create a new project."""
    if not user_id or not project_id or not name:
        return False

    now = datetime.datetime.now(datetime.UTC).isoformat()
    payload = {
        'id': project_id,
        'user_id': user_id,
        'name': name,
        'description': description,
        'created_at': now,
        'updated_at': now,
    }

    if _use_memory_store():
        _memory_projects[project_id] = payload
        return True

    try:
        client = _get_supabase_client()
        client.table('projects').upsert(payload, on_conflict='id').execute()
        return True
    except Exception as exc:
        print(f'Error creating project in Supabase: {exc}')
        return False


def get_projects(user_id: str, limit: int = 50) -> list:
    """Get all projects for a user."""
    if not user_id:
        return []

    if _use_memory_store():
        user_projects = [p for p in _memory_projects.values() if p['user_id'] == user_id]
        user_projects.sort(key=lambda p: p.get('created_at', ''), reverse=True)
        return user_projects[:limit]

    try:
        client = _get_supabase_client()
        response = (
            client.table('projects')
            .select('id, user_id, name, description, created_at, updated_at')
            .eq('user_id', user_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        print(f'Error reading projects from Supabase: {exc}')
        return []


def update_project(project_id: str, user_id: str, name=None, description=None) -> bool:
    """Update a project."""
    if not project_id or not user_id:
        return False

    if _use_memory_store():
        project = _memory_projects.get(project_id)
        if not project or project['user_id'] != user_id:
            return False
        if name is not None:
            project['name'] = name
        if description is not None:
            project['description'] = description
        project['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()
        return True

    try:
        client = _get_supabase_client()
        payload = {}
        if name is not None:
            payload['name'] = name
        if description is not None:
            payload['description'] = description
        payload['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()

        response = (
            client.table('projects')
            .update(payload)
            .eq('id', project_id)
            .eq('user_id', user_id)
            .execute()
        )
        return bool(response.data)
    except Exception as exc:
        print(f'Error updating project in Supabase: {exc}')
        return False


def delete_project(project_id: str, user_id: str) -> bool:
    """Delete a project (cascades to unlink predictions)."""
    if not project_id or not user_id:
        return False

    if _use_memory_store():
        project = _memory_projects.get(project_id)
        if not project or project['user_id'] != user_id:
            return False
        del _memory_projects[project_id]
        # Simulate cascade: unlink predictions
        for pred in _memory_store.values():
            if pred.get('project_id') == project_id:
                pred['project_id'] = None
        return True

    try:
        client = _get_supabase_client()
        response = (
            client.table('projects')
            .delete()
            .eq('id', project_id)
            .eq('user_id', user_id)
            .execute()
        )
        return bool(response.data)
    except Exception as exc:
        print(f'Error deleting project from Supabase: {exc}')
        return False


# ============================================================================
# Public Predictions
# ============================================================================

def get_public_predictions(limit: int = 50) -> list:
    """Get public predictions (unauthenticated)."""
    if _use_memory_store():
        public_preds = [p for p in _memory_store.values() if p.get('is_public')]
        public_preds.sort(key=lambda p: p.get('created_at', ''), reverse=True)
        return [_row_to_history_item(p) for p in public_preds[:limit]]

    try:
        client = _get_supabase_client()
        response = (
            client.table('public_predictions')
            .select(
                'id, user_id, project_id, sequence, length, structure_info, '
                'model_source, notes, tags, created_at'
            )
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        print(f'Error reading public predictions from Supabase: {exc}')
        return []


def get_public_prediction_by_id(pred_id: str) -> dict | None:
    """Get a specific public prediction (unauthenticated)."""
    if _use_memory_store():
        pred = _memory_store.get(pred_id)
        if not pred or not pred.get('is_public'):
            return None
        return _row_to_detail(pred)

    try:
        client = _get_supabase_client()
        response = (
            client.table('predictions')
            .select(
                'id, user_id, project_id, sequence, length, structure_info, '
                'coordinates, binding_pockets, model_source, notes, tags, created_at'
            )
            .eq('id', pred_id)
            .eq('is_public', True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None
        row = rows[0]
        return {
            'prediction_id': row['id'],
            'sequence': row['sequence'],
            'length': row['length'],
            'structure': row['structure_info'],
            'coordinates': row['coordinates'],
            'binding_pockets': row['binding_pockets'],
            'model_source': row['model_source'],
            'notes': row.get('notes'),
            'tags': row.get('tags', []),
            'status': 'success',
        }
    except Exception as exc:
        print(f'Error reading public prediction by id from Supabase: {exc}')
        return None


def update_prediction_sharing(
    pred_id: str,
    user_id: str,
    is_public: bool = False,
    notes: str = None,
    tags: list = None,
) -> bool:
    """Update prediction sharing settings and metadata."""
    if not pred_id or not user_id:
        return False

    if _use_memory_store():
        pred = _memory_store.get(pred_id)
        if not pred or pred.get('user_id') != user_id:
            return False
        pred['is_public'] = is_public
        if notes is not None:
            pred['notes'] = notes
        if tags is not None:
            pred['tags'] = tags
        pred['updated_at'] = datetime.datetime.now(datetime.UTC).isoformat()
        return True

    try:
        client = _get_supabase_client()
        payload = {
            'is_public': is_public,
            'updated_at': datetime.datetime.now(datetime.UTC).isoformat(),
        }
        if notes is not None:
            payload['notes'] = notes
        if tags is not None:
            payload['tags'] = tags

        response = (
            client.table('predictions')
            .update(payload)
            .eq('id', pred_id)
            .eq('user_id', user_id)
            .execute()
        )
        return bool(response.data)
    except Exception as exc:
        print(f'Error updating prediction sharing in Supabase: {exc}')
        return False
