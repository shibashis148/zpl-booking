import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearSession, hasToken, login as loginRequest, me, saveSession, storedUser, type User } from '../services/api';

type AuthValue = { user: User | null; ready: boolean; login: (email: string, password: string, remember: boolean) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => storedUser());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!hasToken()) { setReady(true); return; }
    void me().then((value) => {
      const role = String(value.primary_role || value.roles[0] || '').toLowerCase();
      if (!['admin', 'booking_manager'].includes(role)) throw new Error('Booking Portal access required');
      setUser(value);
    }).catch(() => { clearSession(); setUser(null); }).finally(() => setReady(true));
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user,
    ready,
    login: async (email, password, remember) => {
      const token = await loginRequest(email.trim(), password);
      const current = await fetchMe(token);
      const role = String(current.primary_role || current.roles[0] || '').toLowerCase();
      if (!['admin', 'booking_manager'].includes(role)) {
        throw new Error('This account does not have Booking Portal access.');
      }
      saveSession(token, current, remember);
      setUser(current);
    },
    logout: () => { clearSession(); setUser(null); },
  }), [ready, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function fetchMe(token: string): Promise<User> {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') || (import.meta.env.PROD ? 'https://dcmjewqvn2xdz.cloudfront.net' : 'http://127.0.0.1:8000');
  const response = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Could not load your account.');
  return response.json() as Promise<User>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
