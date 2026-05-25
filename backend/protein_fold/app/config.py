import os
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv():
    """Load backend/.env before reading configuration."""
    try:
        from dotenv import load_dotenv
        env_path = _BACKEND_ROOT / '.env'
        if env_path.is_file():
            load_dotenv(env_path, override=True)
        else:
            print(
                f'WARNING: Missing {env_path}. '
                'Copy backend/.env.example to backend/.env and add your Supabase keys.',
            )
    except ImportError:
        pass


_load_dotenv()


class Config:
    """Base configuration"""
    DEBUG = False
    TESTING = False

    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = True

    CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:5173']

    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300

    MAX_SEQUENCE_LENGTH = 10000
    PREDICTION_TIMEOUT = 300
    BATCH_SIZE = 32

    ESMFOLD_DEVICE = 'cpu'
    ESMFOLD_CHUNK_SIZE = 128
    MODEL_CACHE_DIR = str(_BACKEND_ROOT / 'models')

    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


class ProductionConfig(Config):
    ESMFOLD_DEVICE = 'cuda'
    CORS_ORIGINS = (
        os.environ.get('CORS_ORIGINS', '').split(',')
        if os.environ.get('CORS_ORIGINS')
        else ['*']
    )


class TestingConfig(Config):
    TESTING = True
    ESMFOLD_DEVICE = 'cpu'
    SUPABASE_URL = ''
    SUPABASE_JWT_SECRET = ''
    SUPABASE_SERVICE_ROLE_KEY = ''


def get_config(config_name):
    if config_name == 'production':
        return ProductionConfig
    if config_name == 'testing':
        return TestingConfig
    return DevelopmentConfig
