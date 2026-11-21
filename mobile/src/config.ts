/**
 * App-level settings only. Everything about the shop and the scheme (plans, dates, terms,
 * UPI / bank details, stores) comes from the server (GET /api/config), so next year's scheme
 * is changed in the admin panel — no app release needed.
 */

/**
 * Where the backend lives. Set EXPO_PUBLIC_API_URL (see .env.example):
 *  - iOS simulator / web      http://localhost:4000
 *  - Android emulator         http://10.0.2.2:4000
 *  - real phone (same Wi-Fi)  http://<your-laptop-LAN-IP>:4000
 *  - production               https://api.your-domain.in
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const OTP_RESEND_SECONDS = 30;

export const STORAGE = { token: 'gc.token', lang: 'gc.lang' } as const;

/** Only used by the logo before /config has loaded (first launch with no network). */
export const FALLBACK_BRAND = { nameTa: 'கௌதம்', subTa: 'பட்டாசு கடை', nameEn: 'Gowtham Crackers', since: 1987 };
