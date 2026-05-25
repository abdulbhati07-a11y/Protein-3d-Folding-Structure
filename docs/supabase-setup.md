# Supabase setup (auth + database)

The app uses Supabase for **authentication** and **Postgres storage** (no local SQLite).

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a project.
2. Open **Project Settings → API** and copy:

| Dashboard field | Environment variable | Where |
|-----------------|----------------------|--------|
| Project URL | `SUPABASE_URL` / `VITE_SUPABASE_URL` | Backend + frontend |
| anon public | `VITE_SUPABASE_ANON_KEY` | Frontend only |
| JWT Secret | `SUPABASE_JWT_SECRET` | Backend only |
| service_role | `SUPABASE_SERVICE_ROLE_KEY` | Backend only — never expose in frontend |

## 2. Run the database schema

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the contents of [`schema.sql`](schema.sql).
3. Click **Run**.

This creates the `predictions` table, indexes, and Row Level Security policies.

## 3. Enable email auth

1. **Authentication → Providers → Email** — enable Email.
2. For local dev you may disable **Confirm email** (optional).
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`

## 4. Frontend (`frontend/.env.local`)

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Backend (`backend/.env`)

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The backend loads `backend/.env` automatically via `python-dotenv` when present.

Restart both servers after changing env files.

## 6. Remove old local SQLite (optional)

If you still have `backend/app.db` from an earlier version, you can delete it — it is no longer used.

## 7. How it works

| Layer | Behavior |
|-------|----------|
| Frontend | Supabase Auth session; `apiFetch` sends JWT |
| Backend | Verifies JWT (ES256 via JWKS or legacy HS256 secret); writes/reads `predictions` via service role |
| Postgres | One row per prediction, scoped by `user_id` |
| RLS | Protects direct client access; backend filters by `user_id` too |

## 8. Production checklist

- HTTPS for frontend and backend
- `CORS_ORIGINS` set to your production frontend URL
- Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET`
- Run `schema.sql` on your production Supabase project
