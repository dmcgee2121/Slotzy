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

function fail(error, operation) {
  if (error) throw new Error(`Postgres storage ${operation} failed: ${error.message}`);
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

// Server-only adapter. It maps relational rows back to the document shape that
// current Express routes expect; routes do not receive database column names.
export function createPostgresStore(env = process.env) {
  const config = getPostgresConfiguration(env);
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function readStore() {
    const results = await Promise.all([
      client.from("users").select("*").is("deleted_at", null),
      client.from("shops").select("*").is("deleted_at", null),
      client.from("shop_settings").select("*"), client.from("shop_members").select("*").is("deleted_at", null),
      client.from("services").select("*").is("deleted_at", null), client.from("provider_services").select("*"),
      client.from("availability").select("*"), client.from("time_off").select("*"),
      client.from("bookings").select("*"), client.from("email_outbox").select("*"),
    ]);
    results.forEach((result) => fail(result.error, "read"));
    const [users, shops, settings, members, services, providerServices, availabilityRows, timeOffRows, bookings, emails] = results.map((result) => result.data ?? []);
    const usersById = new Map(users.map((row) => [row.id, row]));
    const membersById = new Map(members.map((row) => [row.id, row]));
    const shopByUser = new Map(); members.forEach((row) => { if (!shopByUser.has(row.user_id)) shopByUser.set(row.user_id, row.shop_id); });
    const settingsByShop = new Map(settings.map((row) => [row.shop_id, row]));
    const offByMember = new Map(); timeOffRows.forEach((row) => {
      const value = offByMember.get(row.provider_member_id) ?? [];
      value.push({ id: row.id, startISO: iso(row.starts_at), endISO: iso(row.ends_at), note: row.note ?? "" }); offByMember.set(row.provider_member_id, value);
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
    const providerByService = new Map(); providerServices.forEach((row) => {
      const user = usersById.get(membersById.get(row.provider_member_id)?.user_id); if (user && !providerByService.has(row.service_id)) providerByService.set(row.service_id, user.username);
    });
    return normalizeStoreShape({
      users: users.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name, passwordHash: row.password_hash, role: row.role, email: row.email, phone: row.phone, shopId: shopByUser.get(row.id) ?? null, createdAt: iso(row.created_at) })),
      shops: shops.map((row) => ({ id: row.id, name: row.name, businessName: row.name, slug: row.slug, ownerUsername: usersById.get(row.owner_user_id)?.username ?? "", shopPhone: row.phone ?? "", shopEmail: row.email ?? "", logo: row.logo_url ?? "", cover: row.cover_url ?? "", createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at), bookingPolicy: legacyPolicy(settingsByShop.get(row.id)) })),
      services: services.map((row) => { const provider = providerByService.get(row.id) ?? ""; return { id: row.id, name: row.name, title: row.name, price: dollars(row.price_cents), durationMinutes: row.duration_minutes, duration: row.duration_minutes, shopId: row.shop_id, barberUsername: provider, ownerUsername: provider, active: row.is_active, createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at) }; }),
      availability,
      bookings: bookings.map((row) => { const provider = usersById.get(membersById.get(row.provider_member_id)?.user_id)?.username ?? ""; return { id: row.id, shopId: row.shop_id, barberUsername: provider, ownerUsername: provider, serviceName: row.service_snapshot?.name ?? "Service", serviceTitle: row.service_snapshot?.name ?? "Service", clientName: row.client_name, clientContact: row.client_contact, clientEmail: row.client_email, clientPhone: row.client_phone, startISO: iso(row.start_at), endISO: iso(row.end_at), durationMinutes: row.duration_minutes, status: row.status, confirmationCode: row.confirmation_code, depositRequired: row.deposit_required, depositAmount: dollars(row.deposit_amount_cents), depositStatus: row.deposit_status, createdAtISO: iso(row.created_at), updatedAtISO: iso(row.updated_at) }; }),
      emails: emails.map((row) => ({ id: row.id, createdAtISO: iso(row.created_at), to: row.recipient_email, subject: row.subject, html: row.payload?.html ?? "", text: row.payload?.text ?? "", tags: row.payload?.tags ?? [], meta: row.payload?.meta ?? {} })),
    });
  }

  // The legacy routes save whole documents. Reconciliation must run in one
  // database RPC; it is never a browser call or a JSON fallback.
  async function writeStore(store) {
    const { error } = await client.rpc("slotzy_storage_write_snapshot", { snapshot: normalizeStoreShape(store) });
    fail(error, "write snapshot");
  }

  async function appendOutboxEmail(email) {
    const { error } = await client.from("email_outbox").insert({ recipient_email: email.to, subject: email.subject, template_type: email.tags?.[0] ?? null, payload: { html: email.html ?? "", text: email.text ?? "", tags: email.tags ?? [], meta: email.meta ?? {} }, delivery_status: "pending" });
    fail(error, "append outbox email"); return email;
  }
  async function listOutboxEmails(limit = 50) {
    const { data, error } = await client.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(Math.max(0, Math.floor(Number(limit) || 0)));
    fail(error, "list outbox emails"); return (data ?? []).map((row) => ({ id: row.id, createdAtISO: iso(row.created_at), to: row.recipient_email, subject: row.subject, html: row.payload?.html ?? "", text: row.payload?.text ?? "", tags: row.payload?.tags ?? [], meta: row.payload?.meta ?? {} }));
  }
  async function clearOutboxEmails() {
    // PostgREST rejects an unqualified DELETE. `id` is the non-null UUID primary
    // key, so this explicit predicate preserves the storage contract's clear-all
    // behavior without broadening permissions.
    const { data, error } = await client.from("email_outbox").delete().not("id", "is", null).select("id"); fail(error, "clear outbox emails"); return { cleared: data?.length ?? 0 };
  }
  async function createBookingAtomically(payload) {
    const { data, error } = await client.rpc("slotzy_create_booking", { payload }); fail(error, "create booking atomically"); return data;
  }
  return { readStore, writeStore, appendOutboxEmail, listOutboxEmails, clearOutboxEmails, createBookingAtomically, cents };
}

export const readStore = async () => createPostgresStore().readStore();
export const writeStore = async (store) => createPostgresStore().writeStore(store);
export const appendOutboxEmail = async (email) => createPostgresStore().appendOutboxEmail(email);
export const listOutboxEmails = async (limit) => createPostgresStore().listOutboxEmails(limit);
export const clearOutboxEmails = async () => createPostgresStore().clearOutboxEmails();
