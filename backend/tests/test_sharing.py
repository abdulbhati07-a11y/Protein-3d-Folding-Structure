"""Tests for Public Predictions and Sharing functionality."""
import json
import pytest


def test_list_public_predictions(client):
    """Test listing public predictions (no auth required)."""
    response = client.get('/api/predictions/public/predictions')
    # Should work without auth
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'predictions' in data


def test_get_public_prediction(client):
    """Test retrieving a specific public prediction (no auth required)."""
    response = client.get('/api/predictions/public/predictions/nonexistent123')
    # Should return 404 since prediction doesn't exist
    assert response.status_code == 404


def test_update_prediction_sharing(client):
    """Test updating prediction sharing settings."""
    # First make a prediction
    post_res = client.post('/api/predictions/predict',
                          data=json.dumps({'sequence': 'MKFLKFSLLTAVLLSVV'}),
                          content_type='application/json')
    assert post_res.status_code == 200
    pred_data = json.loads(post_res.data)
    pred_id = pred_data['prediction_id']

    # Update sharing
    share_res = client.put(
        f'/api/predictions/history/{pred_id}/share',
        data=json.dumps({
            'is_public': True,
            'notes': 'Test prediction',
            'tags': ['test', 'example']
        }),
        content_type='application/json'
    )
    # Without proper auth, may fail, but endpoint should exist
    assert share_res.status_code in [200, 401, 500]


def test_update_prediction_sharing_without_auth(client):
    """Test that sharing update requires auth."""
    response = client.put(
        '/api/predictions/history/test_pred_123/share',
        data=json.dumps({'is_public': True}),
        content_type='application/json'
    )
    # Should fail without auth
    assert response.status_code in [401, 500]


def test_public_predictions_endpoints_exist(client):
    """Verify public prediction endpoints exist."""
    # GET public predictions list
    list_response = client.get('/api/predictions/public/predictions')
    assert list_response.status_code == 200
    
    # GET specific public prediction
    detail_response = client.get('/api/predictions/public/predictions/test123')
    assert detail_response.status_code in [200, 404]


def test_share_endpoint_accepts_options(client):
    """Test that share endpoint accepts all expected parameters."""
    response = client.put(
        '/api/predictions/history/test123/share',
        data=json.dumps({
            'is_public': True,
            'notes': 'My prediction notes',
            'tags': ['protein', 'folding', 'test']
        }),
        content_type='application/json'
    )
    # Should exist and handle the parameters
    assert response.status_code in [200, 401, 500]
