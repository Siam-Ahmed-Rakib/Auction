'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync the app-level user profile from backend after Supabase auth
  const syncProfile = useCallback(async () => {
    try {
      const userData = await api.syncUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to sync profile:', err);
      // If token is invalid, clear the stale session
      if (err.message?.includes('401') || err.message?.includes('Authentication') || err.message?.includes('token')) {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        syncProfile();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s) {
          await syncProfile();
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [syncProfile]);

  const login = async (email, password) => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const register = async ({ name, username, email, password }) => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, username } },
    });
    if (error) throw error;
    return data;
  };

  const loginWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const loadUser = useCallback(async () => {
    if (session) {
      await syncProfile();
    }
  }, [session, syncProfile]);

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, loginWithGoogle, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
