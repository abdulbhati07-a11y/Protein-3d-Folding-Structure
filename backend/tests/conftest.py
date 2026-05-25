import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from protein_fold.app.database import clear_memory_store
from protein_fold.app.main import create_app


@pytest.fixture
def app():
    """In-memory store; no Supabase required for unit tests."""
    clear_memory_store()
    application = create_app('testing')
    yield application
    clear_memory_store()


@pytest.fixture
def client(app):
    return app.test_client()
