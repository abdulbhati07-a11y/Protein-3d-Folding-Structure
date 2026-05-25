import os

from protein_fold.app.main import create_app

_config = os.environ.get('FLASK_ENV', 'development')
if _config == 'production':
    app = create_app('production')
elif _config == 'testing':
    app = create_app('testing')
else:
    app = create_app('development')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
