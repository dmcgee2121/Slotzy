# Runbook

## Daily Commands
From repo root:

- Frontend only:
  `npm run serve`
- Backend only:
  `cd server`
  `npm run dev`
- Frontend + backend + browser on Windows:
  `npm run dev:all`
- Smoke tests:
  `npm run test:smoke`

## Run Frontend + Backend
### Frontend
1. Open the repo root.
2. Start the static dev server:
   `npm run serve`
3. Open:
   `http://localhost:5173/pages/index.html`

### Backend
1. Open a second terminal.
2. Move into the API:
   `cd server`
3. Start the backend:
   `npm run dev`
4. Health check:
   `http://localhost:3001/api/health`

## Demo Mode
### Enable demo mode quickly
Open:

`http://localhost:5173/index.html?reset=1&demo=1`

This reseeds the local demo shop, demo users, services, availability, and bookings.

### Demo logins
- Owner: `owner_demo` / `demo`
- Barber Jordan: `jordan_demo` / `demo`
- Barber Alex: `alex_demo` / `demo`

## Reset Data Safely
### Demo reset
Use the safest repeatable reset for walkthroughs:

`index.html?reset=1&demo=1`

Or in Settings:
- open `Demo Mode`
- click `Reset Demo`

### Pilot data protection
Before resetting pilot data:
1. Open `Settings`
2. Use `Export Backup JSON`
3. Save the backup file somewhere safe

Do not reset pilot data without exporting a backup first.

## Backup / Restore
### Export
1. Open `Settings`
2. Go to `Backup & Restore`
3. Click `Export Backup JSON`

This exports all current Slotzy browser data into one JSON file.

### Restore
1. Open `Settings`
2. Go to `Backup & Restore`
3. Click `Import Backup JSON`
4. Choose the backup file
5. Review the warning
6. Click `Confirm Restore`

Restore replaces current Slotzy browser data on that device and then reloads the app.

## Dev Email Outbox
When SMTP is not configured, booking emails go to the Dev Outbox.

### View it
1. Start the backend
2. Open:
   `http://localhost:5173/pages/dev-emails.html`

### API endpoints
- `GET /api/dev/emails`
- `DELETE /api/dev/emails`

## Smoke Tests
### Run
From repo root:

`npm run test:smoke`

### Current smoke coverage
- owner login
- add service
- set availability
- public booking creates appointment
- owner sees appointment
- client manage cancel/reschedule
- CSV export downloads

## Windows One-Command Start
Use:

`npm run dev:all`

What it does:
- starts frontend in one PowerShell window
- starts backend in another PowerShell window
- opens the browser to the demo app

## Known Limits
- Local demo mode is expected when the backend is offline.
- Customer accounts are intentionally disabled.
- Clients book and manage only through public links.
- Dev Outbox is the default email target unless SMTP is configured.
