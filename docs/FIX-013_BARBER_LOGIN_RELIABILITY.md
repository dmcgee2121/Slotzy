# FIX-013: Barber Login Reliability Investigation

## Disposition

**NOT REPRODUCED — no application change made.**

The founder's historical Samsung Galaxy S26+ observation remains valuable evidence, but it could not be reproduced against the approved local implementation. No concrete defect was found that would justify changing authentication, session handling, authorization, or error messaging.

## Baseline and local-only safety checks

- Repository: `C:\Dev\Slotzy`
- Branch: `restore-source-files`
- Baseline HEAD: `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a`
- The working tree was clean before this investigation.
- Supabase API was confirmed local at `http://127.0.0.1:54321`; the local PostgreSQL URL resolved to `127.0.0.1:54322`.
- `public.slotzy_test_control.is_disposable` returned `true` through the local Docker PostgreSQL container.
- The local Express health response identified the service as `slotzy-api`, storage as `postgres`, and environment as `development`.
- The local E2E configuration test confirms the backend binds loopback-only, selects PostgreSQL, clears SMTP settings, and forces the Dev Outbox. No hosted service, email delivery, reset, migration, deletion, commit, push, or deployment was performed.

## Authentication architecture traced

Staff login is not a browser Supabase/GoTrue login. The login modal in `js/auth.js`:

1. checks the local Express health endpoint;
2. submits credentials to `POST /api/auth/login`;
3. requires a Slotzy JWT plus a normalized staff user in the response;
4. stores the JWT in local storage and the minimal session user in session storage; and
5. restores a stored JWT through `GET /api/auth/me` on startup.

The Express route reads the server-only credential projection from `postgresStore`, compares the bcrypt hash, then issues the Slotzy staff JWT. It returns `401 invalid credentials` only when the account is absent/inactive or bcrypt rejects the supplied password. Credential-storage lookup failures map to a distinct `503 authentication service temporarily unavailable`; token/session failures map to distinct `401 invalid or expired/revoked token` responses.

The modal prevents duplicate form submissions by disabling its Continue button during the pending request. Its catch handler displays the actual API error message rather than relabeling every failure as invalid credentials. The service worker bypasses `/api/` and uses network-first handling for JavaScript assets, so the reviewed cache policy does not cache API login responses or pin the current auth script while online.

## Founder evidence and controlled reproduction

Founder-reported, historical browser evidence: a valid barber credential on a Samsung Galaxy S26+ sometimes appeared to fail with an incorrect-credentials message; repeated login attempts eventually succeeded. This report does not treat that observation as a reproduced current-code failure.

Using uniquely named synthetic local accounts (one owner and one barber for the completed scenario), without reading or logging any founder credentials, the following local Express results were observed:

| Scenario | Result |
| --- | --- |
| Synthetic owner registration and login | `201`, then `200` |
| Synthetic barber registration and login | `201`, then `200` |
| Authenticated barber `GET /api/auth/me` | `200` |
| Invalid password | `401` |
| Missing account | `401` |
| Synthetic barber logout-all | `200` |
| Old token after logout-all | `401` |
| Fresh login after logout-all | `200` |
| Six simultaneous valid barber login requests | six `200` responses |

The completed scenario accounts are preserved as authorized disposable-local test data. An earlier PowerShell harness also created one owner and one barber before its optional concurrency syntax failed; those extra synthetic records were likewise preserved and were not used to make the reported concurrency assertion. The completed scenario tested server login, protected-session validation, revocation, relogin, and rapid concurrent submissions. It did not use browser automation, intentionally slow the live local database, access a founder identity, or infer a cause from the historical symptom.

## Root-cause assessment and code changes

No cause was confirmed. In particular, the investigated current path did not expose a race between credential validation and session setup, a token restoration failure reported as invalid credentials, a missing membership response mapped to invalid credentials, or duplicate form submission while the UI button is disabled.

No production source, database migration, configuration, or test was changed. A regression test would be speculative without a confirmed failure mode, so none was added.

## Regression results

| Command | Result |
| --- | --- |
| `npm run test:local-e2e-config` | 4 passed, 0 failed |
| `npm --prefix server run test:storage` | 36 passed, 0 failed |
| `npm --prefix server run test:api` | 50 passed, 0 failed |

The API suite includes existing authentication-token issuance/revocation and rate-limit coverage. These tests are not a substitute for mobile visual acceptance.

## Founder retest instructions

1. Start the verified local stack with `npm run local:e2e`; use the loopback URL it prints.
2. In Chrome desktop, use the existing `test1234` barber account and submit a single correct login. Confirm arrival at the permitted dashboard and that refresh retains the authenticated session.
3. Sign out, then repeat the login once. Do not rapidly retry an apparent failure; first capture the exact on-screen message, time, URL, and whether the device was online.
4. On the Samsung Galaxy S26+ (or its Chrome profile), repeat the same fresh login/logout/login flow after clearing only Slotzy site data if a stale installed PWA is suspected. Confirm the installed PWA is updated before testing.
5. If the historical symptom returns, preserve a screenshot and browser DevTools/network result for `POST /api/auth/login` (status and safe response envelope only; never credentials or Authorization headers). Record whether `/api/health` was reachable at the same time.

## Remaining risks

- The original intermittent mobile condition was not available to reproduce, so its environmental trigger remains unknown.
- The controlled test exercised the local API, not a founder-operated mobile browser; final device acceptance remains founder work.
- The synthetic barber was registered without a shop membership, so this investigation verifies login/session reliability but not any later appointment-page authorization for a particular shop. Existing server credential lookup handles membership separately after a valid account read.

## FAT-007 founder desktop acceptance

The founder subsequently completed FAT-007 desktop Chrome acceptance successfully: **4 of 4 checks passed**. This is founder-operated browser evidence, not automated browser evidence. No application authentication change was required. The historical Samsung Galaxy issue remains open only for separate mobile-device verification.

## Files changed and final Git status

- Added: `docs/FIX-013_BARBER_LOGIN_RELIABILITY.md`
- No application files changed.
- No Git commit or push was made.
- Final Git status shows this uncommitted report only; `HEAD` remains `3d544fa1629dc7b1fb9a9f1df717d76bef331e4a` and the branch is `0` ahead / `0` behind `origin/restore-source-files`.
