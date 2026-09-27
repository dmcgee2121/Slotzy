# Staging QA checklist

Use only synthetic staging data. Record date, tester, browser/device, and any defect links for each run.

## Automated staging smoke

Run `npm run test:staging` only with `SLOTZY_ALLOW_STAGING_E2E=true`, `SLOTZY_STAGING_FRONTEND_URL`, and `SLOTZY_STAGING_API_URL` explicitly set to HTTPS hosts containing `staging`. The suite warms `/api/health` for up to 150 seconds for Render cold starts and refuses all writes unless health reports staging plus Postgres. It creates unique `e2e-` synthetic records and has no cleanup API; remove those records manually with staging-only operational tooling if needed.

Owner registration is verified by the post-registration authenticated UI (`userBadge` and the Dashboard control), then the suite clicks Dashboard and asserts navigation to `owner-setup.html` or `business-owner.html`. A same-page registration landing is not treated as success without that authenticated state and real setup/dashboard entry point.

If registration remains open, the E2E first reports the `/api/auth/register` HTTP status and safe response error, then checks visible `#auth-error`; it does not wait for a generic modal timeout. A successful API response without a modal close or inline error is reported as an auth-UI defect.

For a staging registration HTTP 500, inspect the Render server log entry `[Slotzy:auth] POST /api/auth/register failed`. It includes only the active storage adapter and safe error code/message; it deliberately excludes username, password, request body, JWT, and Supabase credentials.

## 1. Infrastructure

- [x] Netlify frontend: `https://slotzy-staging.netlify.app` reachable.
- [x] Render API: `https://slotzy-staging-api.onrender.com` reachable.
- [x] `/api/health` returns `ok: true`, `storage: "postgres"`, and `environment: "staging"`.
- [x] CORS permits the staging frontend origin.
- [ ] Confirm browser bundles, network responses, and repository contain no secrets.

## 2. Owner authentication

- [x] Register owner/barber.
- [x] Login and authenticated owner dashboard.
- [ ] Logout clears the session and protected pages redirect appropriately.
- [ ] Invalid credentials show a safe, clear error.
- [ ] Session persists across refresh as intended.
- [ ] Setup guard routes incomplete and configured owners correctly.

## 3. Shop setup

- [x] Set business name.
- [ ] Add/edit provider or team details.
- [x] Add services and availability.
- [x] Copy/open the ready-to-share booking link.

## 4. Services, team, and availability

- [x] Create a service.
- [ ] Edit and delete a service.
- [ ] Verify active/inactive behavior.
- [x] Configure weekly availability.
- [ ] Add/remove time off.
- [x] Confirm changes persist after reload and are reflected in public booking.

## 5. Public booking

- [x] Select provider/service and an available slot.
- [x] Submit customer details and view receipt/manage link.
- [x] Confirm public booking is visible to the owner.
- [x] Confirm overlap protection and unavailable-slot behavior.

## 6. Owner appointment management

- [x] Confirm new booking appears in appointments.
- [ ] Verify status display and complete/no-show actions.
- [x] Cancel and reschedule where supported.

## 7. Customer manage flow

- [x] Open a valid manage link.
- [ ] Check invalid/missing link behavior.
- [x] Verify cancellation/reschedule policy enforcement.
- [x] Exercise Cancel → Confirm Cancel.
- [x] Refresh and confirm persisted changes.

## 8. Branding/settings

- [ ] Verify logo and cover.
- [x] Verify booking link and QR actions.
- [ ] Verify policies and a mobile settings layout.

## 9. Mobile QA

- [ ] At phone width, verify navigation, forms, and buttons remain usable.
- [ ] Verify no horizontal overflow.
- [ ] Complete public booking and manage flows on a phone-width viewport.

## 10. Failure and recovery

- [ ] Observe a Render cold start.
- [ ] Temporarily simulate backend unavailability and verify friendly frontend errors.
- [ ] Verify refresh/retry behavior.
- [ ] Rehearse the documented staging-only JSON rollback: set `SLOTZY_STORAGE=json`, restart, and do not merge or delete Postgres data.

## 11. Data safety

- [x] Use test data only; no customer or pilot data.
- [x] Staging Supabase project is separate from production.
- [ ] Confirm no secrets are committed, logged, or client-visible.
