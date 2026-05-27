"""GET /api/predictions/history/[id]  and  DELETE /api/predictions/history/[id]"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from http.server import BaseHTTPRequestHandler

from _shared.auth import auth_enabled, get_user_id
from _shared.db import delete_prediction, get_prediction_by_id
from _shared.response import json_response, options_response


def _pred_id_from_path(path: str) -> str:
    """Extract the last path segment as the prediction id."""
    return path.rstrip('/').split('/')[-1].split('?')[0]


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        options_response(self)

    def do_GET(self):
        user_id = get_user_id(dict(self.headers))
        if auth_enabled() and not user_id:
            return json_response(self, 401, {'status': 'error', 'message': 'Authentication required.'})

        pred_id = _pred_id_from_path(self.path)
        prediction = get_prediction_by_id(pred_id, user_id=user_id)
        if prediction:
            return json_response(self, 200, prediction)
        json_response(self, 404, {'status': 'error', 'message': 'Prediction not found'})

    def do_DELETE(self):
        user_id = get_user_id(dict(self.headers))
        if auth_enabled() and not user_id:
            return json_response(self, 401, {'status': 'error', 'message': 'Authentication required.'})

        pred_id = _pred_id_from_path(self.path)
        if delete_prediction(pred_id, user_id=user_id):
            return json_response(self, 200, {'status': 'success', 'message': 'Prediction deleted'})
        json_response(self, 404, {'status': 'error', 'message': 'Prediction not found'})

    def log_message(self, *args):
        pass
