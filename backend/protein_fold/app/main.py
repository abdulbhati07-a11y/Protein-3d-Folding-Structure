import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .config import get_config

# Module-level limiter — blueprints import this to apply decorators
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri='memory://',
)


def create_app(config_name='development'):
    """Application factory pattern."""
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    # Refresh from environment (loaded via config._load_dotenv)
    app.config['SUPABASE_URL'] = os.environ.get('SUPABASE_URL', '')
    app.config['SUPABASE_JWT_SECRET'] = os.environ.get('SUPABASE_JWT_SECRET', '')
    app.config['SUPABASE_SERVICE_ROLE_KEY'] = os.environ.get(
        'SUPABASE_SERVICE_ROLE_KEY', '',
    )

    # Disable rate limiting in tests so they run at full speed
    app.config['RATELIMIT_ENABLED'] = not app.config.get('TESTING', False)

    limiter.init_app(app)

    from .database import init_db
    with app.app_context():
        init_db()

    CORS(app, resources={
        r'/api/*': {
            'origins': app.config.get('CORS_ORIGINS', ['*']),
            'methods': ['GET', 'POST', 'PUT', 'DELETE'],
            'allow_headers': ['Content-Type', 'Authorization'],
        },
    })

    from .blueprints.health import health_bp
    app.register_blueprint(health_bp, url_prefix='/api/health')

    from .blueprints.predictions import predictions_bp
    app.register_blueprint(predictions_bp, url_prefix='/api/predictions')

    # Return a clean JSON 429 instead of the default HTML page
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({
            'status': 'error',
            'message': f'Rate limit exceeded. {e.description}',
        }), 429

    return app
