"""GET /api/health"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime
from http.server import BaseHTTPRequestHandler

from _shared.db import check_db_status, supabase_configured
from _shared.predictor import ESM_AVAILABLE
from _shared.response import json_response, options_response


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        options_response(self)

    def do_GET(self):
        db_status = check_db_status()
        json_response(self, 200, {
            'status': 'healthy' if db_status != 'error' else 'degraded',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0',
            'components': {
                'esmfold': 'local_optional' if ESM_AVAILABLE else 'api_with_mock_fallback',
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

    def log_message(self, *args):
        pass
