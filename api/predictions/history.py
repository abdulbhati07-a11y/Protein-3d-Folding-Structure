"""GET /api/predictions/history"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from _shared.auth import auth_enabled, get_user_id
from _shared.db import get_prediction_history
from _shared.response import json_response, options_response


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        options_response(self)

    def do_GET(self):
        user_id = get_user_id(dict(self.headers))
        if auth_enabled() and not user_id:
            return json_response(self, 401, {
                'status': 'error',
                'message': 'Authentication required.',
            })

        qs = parse_qs(urlparse(self.path).query)
        try:
            limit = int(qs.get('limit', ['10'])[0])
        except ValueError:
            limit = 10

        history = get_prediction_history(limit=limit, user_id=user_id)
        json_response(self, 200, history)

    def log_message(self, *args):
        pass
