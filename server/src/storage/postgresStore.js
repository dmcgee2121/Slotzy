import { createClient } from "@supabase/supabase-js";
import { normalizeStoreShape } from "./jsonStore.js";

const REQUIRED_ENVIRONMENT_VARIABLES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

export function getPostgresConfiguration(env = process.env) {
  const config = {
    url: String(env?.SUPABASE_URL ?? "").trim(),
    serviceRoleKey: String(env?.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
  };
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !config[name === "SUPABASE_URL" ? "url" : "serviceRoleKey"]);
  if (missing.length) {
    throw new Error(`SLOTZY_STORAGE=postgres requires ${missing.join(", ")}. Keep Supabase service-role credentials server-side only.`);
  }
  return config;
}

const DIAGNOSTIC_FIELDS = ["name", "message", "code", "errno", "syscall", "hostname"];

function safeDiagnosticText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted-url]")
    .slice(0, 500);
}

// Do not retain arbitrary error objects: Supabase configuration and request
// objects can contain credentials. These fields are enough to diagnose Node
// transport failures such as DNS, TLS, or socket errors.
function diagnosticFieldName(prefix, field) {
  return `${prefix}${field[0].toUpperCase()}${field.slice(1)}`;
}

// Keep this flat because hosted structured-log viewers abbreviate nested
// objects as `[Object]`. A third level covers the Node fetch error's cause
// without retaining an unbounded error chain.
export function flattenSafeNetworkDiagnostic(error, prefix = "network") {
  const diagnostic = {};
  let current = error;
  let currentPrefix = prefix;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    DIAGNOSTIC_FIELDS.forEach((field) => {
      if (current[field] !== undefined && current[field] !== null && current[field] !== "") {
        diagnostic[diagnosticFieldName(currentPrefix, field)] = safeDiagnosticText(current[field]);
      }
    });
    if (!current.cause || current.cause === current) break;
    current = current.cause;
    currentPrefix = `${currentPrefix}Cause`;
  }
  return diagnostic;
}

function fail(error, operation, networkFailures = []) {
  if (!error) return;
  const wrapped = new Error(`Postgres storage ${operation} failed: ${error.message}`, { cause: error });
  if (error.code) wrapped.code = error.code;
  wrapped.storageDiagnostic = {
    operation,
    ...flattenSafeNetworkDiagnostic(error, "storageError"),
    // The Supabase SDK may turn a rejected fetch into a plain PostgREST error.
    // Capture the original Node fetch error separately while retaining only the
    // allowlisted fields above.
    ...(networkFailures.at(-1) ?? {}),
  };
  throw wrapped;
}

const cents = (value) => Math.round(Number(value ?? 0) * 100);
const dollars = (value) => Number((Number(value ?? 0) / 100).toFixed(2));
const iso = (value) => value ? new Date(value).toISOString() : "";

function legacyPolicy(row = {}) {
  return {
    allowSameDay: row.allow_same_day, maxDaysAdvance: row.max_days_advance,
    cancelHours: row.cancel_hours, bufferMinutes: row.buffer_minutes,
    requireDeposit: row.require_deposit, depositAmount: dollars(row.deposit_amount_cents),
    lateGraceMinutes: row.late_grace_minutes, noShowStrikeLimit: row.no_show_strike_limit,
    reminder24Hours: row.reminder_24_hours, reminder2Hours: row.reminder_2_hours,
    reminderCustomEnabled: row.reminder_custom_enabled, reminderCustomMinutes: row.reminder_custom_minutes,
  };
}

function firstBrandingValue(shop, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(shop, key)) continue;
    return String(shop[key] ?? "").trim();
  }
  return "";
}

// The browser historically called these fields logoDataUrl/coverDataUrl while
// the Postgres snapshot RPC consumes logo/cover. Canonicalize at the adapter
// boundary so both existing records and older clients persist branding.
export function normalizePostgresSnapshot(store) {
  const snapshot = normalizeStoreShape(store);
  return {
    ...snapshot,
    shops: snapshot.shops.map((shop) => ({
      ...shop,
      logo: firstBrandingValue(shop, ["logoDataUrl", "logoImageDataUrl", "logoImage", "logoUrl", "logo"]),
      cover: firstBrandingValue(shop, ["coverDataUrl", "coverImageDataUrl", "coverImage", "cover"]),
    })),
  };
}

