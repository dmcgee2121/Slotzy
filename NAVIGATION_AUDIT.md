# Navigation Audit

## Scope
Audit date: 2026-06-06

Goal: keep pilot navigation focused for owner and barber testing without deleting non-core routes.

## Page Inventory
| Page | Classification | Normal nav exposed | Notes |
| --- | --- | --- | --- |
| `index.html` | public/client flow | yes | Root marketing and login entry. |
| `pages/index.html` | public/client flow | yes | Alternate entry that loads the same home SPA. |
| `pages/book.html` | public/client flow | yes | Public booking route. Must remain available. |
| `pages/manage.html` | public/client flow | yes | Client manage-link route. Must remain available. |
| `pages/pricing.html` | public/client flow | yes | Public marketing page from home nav. |
| `pages/business-owner.html` | pilot core | yes | Primary owner/barber dashboard. |
| `pages/manage-appointments.html` | pilot core | yes | Core booking management screen. |
| `pages/manage-services.html` | pilot core | yes | Core service management screen. |
| `pages/manage-barbers.html` | pilot core | yes | Core team management screen for pilot owners. |
| `pages/settings.html` | pilot core | yes | Core settings, booking link, policy, branding. |
| `pages/owner-setup.html` | owner tool | indirect | Owner onboarding flow; reachable through setup guard and setup actions. |
| `pages/owner-earnings.html` | owner tool | indirect | Still functional, but not promoted in primary pilot nav. |
| `pages/owner-today.html` | owner tool | no | Functional daily agenda page retained but removed from normal pilot nav. |
| `pages/client-history-overview.html` | owner tool | no | Functional client-history page retained but removed from normal pilot nav. |
| `pages/dev-emails.html` | dev-only | no | Direct dev/QA route for Dev Outbox only. |
| `pages/admin.html` | dev-only | no | Private admin tooling, not part of pilot nav. |
| `pages/customer-dashboard.html` | retired/legacy | no | Redirect page explaining customer logins are retired. |
| `pages/book-shop.html` | retired/legacy | no | Redirect alias to `book.html`. Retained for compatibility. |

## Normal Navigation Sources
- Public nav: `index.html`, `pages/index.html`, and `pages/pricing.html`
- Pilot owner/barber nav: `pages/business-owner.html`, `pages/manage-appointments.html`, `pages/manage-services.html`, `pages/manage-barbers.html`, `pages/settings.html`
- Direct-only tools: `pages/dev-emails.html`, `pages/admin.html`
- Direct-only retained pages: `pages/owner-today.html`, `pages/client-history-overview.html`, `pages/customer-dashboard.html`, `pages/book-shop.html`

## Changes Made
- Removed `Today` and `Clients` from visible owner/barber headers to reduce pilot navigation sprawl.
- Replaced dashboard promotion of `client-history-overview.html` with a direct `Settings` action.
- Changed the dashboard `View Today` CTA to open `manage-appointments.html`, which better matches pilot booking operations.
- Kept `book.html` and `manage.html` untouched so public booking and manage-link flows remain intact.
- Left `dev-emails.html`, `admin.html`, `owner-today.html`, `client-history-overview.html`, `customer-dashboard.html`, and `book-shop.html` in place with no deletion.

## Follow-Up Candidates
- If the pilot never uses earnings, move `owner-earnings.html` to direct-only status in a later cleanup.
- If client history is still needed, reintroduce it behind a secondary tools area instead of the primary header.
