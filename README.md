# Gowtham Crackers – Deepavali savings scheme

- server/  – Express + Drizzle + Postgres API (complete, 28 tests pass)
- admin/   – Vite/React admin panel (PARTIAL: login, dashboard, payments, cash entry, change password)
- mobile/  – Expo app (PARTIAL wiring to the API; src/api.ts, context, some screens done)

## Server
cd server && npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGIN, SMS_PROVIDER
npm run db:migrate && npm run db:seed
npm run dev            # http://localhost:4000/api/config
npm test               # needs a test Postgres
Admin login = ADMIN_EMAIL / ADMIN_PASSWORD from .env.

## Admin
cd admin && npm install --legacy-peer-deps && npm run dev   (set API URL in src/api.ts / vite proxy)

## Mobile
cd mobile && npm install --legacy-peer-deps
EXPO_PUBLIC_API_URL=http://<your-ip>:4000 npx expo start
