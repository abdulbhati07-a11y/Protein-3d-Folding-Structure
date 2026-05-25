# Protein Fold API

Flask backend for protein structure prediction.

## Setup

```powershell
cd backend
..\venv\Scripts\pip install -e ".[dev]"
```

## Run (development)

```powershell
cd backend
..\venv\Scripts\python wsgi.py
```

API: `http://localhost:5000/api/health`

## Tests

```powershell
cd backend
..\venv\Scripts\python -m pytest tests -v
```

Tests use an isolated SQLite file under a temporary directory (not `app.db`).
