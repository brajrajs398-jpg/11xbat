import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, hasToken, saveToken, type Profile, type Session, type User } from '@/lib/api';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** DEV ONLY — bypasses the backend entirely with a fake local session so
   * the UI (catalog, skins, layouts) can be reviewed without a reachable
   * API. Any action that actually calls the backend (placing a bet,
   * dealing a hand, etc.) will still fail — this is for visual QA only.
   * Remove before a real launch build. */
  devSkipSignIn: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => hasToken() ? { access_token: localStorage.getItem('playvault_token')! } : null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setProfile(data.profile);
      setSession({ access_token: localStorage.getItem('playvault_token')! });
    } catch {
      clearToken();
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    refreshProfile().finally(() => setLoading(false));
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const data = await api.signUp(email, password, username);
      saveToken(data.token);
      setSession({ access_token: data.token });
      setUser(data.user);
      setProfile(data.profile);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to create account' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api.signIn(email, password);
      saveToken(data.token);
      setSession({ access_token: data.token });
      setUser(data.user);
      setProfile(data.profile);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to sign in' };
    }
  };

  const signOut = async () => {
    try { await api.signOut(); } catch { /* local sign-out still succeeds */ }
    clearToken();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const devSkipSignIn = () => {
    setSession({ access_token: 'dev-local-token' });
    setUser({ id: 'dev-local-user', email: 'dev@local.test' });
    setProfile({ id: 'dev-local-user', username: 'DevPreview', balance: 1000, created_at: new Date().toISOString() });
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile, devSkipSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
