import json

def test_predict_success(client):
    response = client.post('/api/predictions/predict', 
                           data=json.dumps({'sequence': 'MKFLKFSLLTAVLLSVV'}),
                           content_type='application/json')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert 'prediction_id' in data
    assert data['sequence'] == 'MKFLKFSLLTAVLLSVV'
    assert 'coordinates' in data
    assert 'structure' in data
    assert 'binding_pockets' in data
    assert data['model_source'] in ('esmfold', 'mock')

def test_predict_missing_sequence(client):
    response = client.post('/api/predictions/predict', 
                           data=json.dumps({}),
                           content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['status'] == 'error'
    assert 'Sequence is required' in data['message']

def test_predict_invalid_sequence(client):
    response = client.post('/api/predictions/predict', 
                           data=json.dumps({'sequence': 'INVALIDX'}),
                           content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['status'] == 'error'
    assert 'Invalid amino acids' in data['message']

def test_predict_history(client):
    # Make a valid prediction
    post_res = client.post('/api/predictions/predict', 
                           data=json.dumps({'sequence': 'MKFLK'}),
                           content_type='application/json')
    assert post_res.status_code == 200
    pred_data = json.loads(post_res.data)
    pred_id = pred_data['prediction_id']

    # Retrieve history list
    list_res = client.get('/api/predictions/history')
    assert list_res.status_code == 200
    history_list = json.loads(list_res.data)
    assert len(history_list) > 0
    assert any(h['prediction_id'] == pred_id for h in history_list)

    # Retrieve specific history detail
    detail_res = client.get(f'/api/predictions/history/{pred_id}')
    assert detail_res.status_code == 200
    detail_data = json.loads(detail_res.data)
    assert detail_data['prediction_id'] == pred_id
    assert detail_data['sequence'] == 'MKFLK'
    assert 'coordinates' in detail_data

def test_predict_history_includes_new_fields(client):
    """Test that history includes new fields: is_public, notes, tags, project_id."""
    # Make a valid prediction
    post_res = client.post('/api/predictions/predict', 
                           data=json.dumps({'sequence': 'MKFLK'}),
                           content_type='application/json')
    assert post_res.status_code == 200

    # Retrieve history list
    list_res = client.get('/api/predictions/history')
    assert list_res.status_code == 200
    history_list = json.loads(list_res.data)
    assert len(history_list) > 0
    
    # Check that new fields are present
    first_item = history_list[0]
    assert 'is_public' in first_item
    assert 'notes' in first_item or first_item.get('notes') is None
    assert 'tags' in first_item or first_item.get('tags') is None
    assert 'project_id' in first_item or first_item.get('project_id') is None


def test_delete_prediction(client):
    """Test deleting a prediction."""
    # Make a prediction
    post_res = client.post('/api/predictions/predict', 
                           data=json.dumps({'sequence': 'MKFLK'}),
                           content_type='application/json')
    assert post_res.status_code == 200
    pred_id = json.loads(post_res.data)['prediction_id']

    # Delete it
    delete_res = client.delete(f'/api/predictions/history/{pred_id}')
    assert delete_res.status_code == 200
    
    # Verify it's gone
    detail_res = client.get(f'/api/predictions/history/{pred_id}')
    assert detail_res.status_code == 404

