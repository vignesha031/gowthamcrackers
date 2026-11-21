import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

export type Me = { id: string; name: string; role: string; permissions: string[]; mustChangePassword: boolean; email?: string };
type Ctx = {
  me: Me | null; loading: boolean; badges: { waiting: number; overdue: number };
  login: (email: string, password: string) => Promise<void>; logout: () => void; refreshMe: () => Promise<void>; refreshBadges: () => void;
  can: (perm: string) => boolean;
};
const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const [badges, setBadges] = useState({ waiting: 0, overdue: 0 });

  const logout = useCallback(() => { setToken(null); setMe(null); setBadges({ waiting: 0, overdue: 0 }); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const refreshMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try { setMe(await api.get<Me>('/admin/me')); } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);

  const refreshBadges = useCallback(() => { api.get('/admin/badges').then(setBadges).catch(() => {}); }, []);
  useEffect(() => {
    if (!me || me.mustChangePassword) return;
    refreshBadges();
    const t = setInterval(refreshBadges, 30_000);
    return () => clearInterval(t);
  }, [me, refreshBadges]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ token: string; admin: Me }>('/admin/auth/login', { email, password });
    setToken(r.token); setMe(r.admin);
  }, []);

  const value = useMemo<Ctx>(() => ({
    me, loading, badges, login, logout, refreshMe, refreshBadges,
    can: (perm) => !!me && (me.role === 'super_admin' || me.permissions.includes(perm) || (perm.endsWith('.view') && me.permissions.includes(perm.replace('.view', '.manage')))),
  }), [me, loading, badges, login, logout, refreshMe, refreshBadges]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
