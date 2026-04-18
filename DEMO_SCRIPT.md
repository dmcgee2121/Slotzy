# Slotzy 5-Minute Demo Script

## Goal
Show the current owner + public booking workflow without customer accounts:
- owner logs in
- public client books from a link
- client uses manage link to cancel or reschedule
- owner sees updates immediately

## Prep
1. Open `index.html?reset=1&demo=1` to reseed the demo shop.
2. Keep 3 tabs ready:
   - Owner tab
   - Public booking tab
   - Client manage tab
3. Optional: start backend at `http://localhost:3001` if you want to demo server auth and Dev Outbox.

## Demo Logins
- Owner: `owner_demo` / `demo`
- Barber Jordan: `jordan_demo` / `demo`
- Barber Alex: `alex_demo` / `demo`

## Public Links
- Public home: `/pages/index.html`
- Public booking: `/pages/book.html?shop=demo-fade-studio`
- Public manage page base: `/pages/manage.html`
Note: the real manage link is generated after booking and includes `shop` + `contact`.

## 0:00-0:45 Owner Login
1. In the Owner tab, open `pages/index.html`.
2. Click `I'm an Owner or Barber`.
3. Log in as `owner_demo` / `demo`.
4. Point out:
   - owner lands in owner flow
   - customers are not asked to create accounts

Talk track: "Staff log in. Clients do not. Clients stay on booking and manage links only."

## 0:45-1:30 Show Booking Link
1. Open `Settings`.
2. Go to the public booking section.
3. Show:
   - booking URL
   - QR preview
   - logo / branding if present
4. Click `Copy Link` or `Open Booking Page`.

Talk track: "Each shop has one public booking link and QR that can be shared anywhere."

## 1:30-2:30 Book as Client
1. In the Public booking tab, open `/pages/book.html?shop=demo-fade-studio`.
2. Pick:
   - barber
   - service
   - date
   - time
3. Enter:
   - name: `Taylor Demo`
   - contact: `demo@test.com`
4. Click `Book Appointment`.
5. On the receipt, point out:
   - confirmation code
   - `Manage link`
   - `Copy` button
   - calendar download

Talk track: "Booking is public, account-free, and the receipt gives the client a self-serve manage link."

## 2:30-3:10 Owner Sees Appointment
1. Back in Owner tab, open `Manage Appointments` or `Today`.
2. Show the new appointment.
3. If useful, point out the source / status badges.

Talk track: "The booking appears in the owner workflow right away."

## 3:10-4:10 Client Manage Flow
1. In the Client manage tab, open the exact manage link from the receipt.
2. Show:
   - upcoming appointments
   - past appointments
   - cancel / reschedule actions when allowed
3. Either:
   - click `Reschedule`, choose a new slot, confirm
   - or click `Cancel`, then `Confirm Cancel`

Talk track: "Clients manage their own appointment from the link. No password reset, no customer dashboard, no account friction."

## 4:10-5:00 Owner Sees Update + Export
1. Back in Owner tab, show the appointment updated or removed.
2. Open `Manage Appointments`.
3. Apply a quick filter or search.
4. Click `Export CSV`.
5. If there is time, open `Clients` and export that CSV too.

Talk track: "Operational views and exports reflect the exact current state and current filters."

## Fast Fallbacks
- If the backend is offline, keep going. Local demo auth still works.
- If a time slot is unavailable, pick the next available slot.
- If cancel is blocked by policy, use reschedule instead.
- If you need to restart cleanly, reopen `index.html?reset=1&demo=1`.

## Known Limitations
- The manage page should be opened from the generated receipt link, not guessed manually.
- Email delivery uses the Dev Outbox unless SMTP is configured.
- Some flows are local-demo capable by design when the backend is offline.
- Public clients do not have accounts or a dashboard anymore.