// Server-only adapter. It maps relational rows back to the document shape that
// current Express routes expect; routes do not receive database column names.
export function createPostgresStore(env = process.env) {
  const config = getPostgresConfiguration(env);
  const networkFailures = [];
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (...args) => {
        try {
          return await globalThis.fetch(...args);
        } catch (error) {
          networkFailures.push(flattenSafeNetworkDiagnostic(error));
          throw error;
        }
      },
    },
  });

  function beginOperation() {
    networkFailures.length = 0;
  }

  async function readAllRows(operation, buildQuery) {
    const pageSize = 500;
    const rows = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await buildQuery().range(from, from + pageSize - 1);
      fail(error, operation, networkFailures);
      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async function readStore() {
    beginOperation();
    const reads = [
      ["read users", () => client.from("users").select("*").is("deleted_at", null).order("id")],
      ["read shops", () => client.from("shops").select("*").is("deleted_at", null).order("id")],
      ["read shop settings", () => client.from("shop_settings").select("*").order("shop_id")],
      ["read shop members", () => client.from("shop_members").select("*").is("deleted_at", null).order("id")],
      ["read services", () => client.from("services").select("*").is("deleted_at", null).order("id")],
      ["read provider services", () => client.from("provider_services").select("*").order("provider_member_id").order("service_id")],
      ["read availability", () => client.from("availability").select("*").order("id")],
      ["read time off", () => client.from("time_off").select("*").order("id")],
      ["read bookings", () => client.from("bookings").select("*").order("id")],
      ["read manage tokens", () => client.from("booking_manage_tokens").select("booking_id, token_hash, revoked_at, expires_at").is("revoked_at", null)],
      ["read email outbox", () => client.from("email_outbox").select("*").order("id")],
      ["read canonical identity mappings", () => client.from("legacy_source_ids").select("entity_type,source_id,target_id").eq("is_canonical", true).order("entity_type").order("source_id")],
    ];
    const [users, shops, settings, members, services, providerServices, availabilityRows, timeOffRows, bookings, manageTokens, emails, canonicalMappings] = await Promise.all(
      reads.map(([operation, buildQuery]) => readAllRows(operation, buildQuery))
    );
    const canonicalSourceByTarget = new Map(canonicalMappings.map((row) => [`${row.entity_type}:${row.target_id}`, row.source_id]));
    const sourceId = (entityType, targetId) => canonicalSourceByTarget.get(`${entityType}:${targetId}`) ?? targetId;
    const usersById = new Map(users.map((row) => [row.id, row]));
    const membersById = new Map(members.map((row) => [row.id, row]));
    const shopByUser = new Map(); members.forEach((row) => { if (!shopByUser.has(row.user_id)) shopByUser.set(row.user_id, row.shop_id); });
    const settingsByShop = new Map(settings.map((row) => [row.shop_id, row]));
    const offByMember = new Map(); timeOffRows.forEach((row) => {
      const value = offByMember.get(row.provider_member_id) ?? [];
      value.push({ id: sourceId("time_off", row.id), startISO: iso(row.starts_at), endISO: iso(row.ends_at), note: row.note ?? "" }); offByMember.set(row.provider_member_id, value);
    });
    const scheduleByMember = new Map(); availabilityRows.forEach((row) => {
      const value = scheduleByMember.get(row.provider_member_id) ?? []; value.push(row); scheduleByMember.set(row.provider_member_id, value);
    });
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const availability = {};
    members.forEach((member) => {
      const user = usersById.get(member.user_id); if (!user) return;
      const rows = scheduleByMember.get(member.id) ?? []; const weekly = {};
      rows.forEach((row) => { weekly[days[row.weekday]] = { enabled: row.is_enabled, start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5) }; });
      availability[user.username] = { timezone: rows[0]?.timezone ?? "America/Chicago", bufferMinutes: rows[0]?.buffer_minutes ?? 0, weekly, timeOff: offByMember.get(member.id) ?? [] };
    });
    const tokenHashByBookingId = new Map(manageTokens.map((row) => [row.booking_id, row.token_hash]));
    const providerByService = new Map(); providerServices.forEach((row) => {
      const user = usersById.get(membersById.get(row.provider_member_id)?.user_id); if (user && !providerByService.has(row.service_id)) providerByService.set(row.service_id, user.username);
    });
    return normalizeStoreShape({
      users: users.map((row) => ({ id: sourceId("user", row.id), username: row.username, displayName: row.display_name, passwordHash: row.password_hash, role: row.role, email: row.email, phone: row.phone, shopId: shopByUser.has(row.id) ? sourceId("shop", shopByUser.get(row.id)) : null, createdAt: iso(row.created_at) })),
      shops: shops.map((row) => ({ id: sourceId("shop", row.id), name: row.name, businessName: row.name, slug: row.slug, ownerUsername: usersById.get(row.owner_user_id)?.username ?? "", shopPhone: row.phone ?? "", shopEmail: row.email ?? "", logo: row.logo_url ?? "", cover: row.cover_url ?? "", createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at), bookingPolicy: legacyPolicy(settingsByShop.get(row.id)) })),
      services: services.map((row) => { const provider = providerByService.get(row.id) ?? ""; return { id: sourceId("service", row.id), name: row.name, title: row.name, price: dollars(row.price_cents), durationMinutes: row.duration_minutes, duration: row.duration_minutes, shopId: sourceId("shop", row.shop_id), barberUsername: provider, ownerUsername: provider, active: row.is_active, createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at) }; }),
      availability,
      bookings: bookings.map((row) => { const provider = usersById.get(membersById.get(row.provider_member_id)?.user_id)?.username ?? ""; return { id: sourceId("booking", row.id), shopId: sourceId("shop", row.shop_id), barberUsername: provider, ownerUsername: provider, serviceName: row.service_snapshot?.name ?? "Service", serviceTitle: row.service_snapshot?.name ?? "Service", clientName: row.client_name, clientContact: row.client_contact, clientEmail: row.client_email, clientPhone: row.client_phone, startISO: iso(row.start_at), endISO: iso(row.end_at), durationMinutes: row.duration_minutes, status: row.status, confirmationCode: row.confirmation_code, depositRequired: row.deposit_required, depositAmount: dollars(row.deposit_amount_cents), depositStatus: row.deposit_status, createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at), ...(tokenHashByBookingId.get(row.id) ? { manageTokenHash: tokenHashByBookingId.get(row.id) } : {}) }; }),
      emails: emails.map((row) => ({ id: row.id, createdAtISO: iso(row.created_at), to: row.recipient_email, subject: row.subject, html: row.payload?.html ?? "", text: row.payload?.text ?? "", tags: row.payload?.tags ?? [], meta: row.payload?.meta ?? {} })),
    });
  }

  // The legacy routes save whole documents. Reconciliation must run in one
  // database RPC; it is never a browser call or a JSON fallback.
  async function writeStore(store) {
    beginOperation();
    const { error } = await client.rpc("slotzy_storage_write_snapshot", { snapshot: normalizePostgresSnapshot(store) });
    fail(error, "write snapshot", networkFailures);
  }

  async function appendOutboxEmail(email) {
    beginOperation();
    const { error } = await client.from("email_outbox").insert({ recipient_email: email.to, subject: email.subject, template_type: email.tags?.[0] ?? null, payload: { html: email.html ?? "", text: email.text ?? "", tags: email.tags ?? [], meta: email.meta ?? {} }, delivery_status: "pending" });
    fail(error, "append outbox email", networkFailures); return email;
  }
  async function listOutboxEmails(limit = 50) {
    beginOperation();
    const { data, error } = await client.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(Math.max(0, Math.floor(Number(limit) || 0)));
    fail(error, "list outbox emails", networkFailures); return (data ?? []).map((row) => ({ id: row.id, createdAtISO: iso(row.created_at), to: row.recipient_email, subject: row.subject, html: row.payload?.html ?? "", text: row.payload?.text ?? "", tags: row.payload?.tags ?? [], meta: row.payload?.meta ?? {} }));
  }
  async function clearOutboxEmails() {
    // PostgREST rejects an unqualified DELETE. `id` is the non-null UUID primary
    // key, so this explicit predicate preserves the storage contract's clear-all
    // behavior without broadening permissions.
    beginOperation();
    const { data, error } = await client.from("email_outbox").delete().not("id", "is", null).select("id"); fail(error, "clear outbox emails", networkFailures); return { cleared: data?.length ?? 0 };
  }
  async function createBookingAtomically(payload) {
    beginOperation();
    const { data, error } = await client.rpc("slotzy_create_booking", { payload }); fail(error, "create booking atomically", networkFailures); return data;
  }
  async function storeManageToken(bookingSourceId, tokenHash, expiresAt) {
    beginOperation();
    const { data: mapping, error: mapError } = await client.from("legacy_source_ids").select("target_id").eq("entity_type", "booking").eq("source_id", bookingSourceId).eq("is_canonical", true).maybeSingle();
    fail(mapError, "resolve manage token booking", networkFailures);
    const bookingId = mapping?.target_id ?? bookingSourceId;
    const { error } = await client.from("booking_manage_tokens").insert({ booking_id: bookingId, token_hash: tokenHash, expires_at: expiresAt });
    fail(error, "store manage token", networkFailures);
  }
  return { readStore, writeStore, appendOutboxEmail, listOutboxEmails, clearOutboxEmails, createBookingAtomically, storeManageToken, cents };
}

export const readStore = async () => createPostgresStore().readStore();
export const writeStore = async (store) => createPostgresStore().writeStore(store);
export const appendOutboxEmail = async (email) => createPostgresStore().appendOutboxEmail(email);
export const listOutboxEmails = async (limit) => createPostgresStore().listOutboxEmails(limit);
export const clearOutboxEmails = async () => createPostgresStore().clearOutboxEmails();
