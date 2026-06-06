# Slotzy Pilot Baseline Audit

## Current branch

- `restore-source-files`

## Dirty files

From `git status --short`:

```text
 M css/styles.css
 M js/booking-engine.js
 M manifest.json
 M playwright.config.cjs
 M server/src/db.json
 M tests/smoke/critical-flows.spec.js
 M tests/smoke/logo-branding.spec.js
 M tests/smoke/owner-setup.spec.js
 M tests/smoke/owner-today-glance.spec.js
 M tests/smoke/public-manage-access.spec.js
 ?? slotzy/
```

## Untracked folders

- `slotzy/`

## What `slotzy/` contains

`slotzy/` is not a build artifact. It is a nested project.

It contains two different things:

1. A duplicate backend copy under `slotzy/server/`
2. A separate Vite + React + TypeScript frontend under `slotzy/web/`

### Duplicate files relative to the root app

These paths exist both at the repo root and inside `slotzy/`:

- `README.md`
- `server/package.json`
- `server/package-lock.json`
- `server/src/index.js`
- `server/src/emailService.js`
- `server/src/db.js`
- `server/src/db.json`

### Unique files inside `slotzy/`

The unique source work is under `slotzy/web/`, including:

- `slotzy/web/index.html`
- `slotzy/web/package.json`
- `slotzy/web/vite.config.ts`
- `slotzy/web/tailwind.config.js`
- `slotzy/web/postcss.config.js`
- `slotzy/web/src/main.tsx`
- `slotzy/web/src/App.tsx`
- `slotzy/web/src/pages/*`
- `slotzy/web/src/components/*`
- `slotzy/web/src/lib/*`
- `slotzy/web/src/hooks/*`

### Important comparison result

The nested backend copy is effectively redundant:

- `slotzy/server/package.json` matches root `server/package.json`
- `slotzy/server/package-lock.json` matches root `server/package-lock.json`
- `slotzy/server/src/index.js` matches root `server/src/index.js`
- `slotzy/server/src/emailService.js` matches root `server/src/emailService.js`
- `slotzy/server/src/db.js` matches root `server/src/db.js`
- `slotzy/server/src/db.json` does **not** match root `server/src/db.json`

That last difference looks like data drift, not a unique backend codebase.

## File classification

### `css/styles.css`

- Classification: `risky/unreviewed change`
- Commit status: `should not be committed for baseline cleanup`
- Reason:
  Large visual redesign. This is product-facing styling work, not repo-state cleanup.

### `js/booking-engine.js`

- Classification: `risky/unreviewed change`
- Commit status: `should not be committed for baseline cleanup`
- Reason:
  Behavior changed around booking submission state. The diff is not a trivial cleanup and needs functional review before inclusion.

### `manifest.json`

- Classification: `risky/unreviewed change`
- Commit status: `should not be committed for baseline cleanup`
- Reason:
  Cosmetic theme/background color edits only. Not needed to establish a clean pilot baseline.

### `playwright.config.cjs`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  The config now points at the actual root serve path and current port usage:
  `node ./scripts/serve.cjs ${PORT}` instead of the old test helper server command.

### `server/src/db.json`

- Classification: `generated/test data`
- Commit status: `should not be committed`
- Reason:
  Contains mutable local data and generated email/test records. This is not stable source.

### `tests/smoke/critical-flows.spec.js`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  Forces local-storage mode in smoke setup and aligns the test with current app behavior.

### `tests/smoke/logo-branding.spec.js`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  Adds the same local-mode stabilization used elsewhere in smoke coverage.

### `tests/smoke/owner-setup.spec.js`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  Adds the same local-mode stabilization used elsewhere in smoke coverage.

### `tests/smoke/owner-today-glance.spec.js`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  Adds the same local-mode stabilization used elsewhere in smoke coverage.

### `tests/smoke/public-manage-access.spec.js`

- Classification: `intentional pilot fix`
- Commit status: `should be committed`
- Reason:
  Adds the same local-mode stabilization used elsewhere in smoke coverage.

## What should be committed

These changes are reasonable candidates for the clean pilot baseline branch:

- `playwright.config.cjs`
- `tests/smoke/critical-flows.spec.js`
- `tests/smoke/logo-branding.spec.js`
- `tests/smoke/owner-setup.spec.js`
- `tests/smoke/owner-today-glance.spec.js`
- `tests/smoke/public-manage-access.spec.js`

## What should be reverted or ignored

Revert before baseline commit:

- `css/styles.css`
- `js/booking-engine.js`
- `manifest.json`
- `server/src/db.json`

Do not delete blindly:

- `slotzy/`

Recommended handling for `slotzy/`:

1. Preserve `slotzy/web/` if it represents active future work.
2. Move `slotzy/` outside this repo if it is a parallel app experiment.
3. If `slotzy/web/` is meant to be kept in version control, merge it deliberately in a separate branch with a separate review.
4. Do not auto-commit the nested duplicate `slotzy/server/` copy into this baseline branch.

## Baseline recommendation

This branch is close to a clean pilot baseline, but it is not there yet.

The correct baseline commit should contain:

- test harness fixes needed to run the current app reliably
- no generated data
- no broad visual redesign
- no unreviewed booking flow behavior changes
- no accidental nested project

## Recommended next command sequence

Review the intended baseline changes:

```bash
git diff -- playwright.config.cjs tests/smoke/critical-flows.spec.js tests/smoke/logo-branding.spec.js tests/smoke/owner-setup.spec.js tests/smoke/owner-today-glance.spec.js tests/smoke/public-manage-access.spec.js
```

Revert the baseline-unrelated changes:

```bash
git restore css/styles.css js/booking-engine.js manifest.json server/src/db.json
```

Decide what to do with the nested project:

```bash
move slotzy ..\slotzy_backup
```

Or, if you confirm it should stay outside this repo but remain on disk, add an ignore rule after preserving it.

Stage only the baseline-safe files:

```bash
git add playwright.config.cjs tests/smoke/critical-flows.spec.js tests/smoke/logo-branding.spec.js tests/smoke/owner-setup.spec.js tests/smoke/owner-today-glance.spec.js tests/smoke/public-manage-access.spec.js
```

Verify the worktree is clean enough for a baseline commit:

```bash
git status --short
```

At that point, make the baseline commit on `restore-source-files` or branch off into a new pilot-hardening branch from the cleaned state.
