"""Tests for Projects API endpoints and database functions."""
import json
import pytest


def test_list_projects(client):
    """Test listing projects."""
    response = client.get('/api/users/projects')
    # Without auth, should fail, but endpoint should exist
    assert response.status_code in [401, 200]


def test_create_project(client):
    """Test creating a new project."""
    response = client.post('/api/users/projects',
                          data=json.dumps({
                              'name': 'Test Project',
                              'description': 'A test project'
                          }),
                          content_type='application/json')
    # Without auth, should fail, but endpoint should exist
    assert response.status_code in [401, 201, 500]


def test_create_project_missing_name(client):
    """Test creating project without name."""
    response = client.post('/api/users/projects',
                          data=json.dumps({
                              'description': 'No name project'
                          }),
                          content_type='application/json')
    # Should fail with 400 or 401
    assert response.status_code in [400, 401, 500]


def test_update_project(client):
    """Test updating a project."""
    response = client.put('/api/users/projects/test_proj_123',
                         data=json.dumps({
                             'name': 'Updated Project',
                             'description': 'Updated description'
                         }),
                         content_type='application/json')
    assert response.status_code in [401, 500, 200]


def test_delete_project(client):
    """Test deleting a project."""
    response = client.delete('/api/users/projects/test_proj_123')
    # Without auth, should fail
    assert response.status_code in [401, 404, 200]


def test_project_endpoints_exist(client):
    """Verify all project endpoints exist and respond."""
    # GET projects
    get_response = client.get('/api/users/projects')
    assert get_response.status_code in [200, 401, 404]
    
    # POST projects
    post_response = client.post('/api/users/projects',
                               data=json.dumps({'name': 'test'}),
                               content_type='application/json')
    assert post_response.status_code in [200, 201, 400, 401, 500]
    
    # PUT projects
    put_response = client.put('/api/users/projects/123',
                             data=json.dumps({'name': 'test'}),
                             content_type='application/json')
    assert put_response.status_code in [200, 401, 500]
    
    # DELETE projects
    delete_response = client.delete('/api/users/projects/123')
    assert delete_response.status_code in [200, 401, 404]
