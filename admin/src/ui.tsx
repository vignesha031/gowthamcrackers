import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type Page } from './api';

// ───────── toast ─────────
type T = { id: number; kind: 'ok' | 'err'; text: string };
const ToastCtx = createContext<(kind: T['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((kind: T['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const errText = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong');

/** Runs an async action with a busy flag; errors go to a toast. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (ok) toast('ok', ok); return r; }
    catch (e) { toast('err', errText(e)); return undefined; }
    finally { setBusy(false); }
  }, [toast]);
  return { busy, run };
}

// ───────── data hook ─────────
export function useFetch<T>(path: string | null, q?: Record<string, string | number | boolean | undefined | null>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = path ? path + JSON.stringify(q ?? {}) : '';
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!path) return;
    const my = ++seq.current;
    setLoading(true); setError(null);
    api.get<T>(path, q).then((d) => { if (my === seq.current) { setData(d); setLoading(false); } })
      .catch((e) => { if (my === seq.current) { setError(errText(e)); setLoading(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

/** useDebounced value for search boxes */
export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

// ───────── building blocks ─────────
export function Badge({ tone = 'grey', children }: { tone?: 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'maroon'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export const payTone = (s: string) => (s === 'confirmed' || s === 'paid' || s === 'completed' || s === 'delivered' ? 'green' : s === 'submitted' || s === 'verifying' || s === 'due' ? 'amber' : s === 'rejected' || s === 'overdue' || s === 'stopped' ? 'red' : s === 'active' || s === 'packing' || s === 'dispatched' ? 'blue' : 'grey') as 'green';

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div><div className="head-actions">{children}</div></div>;
}
export function Loading({ text = 'Loading…' }: { text?: string }) { return <div className="state"><div className="spinner" />{text}</div>; }
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state err"><strong>Could not load</strong><span>{message}</span>{retry && <button className="btn sm" onClick={retry}>Try again</button>}</div>;
}
export function Empty({ text }: { text: string }) { return <div className="state empty">{text}</div>; }

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
          {t.label}{t.count ? <span className="pill">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pager({ p, onPage }: { p: Page<unknown>['pagination'] | undefined; onPage: (n: number) => void }) {
  if (!p || p.total === 0) return null;
  const from = (p.page - 1) * p.limit + 1, to = Math.min(p.total, p.page * p.limit);
  return (
    <div className="pager">
      <span className="muted">{from}–{to} of {p.total}</span>
      <div><button className="btn sm" disabled={!p.hasPrev} onClick={() => onPage(p.page - 1)}>‹ Prev</button>
        <span className="muted pg">Page {p.page} / {p.totalPages}</span>
        <button className="btn sm" disabled={!p.hasNext} onClick={() => onPage(p.page + 1)}>Next ›</button></div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'amber' | 'green' }) {
  return <div className={`stat ${tone ?? ''}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div>;
}
