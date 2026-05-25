from datetime import datetime

from flask import Blueprint, jsonify

from protein_fold.app.database import check_db_status, supabase_configured
from protein_fold.app.services.coordinate_generator import ESM_AVAILABLE

health_bp = Blueprint('health', __name__)


@health_bp.route('', methods=['GET'])
def health():
    esmfold_status = 'local_optional' if ESM_AVAILABLE else 'api_with_mock_fallback'
    db_status = check_db_status()

    return jsonify({
        'status': 'healthy' if db_status != 'error' else 'degraded',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'components': {
            'esmfold': esmfold_status,
            'database': db_status,
            'supabase': 'configured' if supabase_configured() else 'not_configured',
            'cache': 'healthy',
            'gpu': 'not available',
        },
        'metrics': {
            'predictions_cached': 0,
            'cache_size_mb': 0,
            'avg_prediction_time': 0,
            'requests_per_minute': 0,
        },
    })
