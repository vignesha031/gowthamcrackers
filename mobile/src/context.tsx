import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, useSegments } from 'expo-router';
import { ApiError, api, setApiLang, setToken, setUnauthorizedHandler, uid, type ProfilePatch } from '@/api';
import { STORAGE } from '@/config';
import { getItem, setItem } from '@/storage';
import type { AppConfig, Draft, Enrolment, Me, PaymentResult } from '@/types';

export type Lang = 'ta' | 'en';

interface AppContextValue {
  /** storage has been read and (if signed in) the first load has finished */
  ready: boolean;
  lang: Lang;
  /** t('தமிழ்', 'English') */
  t: (ta: string, en: string) => string;
  setLang: (l: Lang) => void;
  config: AppConfig | null;
  /** set when /config could not be loaded (no network, server down) */
  configError: string;
  reloadConfig: () => Promise<void>;
  loggedIn: boolean;
  me: Me | null;
  enrolments: Enrolment[];
  /** set when my plans could not be loaded */
  loadError: string;
  /** reloads me + my plans; resolves true on success */
  refresh: () => Promise<boolean>;
  requestOtp: (mobile: string) => Promise<{ length: number; devOtp?: string }>;
  verifyOtp: (mobile: string, code: string) => Promise<{ isNew: boolean }>;
  saveProfile: (patch: ProfilePatch) => Promise<void>;
  join: (planId: string) => Promise<Enrolment>;
  pay: (enrolmentId: string, body: { method: 'upi' | 'bank'; utr?: string }, key: string) => Promise<PaymentResult>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>('ta');
  const [token, setTokenState] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [loadError, setLoadError] = useState('');

  const reloadConfig = useCallback(async () => {
    try {
      setConfig(await api.config());
      setConfigError('');
    } catch (e) {
      setConfigError(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([api.me(), api.enrolments()]);
      setMe(m);
      setEnrolments(e.items);
      setLoadError('');
      return true;
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load');
      return false;
    }
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMe(null);
    setEnrolments([]);
    setItem(STORAGE.token, null);
  }, []);

  // boot: read saved language + login, then load config and (if signed in) my data
  useEffect(() => {
    (async () => {
      const [savedLang, savedToken] = await Promise.all([getItem(STORAGE.lang), getItem(STORAGE.token)]);
      if (savedLang === 'ta' || savedLang === 'en') { setLangState(savedLang); setApiLang(savedLang); }
      setUnauthorizedHandler(clearSession);
      if (savedToken) { setToken(savedToken); setTokenState(savedToken); }
      await Promise.all([reloadConfig(), savedToken ? refresh() : Promise.resolve(true)]);
      setReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearSession, reloadConfig, refresh]);

  const t = useCallback((ta: string, en: string) => (lang === 'ta' ? ta : en), [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setApiLang(l);
    setItem(STORAGE.lang, l);
    if (token) api.updateMe({ lang: l }).catch(() => {});
  }, [token]);

  const requestOtp = useCallback(async (mobile: string) => {
    const r = await api.sendOtp(mobile);
    return { length: r.length, devOtp: r.devOtp };
  }, []);

  const verifyOtp = useCallback(async (mobile: string, code: string) => {
    const r = await api.verifyOtp(mobile, code);
    setToken(r.token);
    setTokenState(r.token);
    await setItem(STORAGE.token, r.token);
    await refresh();
    return { isNew: r.isNew };
  }, [refresh]);

  const saveProfile = useCallback(async (patch: ProfilePatch) => {
    await api.updateMe(patch);
    setMe(await api.me());
  }, []);

  const join = useCallback(async (planId: string) => {
    const e = await api.join(planId);
    setEnrolments((list) => [e, ...list.filter((x) => x.id !== e.id)]);
    api.me().then(setMe).catch(() => {});
    return e;
  }, []);

  const pay = useCallback(async (enrolmentId: string, body: { method: 'upi' | 'bank'; utr?: string }, key: string) => {
    const r = await api.pay(enrolmentId, body, key);
    setEnrolments((list) => list.map((x) => (x.id === r.enrolment.id ? r.enrolment : x)));
    api.me().then(setMe).catch(() => {});
    return r;
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.deleteMe();
    clearSession();
  }, [clearSession]);

  const value = useMemo<AppContextValue>(
    () => ({ ready, lang, t, setLang, config, configError, reloadConfig, loggedIn: !!token, me, enrolments, loadError, refresh, requestOtp, verifyOtp, saveProfile, join, pay, logout: clearSession, deleteAccount }),
    [ready, lang, t, setLang, config, configError, reloadConfig, token, me, enrolments, loadError, refresh, requestOtp, verifyOtp, saveProfile, join, pay, clearSession, deleteAccount],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Reloads my data when a screen comes into view (at most every `gapMs`). */
export function useFocusRefresh(gapMs = 8000) {
  const { refresh, loggedIn } = useApp();
  const last = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (!loggedIn || Date.now() - last.current < gapMs) return;
      last.current = Date.now();
      refresh();
    }, [refresh, loggedIn, gapMs]),
  );
}

/** Pull-to-refresh state for <Screen refreshing onRefresh>: reloads config + my data. */
export function usePullRefresh() {
  const { refresh, reloadConfig } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), reloadConfig()]);
    setRefreshing(false);
  }, [refresh, reloadConfig]);
  return { refreshing, onRefresh };
}

/** Sends signed-out users back to the welcome screen if they land on a signed-in screen (e.g. after the session expires). */
export function AuthGuard() {
  const { ready, loggedIn } = useApp();
  const segments = useSegments() as string[];
  const router = useRouter();
  const first = segments[0] ?? '';
  const inTabs = first === '(tabs)';
  const open = first === '' || first === 'index' || first === 'login' || first === 'otp' || first === 'terms' || first === 'help' || first === 'plans' || first === 'plan';
  useEffect(() => {
    if (ready && !loggedIn && !open && !inTabs) router.replace('/');
  }, [ready, loggedIn, open, inTabs, router]);
  return null;
}

export const draftFromMe = (me: Me | null): Draft => ({
  name: me?.name ?? '',
  deliveryMode: me?.deliveryMode ?? 'parcel',
  pickupStore: me?.pickupStore ?? 'main',
  address: me?.address ?? '',
  city: me?.city ?? '',
  pincode: me?.pincode ?? '',
});

export { uid };
