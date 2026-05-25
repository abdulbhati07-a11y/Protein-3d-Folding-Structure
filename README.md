# 🧬 Protein Folding Explorer

ML-powered 3D protein structure prediction and visualization. Submit an amino acid sequence and get an interactive 3D structure with secondary structure analysis, Ramachandran plots, binding pocket detection, and export to PDB/JSON.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)
![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ecf8e?logo=supabase)
![Three.js](https://img.shields.io/badge/Three.js-3D%20viewer-black?logo=threedotjs)

## Features

- **3D structure prediction** via the [ESMFold API](https://esmatlas.com/resources?action=fold) with mock fallback
- **Interactive 3D viewer** — spheres, sticks, and cartoon ribbon render modes
- **Structure analysis** — secondary structure breakdown, Ramachandran φ/ψ plot, per-residue table
- **Binding pocket detection** with animated overlay
- **Side-by-side comparison** of two structures
- **Residue labels** in the 3D viewer
- **Export** to JSON and PDB format
- **Auth** via Supabase — per-user prediction history with delete
- **Rate limiting** on the prediction endpoint (10/min, 50/hr)
- **12 UI themes** (dark and light)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Three.js / React Three Fiber |
| Backend | Python 3.10+, Flask 3, Flask-Limiter |
| Auth & DB | Supabase (Postgres + JWT auth) |
| ML | ESMFold remote API (Meta) |

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone

```bash
git clone https://github.com/your-username/protein-folding-explorer.git
cd protein-folding-explorer
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in your Supabase credentials
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY

python wsgi.py
# → http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install

# Copy and fill in your Supabase credentials
cp .env.example .env.local
# Edit .env.local with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `localhost:5000` automatically.

### 4. Database schema

Run the SQL in `docs/supabase/schema.sql` in your Supabase project's SQL editor.

## Deployment

### Frontend → Vercel

1. Import the repo in Vercel, set **Root Directory** to `frontend`
2. Add environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` → your deployed backend URL

### Backend → Railway / Render / Fly.io

Deploy the `backend/` folder as a Python web service. Set the same environment variables from `backend/.env.example`. Update `CORS_ORIGINS` to include your Vercel domain.

## Project Structure

```
├── backend/
│   ├── protein_fold/
│   │   └── app/
│   │       ├── blueprints/     # Flask route handlers
│   │       ├── services/       # ESMFold + coordinate generation
│   │       ├── auth/           # Supabase JWT verification
│   │       ├── database.py     # Supabase / in-memory store
│   │       └── main.py         # App factory
│   ├── tests/
│   ├── requirements.txt
│   └── wsgi.py
├── frontend/
│   └── src/
│       ├── components/         # React components
│       ├── config/             # API + Supabase client
│       ├── context/            # Auth context
│       └── hooks/
├── docs/
│   ├── supabase/schema.sql
│   └── api/endpoints.md
└── docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/predictions/predict` | Predict structure (rate limited) |
| GET | `/api/predictions/history` | List user's predictions |
| GET | `/api/predictions/history/:id` | Get prediction detail |
| DELETE | `/api/predictions/history/:id` | Delete a prediction |

## Running Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests -v
```

## License

MIT

---

Made by Muhammad Abdullah Bhatti
