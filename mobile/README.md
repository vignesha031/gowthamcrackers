# Gowtham Crackers — Deepavali Savings Scheme app (Expo / React Native)

Built on the GiGold app's look (maroon / gold / cream, Tamil ⇄ English `t(ta, en)`), for the
"Deepavali Pattasu Siru Semippu Thittam 2027" flyer: 6 plans, 9 monthly instalments
(Dec 2026 – Aug 2027), +1 month bonus, calendar / special gift, terms from the back of the flyer.

Login is **mobile OTP only** — no MPIN, no KYC.

## Run
```
npm install
npx expo start        # press a / i, or scan with Expo Go
npx tsc --noEmit      # typecheck
```

## Where things are
| What | File |
|---|---|
| Shop name, phone, UPI, bank, stores, OTP settings | `src/config.ts` |
| Plans (₹300…₹2000), dates, bonus rules, terms text | `src/data.ts` |
| Instalment / on-time / bonus logic | `src/schedule.ts` |
| App state, saved on the phone (AsyncStorage) | `src/context.tsx` |
| OTP + (future) server calls | `src/api.ts` |
| Online shop (coming soon tab) | `src/app/(tabs)/shop.tsx` |

## Before going live
1. **OTP is in demo mode** (any 4 digits work). Connect an SMS/OTP provider in `src/api.ts`
   and set `OTP.demo = false` in `src/config.ts`.
2. **Payments are recorded on the phone only.** The customer pays via UPI / bank transfer (as on
   the flyer), taps "I have paid", and sends the screenshot on WhatsApp. Status stays
   "Verifying" until a backend lets the shop mark it confirmed.
3. Replace the default Expo icon/splash in `assets/`.

## Adding online shopping later
Build the catalogue / cart in the `Shop` tab (`src/app/(tabs)/shop.tsx`). Nothing else needs to change.
