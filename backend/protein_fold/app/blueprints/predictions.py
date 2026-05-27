import uuid
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, request

from protein_fold.app.auth import auth_enabled, require_auth
from protein_fold.app.database import (
    delete_prediction,
    get_prediction_by_id,
    get_prediction_history,
    get_prediction_by_sequence,
    get_public_predictions,
    get_public_prediction_by_id,
    save_prediction,
    update_prediction_sharing,
)
from protein_fold.app.main import limiter
from protein_fold.app.services.coordinate_generator import predict_protein_structure

predictions_bp = Blueprint('predictions', __name__)


def _scoped_user_id():
    """When auth is on, scope DB queries to the logged-in user."""
    return getattr(g, 'user_id', None)


@predictions_bp.route('/predict', methods=['POST'])
@require_auth
@limiter.limit('10 per minute; 50 per hour')
def predict():
    data = request.json or {}
    sequence = data.get('sequence')

    if not sequence:
        return jsonify({"status": "error", "message": "Sequence is required"}), 400

    max_len = current_app.config.get('MAX_SEQUENCE_LENGTH', 10000)
    min_len = 2

    if len(sequence) < min_len:
        return jsonify({
            "status": "error",
            "message": f"Sequence too short. Minimum length is {min_len} amino acids.",
        }), 400

    if len(sequence) > max_len:
        return jsonify({
            "status": "error",
            "message": f"Sequence too long ({len(sequence)} residues). Maximum allowed is {max_len}.",
        }), 400

    valid_aa = set("ACDEFGHIKLMNPQRSTVWY")
    if not all(c.upper() in valid_aa for c in sequence):
        return jsonify({"status": "error", "message": "Invalid amino acids in sequence"}), 400

    prediction_id = f"pred_{uuid.uuid4().hex[:12]}"
    sequence = sequence.upper()
    timestamp = datetime.now().isoformat()
    user_id = _scoped_user_id()

    if auth_enabled() and not user_id:
        return jsonify({
            "status": "error",
            "message": "Authenticated user required to save predictions.",
        }), 401

    # Check for existing global prediction to save time
    cached = get_prediction_by_sequence(sequence)
    if cached:
        result = {
            "structure": cached["structure"],
            "coordinates": cached["coordinates"],
            "binding_pockets": cached["binding_pockets"],
            "model_source": cached["model_source"]
        }
    else:
        result = predict_protein_structure(sequence)

    if not save_prediction(
        pred_id=prediction_id,
        sequence=sequence,
        structure_info=result["structure"],
        coordinates=result["coordinates"],
        binding_pockets=result["binding_pockets"],
        model_source=result["model_source"],
        timestamp=timestamp,
        user_id=user_id,
    ):
        return jsonify({
            "status": "error",
            "message": "Failed to save prediction to database.",
        }), 500

    return jsonify({
        "prediction_id": prediction_id,
        "sequence": sequence,
        "length": len(sequence),
        "structure": result["structure"],
        "coordinates": result["coordinates"],
        "binding_pockets": result["binding_pockets"],
        "model_source": result["model_source"],
        "status": "success",
        "timestamp": timestamp,
    })


@predictions_bp.route('/history', methods=['GET'])
@require_auth
def get_history():
    limit = request.args.get('limit', default=10, type=int)
    history = get_prediction_history(limit, user_id=_scoped_user_id())
    return jsonify(history)


@predictions_bp.route('/history/<pred_id>', methods=['GET'])
@require_auth
def get_history_detail(pred_id):
    prediction = get_prediction_by_id(pred_id, user_id=_scoped_user_id())
    if prediction:
        return jsonify(prediction)
    return jsonify({"status": "error", "message": "Prediction not found"}), 404


@predictions_bp.route('/history/<pred_id>', methods=['DELETE'])
@require_auth
def delete_history_item(pred_id):
    user_id = _scoped_user_id()
    deleted = delete_prediction(pred_id, user_id=user_id)
    if deleted:
        return jsonify({"status": "success", "message": "Prediction deleted"}), 200
    return jsonify({"status": "error", "message": "Prediction not found"}), 404


# ============================================================================
# Sharing & Public Predictions
# ============================================================================

@predictions_bp.route('/history/<pred_id>/share', methods=['PUT'])
@require_auth
def update_sharing(pred_id):
    """Toggle sharing and update prediction metadata."""
    user_id = _scoped_user_id()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.json or {}
    is_public = data.get('is_public', False)
    notes = data.get('notes')
    tags = data.get('tags', [])

    if not update_prediction_sharing(
        pred_id=pred_id,
        user_id=user_id,
        is_public=is_public,
        notes=notes,
        tags=tags,
    ):
        return jsonify({
            "status": "error",
            "message": "Failed to update prediction sharing or prediction not found",
        }), 500

    return jsonify({"status": "success"})


@predictions_bp.route('/public/predictions', methods=['GET'])
def list_public_predictions():
    """Get public predictions (no auth required)."""
    limit = request.args.get('limit', default=50, type=int)
    predictions = get_public_predictions(limit=limit)
    return jsonify({"predictions": predictions})


@predictions_bp.route('/public/predictions/<pred_id>', methods=['GET'])
def get_public_prediction(pred_id):
    """Get a specific public prediction (no auth required)."""
    prediction = get_public_prediction_by_id(pred_id)
    if prediction:
        return jsonify(prediction)
    return jsonify({"status": "error", "message": "Prediction not found"}), 404
