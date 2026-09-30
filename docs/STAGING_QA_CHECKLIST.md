# Staging QA checklist

Use only synthetic staging data. Record date, tester, browser/device, and any defect links for each run.

## Automated staging smoke

Run `npm run test:staging` only with `SLOTZY_ALLOW_STAGING_E2E=true`, `SLOTZY_STAGING_FRONTEND_URL`, and `SLOTZY_STAGING_API_URL` explicitly set to HTTPS hosts containing `staging`. The suite warms `/api/health` for up to 150 seconds for Render cold starts and refuses all writes unless health reports staging plus Postgres. Each run uses an `e2e-` identity containing base-36 timestamp, process ID, and a 64-bit UUID suffix; its username stays short while its shop, slug, service, and client values share that identity. It has no cleanup API; remove only matching synthetic records manually with staging-only operational tooling if needed. A future cleanup helper must scope every deletion to one exact run prefix, never all `e2e-` data.

Owner registration is verified by the post-registration authenticated UI (`userBadge` and session), then the suite follows either the dashboard or the actual five-step owner wizard. The wizard's Go to Dashboard control is expected only after shop, team, two services, and at least one enabled availability day are saved; the suite then clicks it and verifies `business-owner.html`. A same-page registration landing is not treated as success without that authenticated state and real setup/dashboard entry point.

Service persistence is checked at three distinct points. Each owner-setup add must receive `201` from the exact staging `POST /api/services`; an authenticated `GET /api/services` must then contain the exact synthetic name; and, after reloading `manage-services.html`, the same endpoint must return `200` before the exact service heading is required in the UI. Authenticated service reads use Playwright's runner-side request context rather than `page.evaluate()`, so setup-guard redirects and document reloads cannot destroy an in-flight verification. Diagnostics report only status, endpoint path, service count, expected-name presence, token-presence boolean, current path, and visible names beginning with `E2E `. The token value is never printed. The management page intentionally refreshes its compatibility cache from the server before rendering, so a stale browser cache is not accepted as persistence proof.

The setup service diagnostic also confirms all three input controls held their expected synthetic values, the Add Service action occurred, and the `201` response contained a created service whose name matched the current synthetic service. Postgres reads must restore canonical source IDs for both the owner/shop relationship and each service's shop reference; relational UUIDs are an adapter detail and must not leak into later legacy snapshot reconciliation. A redirect back to `owner-setup.html` with a successful but empty service read means setup remains incomplete and is a failure, not an accepted guard outcome.

For this incident, service presence is additionally checked after both service saves, after the availability/setup-completion write, and after dashboard navigation. Render staging/development logs emit `[Slotzy:services]` contract markers with only route/status/storage, auth/shop-presence booleans, total/returned counts, response-key names, and E2E-name/scope-match booleans. Canonical mapping reads are paginated because a long-lived staging project can exceed PostgREST's per-request row cap. Keep the temporary route markers until one hosted lifecycle passes, then remove or reduce them; never add IDs, headers, tokens, request bodies, or non-synthetic service names.

Owner shop resolution also depends on paginated relational reads: the JWT supplies a username, `requireAuth` reloads that user, and `readStore()` reconstructs `user.shopId` from `shop_members`. All relational collections—not only `legacy_source_ids`—must therefore be read across every PostgREST page. A marker with `hasAuthUser=true` but `authUserHasShopId=false`, `ownerShopCount=0`, and `hasResolvedShop=false` indicates the membership/shop rows were not reconstructed and must fail setup validation.

Owner setup Step 1 is now an explicit persistence gate. It must fill the synthetic shop name, click `#setupStep1Next`, receive `201` from exact `POST /api/shops` with a shop object and ID, then confirm `/api/auth/me` has `shopId` and authenticated `/api/shops` contains the synthetic shop before Step 2 is accepted. The owner display-name field belongs to Step 2 and is recorded separately. Setup shop/service/availability writes must not fall back to browser storage after an API failure. Temporary `[Slotzy:shops]` markers contain only safe creation/linkage/count booleans and should remain through one hosted pass.

Before Step 1 fills its shop field, the browser test must wait for the initialized Step 1 intro text, not merely the statically rendered `#setupShopName` input. The initializer asynchronously applies setup status and may otherwise overwrite an early fill with the empty server value; built-in shop-name validation would then prevent the save handler and no POST would be expected. Immediately before the POST wait, retain safe diagnostics for current path, visible step/label, field-presence booleans, Step 1 button count/visible/enabled/text state, visible validation messages, and redacted console/page errors. Do not include request bodies, credentials, JWTs, tokens, or real shop names.

On `business-owner.html`, the canonical dashboard public-booking UI is the readonly `#pilotBookingLink` input—not an anchor—and it must contain `/pages/book.html?shop=…` after setup. Require visible `#pilotCopyBookingBtn` and `#pilotOpenBookingBtn` too, then open the exact input value for the customer lifecycle. If unavailable, report only safe dashboard path/load state, synthetic-only badge text, anchor count and booking-related paths, booking controls, slug-presence booleans from page/API state, public-link shape booleans, and allowlisted headings; never report the slug, full link, tokens, request bodies, or real names.

For public booking, do not pass a `RegExp` as `selectOption`'s `label`; Playwright requires a string/value/index. Wait for enabled `#barberSelect`, enumerate labels and values, find the non-empty option whose label includes the synthetic owner username case-insensitively, assert it exists, and select by value. If absent, record only option count, synthetic-match boolean, E2E-prefixed option labels, and the synthetic public booking URL. Continue to require service, date/slot, receipt/manage link, owner visibility, and cancellation coverage.

