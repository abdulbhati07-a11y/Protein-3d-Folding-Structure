"""POST /api/predictions/predict"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler

from _shared.auth import auth_enabled, get_user_id
from _shared.db import save_prediction
from _shared.predictor import predict_protein_structure
from _shared.response import json_response, options_response

MAX_SEQUENCE_LENGTH = int(os.environ.get('MAX_SEQUENCE_LENGTH', 10000))
VALID_AA = set('ACDEFGHIKLMNPQRSTVWY')


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        options_response(self)

    def do_POST(self):
        # Auth check
        user_id = get_user_id(dict(self.headers))
        if auth_enabled() and not user_id:
            return json_response(self, 401, {
                'status': 'error',
                'message': 'Authentication required. Sign in with Supabase.',
            })

        # Parse body
        length = int(self.headers.get('Content-Length', 0))
        body = {}
        if length:
            try:
                body = json.loads(self.rfile.read(length))
            except Exception:
                return json_response(self, 400, {'status': 'error', 'message': 'Invalid JSON body'})

        sequence = body.get('sequence', '')

        # Validation
        if not sequence:
            return json_response(self, 400, {'status': 'error', 'message': 'Sequence is required'})
        if len(sequence) < 2:
            return json_response(self, 400, {
                'status': 'error',
                'message': 'Sequence too short. Minimum length is 2 amino acids.',
            })
        if len(sequence) > MAX_SEQUENCE_LENGTH:
            return json_response(self, 400, {
                'status': 'error',
                'message': f'Sequence too long ({len(sequence)} residues). Maximum allowed is {MAX_SEQUENCE_LENGTH}.',
            })
        sequence = sequence.upper()
        if not all(c in VALID_AA for c in sequence):
            return json_response(self, 400, {
                'status': 'error', 'message': 'Invalid amino acids in sequence',
            })

        # Predict
        prediction_id = f'pred_{uuid.uuid4().hex[:12]}'
        result = predict_protein_structure(sequence)
        timestamp = datetime.now().isoformat()

        # Save
        if not save_prediction(
            pred_id=prediction_id,
            sequence=sequence,
            structure_info=result['structure'],
            coordinates=result['coordinates'],
            binding_pockets=result['binding_pockets'],
            model_source=result['model_source'],
            timestamp=timestamp,
            user_id=user_id,
        ):
            return json_response(self, 500, {
                'status': 'error', 'message': 'Failed to save prediction to database.',
            })

        json_response(self, 200, {
            'prediction_id': prediction_id,
            'sequence': sequence,
            'length': len(sequence),
            'structure': result['structure'],
            'coordinates': result['coordinates'],
            'binding_pockets': result['binding_pockets'],
            'model_source': result['model_source'],
            'status': 'success',
            'timestamp': timestamp,
        })

    def log_message(self, *args):
        pass
