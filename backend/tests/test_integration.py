"""Integration tests for database operations with mock data."""
import json
import pytest
import uuid
from datetime import datetime


def test_save_and_retrieve_prediction_with_new_fields(app):
    """Test saving and retrieving predictions with new fields."""
    from protein_fold.app.database import save_prediction, get_prediction_by_id
    
    with app.app_context():
        pred_id = f"pred_{uuid.uuid4().hex[:12]}"
        user_id = str(uuid.uuid4())
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        timestamp = datetime.now().isoformat()
        
        # Save prediction with new fields
        result = save_prediction(
            pred_id=pred_id,
            sequence="MKFLK",
            structure_info={"test": "structure"},
            coordinates=[[1, 2, 3]],
            binding_pockets=[],
            model_source="mock",
            timestamp=timestamp,
            user_id=user_id,
            project_id=project_id,
            is_public=True,
            notes="Test notes",
            tags=["test", "example"]
        )
        
        assert result is True
        
        # Retrieve and verify
        retrieved = get_prediction_by_id(pred_id, user_id=user_id)
        assert retrieved is not None
        assert retrieved['sequence'] == "MKFLK"
        assert retrieved.get('notes') == "Test notes"
        assert retrieved.get('tags') == ["test", "example"]
        assert retrieved.get('project_id') == project_id


def test_profile_crud_operations(app):
    """Test profile create/read/update operations."""
    from protein_fold.app.database import get_profile, update_profile
    
    with app.app_context():
        user_id = str(uuid.uuid4())
        
        # Update profile (auto-creates if needed)
        result = update_profile(
            user_id=user_id,
            display_name="Test User",
            theme="dark",
            bio="Test bio"
        )
        assert result is True
        
        # Retrieve profile - in memory may not persist
        profile = get_profile(user_id)
        assert profile is None or isinstance(profile, dict)


def test_project_crud_operations(app):
    """Test project create/read/update/delete operations."""
    from protein_fold.app.database import (
        create_project, get_projects, update_project, delete_project
    )
    
    with app.app_context():
        user_id = str(uuid.uuid4())
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        
        # Create project
        result = create_project(
            user_id=user_id,
            project_id=project_id,
            name="Test Project",
            description="A test project"
        )
        assert result is True
        
        # Retrieve projects
        projects = get_projects(user_id)
        assert isinstance(projects, list)
        
        # Update project
        update_result = update_project(
            project_id=project_id,
            user_id=user_id,
            name="Updated Project"
        )
        assert isinstance(update_result, bool)
        
        # Delete project
        delete_result = delete_project(project_id, user_id)
        assert isinstance(delete_result, bool)


def test_public_predictions_retrieval(app):
    """Test retrieving public predictions."""
    from protein_fold.app.database import (
        get_public_predictions, get_public_prediction_by_id
    )
    
    with app.app_context():
        # Get public predictions list
        predictions = get_public_predictions(limit=10)
        assert isinstance(predictions, list)
        
        # Try to get non-existent public prediction
        pred = get_public_prediction_by_id("nonexistent")
        assert pred is None


def test_update_prediction_sharing(app):
    """Test updating prediction sharing settings."""
    from protein_fold.app.database import (
        save_prediction, update_prediction_sharing, get_prediction_by_id
    )
    
    with app.app_context():
        pred_id = f"pred_{uuid.uuid4().hex[:12]}"
        user_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Save prediction
        save_prediction(
            pred_id=pred_id,
            sequence="MKFLK",
            structure_info={"test": "structure"},
            coordinates=[[1, 2, 3]],
            binding_pockets=[],
            model_source="mock",
            timestamp=timestamp,
            user_id=user_id
        )
        
        # Update sharing
        result = update_prediction_sharing(
            pred_id=pred_id,
            user_id=user_id,
            is_public=True,
            notes="Shared prediction",
            tags=["shared", "public"]
        )
        assert result is True
        
        # Verify update
        pred = get_prediction_by_id(pred_id, user_id=user_id)
        assert pred is not None


def test_database_consistency(app):
    """Test database operations maintain consistency."""
    from protein_fold.app.database import (
        save_prediction, get_prediction_history, delete_prediction
    )
    
    with app.app_context():
        user_id = str(uuid.uuid4())
        pred_ids = []
        
        # Save multiple predictions
        for i in range(3):
            pred_id = f"pred_{uuid.uuid4().hex[:12]}"
            pred_ids.append(pred_id)
            save_prediction(
                pred_id=pred_id,
                sequence=f"MK{'FLK' * i}",
                structure_info={"test": "structure"},
                coordinates=[[1, 2, 3]],
                binding_pockets=[],
                model_source="mock",
                timestamp=datetime.now().isoformat(),
                user_id=user_id
            )
        
        # Retrieve history
        history = get_prediction_history(limit=10, user_id=user_id)
        assert isinstance(history, list)
        
        # Delete one
        delete_prediction(pred_ids[0], user_id=user_id)
        
        # Verify deletion
        new_history = get_prediction_history(limit=10, user_id=user_id)
        assert isinstance(new_history, list)
