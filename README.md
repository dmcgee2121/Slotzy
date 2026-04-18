# Slotzy (prototype)

## Run locally (recommended)
1. Open the project root folder (the folder that contains `index.html`, `css/`, `js/`, `assets/`, `pages/`) in VSCode.
2. Install the VSCode extension `Live Server`.
3. Right-click `index.html` and choose `Open with Live Server`.

If you open only the `pages/` folder as your VSCode workspace, the browser will not be able to resolve `../css` and `../js` paths.

## Run locally without Live Server
1. From the repo root, install dependencies:
   - `npm install`
2. Start the static dev server:
   - `npm run serve`
3. Open:
   - `http://localhost:5173`
4. In VS Code, press `F5` to run the `Slotzy: Launch in Edge` debug profile.

Notes:
- The server serves the project root, so both `index.html` and `pages/index.html` work correctly.
- If port `5173` is busy, run `node scripts/serve.cjs 5174` and open `http://localhost:5174`.
- The VS Code launch config opens `http://localhost:5173/pages/index.html` in Microsoft Edge after the server is ready.

## Run frontend + API server together
1. Start backend server:
   - `cd server`
   - `npm install`
   - `npm run dev`
2. Keep backend running at `http://localhost:3001`.
3. In a separate terminal (or VSCode Live Server), run frontend from repo root:
   - open `index.html` with Live Server.

Auth endpoints used by frontend:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Domain CRUD endpoints (JWT required):
- `GET /api/shops`
- `POST /api/shops`
- `PATCH /api/shops/:shopId`
- `GET /api/services`
- `POST /api/services`
- `PATCH /api/services/:serviceId`
- `DELETE /api/services/:serviceId`
- `GET /api/availability`
- `PUT /api/availability`
- `GET /api/bookings`
- `POST /api/bookings`
- `PATCH /api/bookings/:bookingId`

## Email notifications and Dev Outbox
Slotzy supports booking, cancellation, and reschedule emails through the API server.

### Run the server
1. From the repo root:
   - `cd server`
   - `npm install`
2. Start the API:
   - `npm run dev`
3. Keep the frontend running separately from the repo root:
   - `npm run serve`
4. Open the app:
   - `http://localhost:5173`

### View the Dev Outbox
If SMTP is not configured, emails are stored in `server/src/db.json` under `emails`.

1. Start both the frontend and API server.
2. Open:
   - `http://localhost:5173/pages/dev-emails.html`
3. Use:
   - `Refresh` to reload the latest 50 emails
   - `Clear` to empty the outbox

Dev endpoints:
- `GET /api/dev/emails`
- `DELETE /api/dev/emails`

### Enable real SMTP
Create a local `.env` in `server/` (or export environment variables) with:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

When all SMTP variables are present, Slotzy sends real email through `nodemailer`. If any are missing, it automatically falls back to the Dev Outbox.

Never commit SMTP secrets or real mailbox credentials to source control.

## Server db.json shape
```json
{
  "users": [],
  "shops": [],
  "services": [],
  "availability": {},
  "bookings": [],
  "emails": []
}
```

## Role and scope rules
- `owner`: can manage own shop and all provider records (owner/barber) in that shop.
- `barber`: can manage only own services, availability, and bookings.
- Clients do not sign in. They book through `/pages/book.html?shop=slug` and manage appointments from `/pages/manage.html?...`.

## Smoke tests (Playwright)
Smoke tests are in `tests/smoke/critical-flows.spec.js`.

### First-time setup
1. From repo root:
   - `npm install`
2. Install Playwright browser binaries:
   - `npx playwright install chromium`

### Run tests
- Headless smoke run:
  - `npm run test:smoke`
- Headed run:
  - `npm run test:smoke:headed`
- Playwright UI mode:
  - `npm run test:smoke:ui`

Notes:
- Tests auto-start a local static file server on `http://127.0.0.1:4173`.
- These smoke tests seed local/session storage directly for deterministic flows and do not require backend auth server to be running.

## Build demo zip
Create a clean distributable zip that includes only frontend assets and required server source files.

### Run
From repo root:
- `npm run make:demo-zip`

Or directly:
- `node scripts/make-demo-zip.js`

### Output
- Zip file is created at repo root as `Slotzy-Demo.zip`.

### What is included
- `index.html`
- `pages/`
- `js/`
- `css/`
- `assets/`
- `server/src/`
- `server/package.json`
- `server/package-lock.json`

### What is excluded
- `.git/`
- `node_modules/`
- `test-results/`
- `playwright-report/`
- `*.zip`
- common temp files (`*.tmp`, `*.temp`, swap files, trailing `~`)

## Primary entry points
- `index.html` and `pages/index.html` load the home/auth SPA entry: `js/main.js`.
- `js/dataStore.js` is the primary auth/session and local data source.
- `js/logout.js` is the primary logout implementation.
- `js/session-ui.js` is the shared user badge/toast/logout modal utility.

Auth token storage:
- JWT token key: `Slotzy_auth_token` in `localStorage`.
- Current signed-in user key: `Slotzy_user` in `sessionStorage`.

### Page scripts
- `pages/book.html` -> `js/public-book.js`
- `pages/manage.html` -> `js/client-manage.js`
- `pages/business-owner.html` -> `js/owner-insights.js`, `js/owner-quick-add.js`, `js/owner-availability.js`, `js/owner-upcoming.js`
- `pages/manage-appointments.html` -> `js/owner-appointments.js`
- `pages/manage-services.html` -> `js/manage-services.js`
- `pages/manage-barbers.html` -> `js/manage-barbers.js`
- `pages/owner-earnings.html` -> `js/owner-earnings.js`
- `pages/settings.html` -> `js/settings.js`
- `pages/dev-emails.html` -> `js/dev-emails.js`

## Legacy files (deprecated)
- `js/app.js` (`legacy/kept for compatibility`): deprecated shim kept for old page wiring.
- `js/nav.js` (`legacy/kept for compatibility`): deprecated redirect helper.
- `js/owner-dashboard.js` (`legacy/kept for compatibility`): old dashboard script with no active page include.
- `js/client-history-overview.js` (`legacy/kept for compatibility`): mock-data script still used by `pages/client-history-overview.html`.

## Recommended run flow
1. Start from `index.html` (or `pages/index.html`) with Live Server.
2. Use `Owner / Barber Login` on the home modal flow for staff accounts only.
3. Continue into:
   - Public client booking flow: `pages/book.html?shop=slug`
   - Manage-link client flow: `pages/manage.html?shop=slug&contact=...`
   - Owner/barber flow: `pages/business-owner.html` and linked owner pages
4. Do not use deprecated legacy scripts as new entry points.

## Notes
- This project uses module scripts (`type="module"`), so it must be served over HTTP (for example, Live Server), not opened with `file://`.
