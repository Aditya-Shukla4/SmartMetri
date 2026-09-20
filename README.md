# SmartMetri SIH26036 MVP

SmartMetri is an end-to-end prototype for online verification of weighing and measuring instruments:

`BUSINESS → APPLICATION → ADMIN REVIEW/ASSIGNMENT → LMO INSPECTION → OFFLINE SYNC → PASS/FAIL → CERTIFICATE → QR VERIFICATION`

The repository contains three applications:

- `server/` — Express + TypeScript + Prisma + PostgreSQL/Supabase
- `client/` — Vite React + TypeScript web portal for business, admin, and public verification
- `mobile/` — Expo React Native field app with SQLite offline queue, camera, GPS, and NetInfo sync

## Local setup

Install dependencies in each application, then configure `server/.env` from `server/.env.example`. Set a PostgreSQL `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, Supabase storage credentials, and `PUBLIC_APP_URL`. Set `VITE_API_BASE_URL` for the web app and `EXPO_PUBLIC_API_URL` for the mobile app when the API is not on the default local address.

Run the applications in separate terminals:

```text
cd server  && npm run dev
cd client  && npm run dev
cd mobile  && npm start
```

## Database safety

`server/prisma/migrations/0001_smartmetri_initial/migration.sql` is the fresh-database baseline. An existing database without Prisma migration history must be backed up, checked for duplicate assignment rows, and staged before applying `server/prisma/legacy-upgrade.sql`. Follow `server/prisma/MIGRATION.md`.

Never run `prisma migrate reset` against the configured database. Run the seed only after the schema is confirmed:

```text
cd server
npx prisma validate
npm run seed
```

The seed uses synthetic demo records and is intended for a staging/demo database.

## Demo flow

1. Register or log in as a business and register an instrument.
2. Submit an application with evidence.
3. Log in as admin, review it, assign an LMO, and schedule it.
4. Log in to the mobile app as an LMO, cache assignments/checklists, start an inspection offline, capture GPS-tagged evidence, complete the checklist, and save PASS or FAIL.
5. Restore connectivity and sync. Duplicate retries are idempotent by `clientSyncId`.
6. Log in as admin and issue a certificate for a passing inspection.
7. Open `/verify/{certificateNumber}` to check the server-backed QR/public status.

The seed also provides synthetic valid, expiring, expired, revoked, failed, and reinspection cases. Demo credentials, when seeded, are documented by the seed output and must not be reused in production.

## Verification commands

```text
cd server
npm run build
npm test
npx prisma validate

cd ../client
npm run build
npm run lint

cd ../mobile
npm run typecheck
```

This prototype intentionally does not include AI, blockchain, payments, cryptocurrency, IoT, or other unrelated features. Legal tolerances and validity periods remain configurable rather than invented in code.
