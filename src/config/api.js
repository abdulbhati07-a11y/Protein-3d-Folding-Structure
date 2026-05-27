/**
 * API base URL. Empty string = same origin (Vite proxy in dev, nginx in Docker).
 */
import { supabase } from './supabase';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export function apiUrl(path) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function isEsmfoldSource(modelSource) {
  return modelSource === 'esmfold' || (modelSource && String(modelSource).toLowerCase().includes('esmfold'));
}

/**
 * Return a valid access token, refreshing the session if it is near expiry.
 */
export async function getAccessToken() {
  if (!supabase) return null;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;

  const expiresAt = (session.expires_at ?? 0) * 1000;
  const needsRefresh = Date.now() > expiresAt - 60_000;

  if (needsRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }
  }

  return session.access_token;
}

/**
 * Fetch API with JSON defaults and Supabase Bearer token when logged in.
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(apiUrl(path), { ...options, headers });
}
