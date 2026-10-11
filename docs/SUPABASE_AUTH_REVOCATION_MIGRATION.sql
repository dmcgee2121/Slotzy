-- Durable per-user staff JWT revocation foundation.
-- Review and apply through the approved staging/production migration process;
-- this file is additive and does not delete or rewrite existing users.

alter table public.users
  add column if not exists auth_version integer not null default 1,
  add column if not exists auth_invalid_after timestamptz not null default now(),
  add column if not exists password_changed_at timestamptz;

alter table public.users
  add constraint users_auth_version_positive check (auth_version >= 1) not valid;

alter table public.users
  validate constraint users_auth_version_positive;

comment on column public.users.auth_version is
  'Increment to revoke all previously issued staff JWTs for this user.';
comment on column public.users.auth_invalid_after is
  'Reject staff JWTs issued before this time in addition to auth_version checks.';
comment on column public.users.password_changed_at is
  'Reserved for password rotation and recovery audit; no self-service reset is enabled by this migration.';
