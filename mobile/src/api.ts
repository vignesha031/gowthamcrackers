import { API_URL } from '@/config';
import type { AppConfig, Enrolment, Me, Notice, PaymentResult, PaymentRow } from '@/types';

/** A failed call. `message` is safe to show to the customer. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
  get isNetwork() { return this.status === 0; }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
let lang: 'ta' | 'en' = 'ta';
export const setToken = (t: string | null) => { token = t; };
export const setApiLang = (l: 'ta' | 'en') => { lang = l; };
/** Called when the server says the saved login is no longer valid (expired / account blocked). */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

const TIMEOUT_MS = 15_000;

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      signal: ctl.signal,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, lang === 'ta' ? 'சர்வருடன் இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.' : 'Could not reach the server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? (lang === 'ta' ? 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.' : 'Something went wrong. Please try again.'), data?.code);
  }
  return data as T;
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

export interface ProfilePatch {
  name?: string; lang?: 'ta' | 'en'; deliveryMode?: 'parcel' | 'pickup'; pickupStore?: string;
  address?: string; city?: string; pincode?: string; referralCode?: string;
}

export const api = {
  config: () => call<AppConfig>('GET', '/config'),
  sendOtp: (mobile: string) => call<{ sent: true; length: number; devOtp?: string }>('POST', '/auth/otp', { mobile }),
  verifyOtp: (mobile: string, code: string) => call<{ token: string; isNew: boolean }>('POST', '/auth/verify', { mobile, code }),
  me: () => call<Me>('GET', '/me'),
  updateMe: (patch: ProfilePatch) => call<unknown>('PATCH', '/me', patch),
  deleteMe: () => call<{ ok: true }>('DELETE', '/me'),
  enrolments: () => call<{ items: Enrolment[] }>('GET', '/enrolments'),
  enrolment: (id: string) => call<Enrolment>('GET', `/enrolments/${id}`),
  join: (planId: string) => call<Enrolment>('POST', '/enrolments', { planId }),
  /** `key` makes a retried tap safe: the server returns the first payment instead of creating a second. */
  pay: (enrolmentId: string, body: { method: 'upi' | 'bank'; utr?: string }, key: string) =>
    call<PaymentResult>('POST', `/enrolments/${enrolmentId}/payments`, body, { 'Idempotency-Key': key }),
  payments: () => call<{ items: PaymentRow[] }>('GET', '/payments'),
  notifications: () => call<{ items: Notice[] }>('GET', '/me/notifications?limit=50'),
  readNotification: (id: string) => call<{ ok: true }>('POST', `/me/notifications/${id}/read`),
  readAllNotifications: () => call<{ ok: true }>('POST', '/me/notifications/read-all'),
};
