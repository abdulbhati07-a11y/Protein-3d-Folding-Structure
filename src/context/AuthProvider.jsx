import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../config/supabase';
import { AuthContext } from './auth-context';
import { fetchProfile } from '../services/api';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setUser(current?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when user is authenticated
  useEffect(() => {
    if (user && session) {
      fetchProfile(session.access_token)
        .then((data) => {
          setProfile(data);
        })
        .catch((error) => {
          console.error('Failed to fetch profile:', error);
          setProfile(null);
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null);
    }
  }, [user, session]);

  const signUp = async (email, password, displayName) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } };
    }
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
  };

  const signIn = async (email, password) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } };
    }
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    if (!supabase) return { error: null };
    return supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    if (!supabase) {
      return { error: { message: 'Supabase is not configured.' } };
    }
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });
  };

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      isConfigured: isSupabaseConfigured,
      signUp,
      signIn,
      signOut,
      resetPassword,
      displayName:
        profile?.display_name
        || user?.user_metadata?.display_name
        || user?.email?.split('@')[0]
        || null,
    }),
    [session, user, profile, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
