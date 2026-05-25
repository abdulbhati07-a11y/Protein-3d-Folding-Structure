"""Supabase database helpers for Vercel serverless functions."""
import os
from functools import lru_cache

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


@lru_cache(maxsize=1)
def _get_client():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _row_to_history_item(row: dict) -> dict:
    created = row.get('created_at') or ''
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


def save_prediction(pred_id, sequence, structure_info, coordinates,
                    binding_pockets, model_source, timestamp, user_id):
    if not supabase_configured():
        return False
    try:
        client = _get_client()
        client.table('predictions').upsert({
            'id': pred_id,
            'sequence': sequence,
            'length': len(sequence),
            'structure_info': structure_info,
            'coordinates': coordinates,
            'binding_pockets': binding_pockets,
            'model_source': model_source,
            'created_at': timestamp,
            'user_id': user_id,
        }, on_conflict='id').execute()
        return True
    except Exception as exc:
        print(f'Error saving prediction: {exc}')
        return False


def get_prediction_history(limit: int = 10, user_id: str = None):
    if not user_id or not supabase_configured():
        return []
    try:
        client = _get_client()
        response = (
            client.table('predictions')
            .select('id, sequence, length, structure_info, model_source, created_at')
            .eq('user_id', user_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return [_row_to_history_item(r) for r in (response.data or [])]
    except Exception as exc:
        print(f'Error reading history: {exc}')
        return []


def get_prediction_by_id(pred_id: str, user_id: str = None):
    if not user_id or not supabase_configured():
        return None
    try:
        client = _get_client()
        response = (
            client.table('predictions')
            .select('id, sequence, length, structure_info, coordinates, binding_pockets, model_source, created_at')
            .eq('id', pred_id)
            .eq('user_id', user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return _row_to_detail(rows[0]) if rows else None
    except Exception as exc:
        print(f'Error reading prediction: {exc}')
        return None


def delete_prediction(pred_id: str, user_id: str = None) -> bool:
    if not user_id or not supabase_configured():
        return False
    try:
        client = _get_client()
        response = (
            client.table('predictions')
            .delete()
            .eq('id', pred_id)
            .eq('user_id', user_id)
            .execute()
        )
        return bool(response.data)
    except Exception as exc:
        print(f'Error deleting prediction: {exc}')
        return False


def check_db_status() -> str:
    if not supabase_configured():
        return 'not_configured'
    try:
        client = _get_client()
        client.table('predictions').select('id').limit(1).execute()
        return 'connected'
    except Exception:
        return 'error'