For a shop with exactly one provider, `booking-engine.js` intentionally hides `#barberField` and auto-selects its native `#barberSelect`; there is no visible custom dropdown. The E2E must verify the matched selected value, set the hidden select in page context only when necessary, dispatch bubbling `input` and `change`, and require the service select to become enabled. On selection failure, report only barber-select visible/enabled state, option count, synthetic match boolean, E2E-prefixed visible provider controls, and the synthetic booking URL.

`booking-engine.js` renders services as `Name - $Price - Duration min`, with the canonical name in `option.dataset.serviceName`; do not require a name-only exact label. Wait for the matching non-empty option by dataset name (or safe rendered-label prefix fallback), select by value, and verify it remains selected. Public booking uses the hydrated browser service cache from `public-book.js`, not a separate public service API response. Missing-service diagnostics may include only safe URL, selected provider value, select visible/enabled state, option count, E2E-prefixed labels, synthetic expected-name/match booleans, and that source fact.

Public booking must persist through `saveBookingsAsync(..., { fallbackOnError: false })` before rendering its receipt; a local-only booking is not sufficient because `client-manage.js` performs an authoritative async booking read. The E2E must require `POST /api/bookings` HTTP 201, visible receipt, manage-link presence/path/query shape, and synthetic client/service text on that receipt. The customer manage page intentionally omits the client's own name; identify the same appointment through its synthetic service, date/time, and visible Cancel action before continuing cancellation/reload coverage. On failure, report only safe path/query keys, allowlisted headings, E2E text, boolean detail presence, Cancel presence, and booking-read response status/key names.

Do not use page-wide `getByText(/cancelled/i)` for cancellation verification: static Past-section copy also contains that word. Locate the `.client-manage-card` containing the synthetic service, require its appointment-actions badge to be exactly `Cancelled`, and require that card’s Cancel button to be absent immediately after Confirm Cancel and after reload. Failure diagnostics may report only path/query keys, card count, status badge texts, Cancel state, and safe service/date-time booleans.

For a manage cancellation, install the exact `PATCH /api/bookings/:bookingId` response waiter before clicking Confirm Cancel. Require HTTP `200`, response keys only, and returned `booking.status === "cancelled"`; then refetch/render the appointment card before any optional notification work. Manage booking writes must set `fallbackOnError: false` so an API failure cannot be represented as browser-cache cancellation. Record only cancel/confirm click booleans, path/method/status, response keys, returned status, card status before/after/reload, and existing safe manage-card diagnostics.

Cancellation diagnostics must never mask a timeout: check `page.isClosed()` before page inspection, bound diagnostic evaluation to one second, and return a small safe `pageClosed`/timeout/error object rather than throwing. Use distinct failure labels: `Cancel PATCH not observed`, `Cancel PATCH non-success`, `Cancel persisted but UI did not refresh`, and `Cancelled status did not persist after reload`. Before interpreting a hosted cancellation result, confirm Netlify has deployed frontend commit `7991980` or later; no runtime commit marker is currently available for a browser assertion.

The staging suite first runs `focused staging owner setup API chain` with its own synthetic identity. It isolates register → shop create/link → `/api/auth/me` → two service creates → service read → availability write → service re-read, reporting stage A–F precisely; reaching the end means classification G and shifts investigation to the browser wizard. The full browser lifecycle remains immediately afterward and is not weakened. A staging/development-only `/api/auth/me` marker reports only user/shop presence and owner-shop count.

For the full browser test, remember that registration first navigates owners to `business-owner.html`; `owner-setup-guard.js` resolves setup asynchronously and redirects a fresh owner afterward. The test must wait for `owner-setup.html` and the visible shop field before deciding which flow applies. Treating the transient dashboard as completed setup skips every authoritative wizard write. The availability step must observe exact `PUT /api/availability` HTTP 200 and then re-read both synthetic services before dashboard navigation.

The UI E2E verifies the exact `POST` response origin/path and requires HTTP 201, but does not read its Chrome DevTools response body: navigation can make that resource unavailable to Playwright after the page has already consumed it. Instead it verifies the frontend contract directly: non-empty `localStorage["Slotzy_auth_token"]` and valid `sessionStorage["Slotzy_user"]` with the synthetic username and owner role, followed by the authenticated badge and owner route. Tokens are never printed. A non-201 reports only safe status/response metadata and visible `#auth-error`; a 201 with missing browser session state reports only presence flags, username/role, path, badge text, and browser errors. The matching Render log `[Slotzy:auth] POST /api/auth/register succeeded` confirms the server emitted its `{ token, user }` contract.

For a staging registration HTTP 500, inspect the Render server log entry `[Slotzy:auth] POST /api/auth/register failed`. Its storage diagnostic uses flat fields such as `networkCode`, `networkHostname`, `networkCauseCode`, and `networkCauseHostname`, so Render will not collapse an underlying fetch cause as `[Object]`. On staging/Postgres startup, also inspect the non-blocking `[Slotzy:storage] staging Supabase DNS probe ...` entry. URLs are redacted; logs deliberately exclude username, password, request body, JWT, Authorization headers, and Supabase credentials.

If staging reports a `23505` during `write snapshot` after registration reaches the database, treat it as snapshot identity reconciliation rather than a reason to remove the username uniqueness constraint. Review and, when needed, run `docs/SUPABASE_STAGING_REPAIR.sql` in the staging SQL editor. It only backfills missing user source mappings and is safe to rerun; do not use the disposable reset RPC or delete staging users.

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
