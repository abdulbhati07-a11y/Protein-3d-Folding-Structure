"""Prediction storage — Supabase Postgres (production) or in-memory (tests)."""

from __future__ import annotations

from flask import current_app, has_app_context

_memory_store: dict[str, dict] = {}


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
        'user_id': user_id,
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
            .select('id, sequence, length, structure_info, model_source, created_at')
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
                'binding_pockets, model_source, created_at',
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


def clear_memory_store():
    """Test helper."""
    _memory_store.clear()


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
