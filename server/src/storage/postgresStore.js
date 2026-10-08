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
const PUBLIC_PROVIDER_ROLES = new Set(["owner", "barber"]);
const PUBLIC_BOOKING_STATUSES = ["booked", "confirmed"];
const PUBLIC_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function safeText(value) {
  return String(value ?? "").trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeText(value));
}

function isSyntheticPublicShop(shop) {
  const names = [shop?.name, shop?.businessName].map(safeText).filter(Boolean);
  if (names.some((value) => /^e2e\s/i.test(value) || /e2e-/i.test(value))) return true;
  return [shop?.slug, shop?.id].map(safeText).filter(Boolean)
    .some((value) => /(^|[-_])e2e(?:[-_]|$)/i.test(value));
}

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

export function buildPostgresShopSnapshot(shop, owner = null) {
  return normalizePostgresSnapshot({
    // Shop creation must reconcile the owner's membership in the same narrow
    // RPC. Existing branding updates may omit it because membership already
    // exists, but writeShop supplies the authoritative owner when available.
    users: owner ? [{ ...owner, shopId: shop?.id ?? owner?.shopId ?? null }] : [],
    shops: [shop],
    services: [],
    availability: {},
    bookings: [],
    emails: [],
  });
}

export function buildPostgresServiceSnapshot(service, provider = null) {
  return normalizePostgresSnapshot({
    // The provider record recreates/repairs only the membership needed by the
    // provider_services row. The target shop mapping already exists.
    users: provider ? [{ ...provider, shopId: service?.shopId ?? provider?.shopId ?? null }] : [],
    shops: [],
    services: [service],
    availability: {},
    bookings: [],
    emails: [],
  });
}

export function buildPostgresAvailabilitySnapshot(username, availability) {
  const providerUsername = String(username ?? "").trim();
  if (!providerUsername) throw new Error("Availability write requires a provider username");
  return normalizePostgresSnapshot({
    users: [],
    shops: [],
    services: [],
    availability: { [providerUsername]: availability },
    bookings: [],
    emails: [],
  });
}

export function buildPostgresUserSnapshot(user) {
  return normalizePostgresSnapshot({
    users: [user],
    shops: [],
    services: [],
    availability: {},
    bookings: [],
    emails: [],
  });
}

export function buildAtomicBookingPayload(booking, targets) {
  const contact = String(booking?.clientContact ?? "").trim();
  const email = String(booking?.clientEmail ?? "").trim() || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : "");
  const phone = String(booking?.clientPhone ?? "").trim() || (!email ? contact : "");
  return {
    shop_id: targets.shopId,
    provider_member_id: targets.providerMemberId,
    service_id: targets.serviceId,
    client_name: String(booking?.clientName ?? "").trim(),
    client_email: email,
    client_phone: phone,
    client_contact: contact,
    start_at: booking.startISO,
    end_at: booking.endISO,
    timezone: String(booking?.timezone ?? "America/Chicago").trim() || "America/Chicago",
    duration_minutes: Number(booking?.durationMinutes ?? 30),
    status: String(booking?.status ?? "booked").trim() || "booked",
    confirmation_code: String(booking?.confirmationCode ?? "").trim(),
    deposit_required: Boolean(booking?.depositRequired),
    deposit_amount_cents: cents(booking?.depositAmount),
    deposit_status: String(booking?.depositStatus ?? "not_required").trim() || "not_required",
    policy_snapshot: booking?.policySnapshot && typeof booking.policySnapshot === "object" ? booking.policySnapshot : {},
    service_snapshot: booking?.serviceSnapshot && typeof booking.serviceSnapshot === "object" ? booking.serviceSnapshot : {},
    manage_token_hash: String(booking?.manageTokenHash ?? "").trim(),
    manage_token_expires_at: booking?.manageTokenExpiresAt,
    actor_type: "public_client",
    request_id: booking?.requestId,
    queue_notification: false,
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
      ["read recurring time blocks", () => client.from("recurring_time_blocks").select("*").order("provider_member_id").order("weekday").order("start_time")],
      ["read bookings", () => client.from("bookings").select("*").order("id")],
      ["read manage tokens", () => client.from("booking_manage_tokens").select("booking_id, token_hash, revoked_at, expires_at").is("revoked_at", null)],
      ["read email outbox", () => client.from("email_outbox").select("*").order("id")],
      ["read canonical identity mappings", () => client.from("legacy_source_ids").select("entity_type,source_id,target_id").eq("is_canonical", true).order("entity_type").order("source_id")],
    ];
    const [users, shops, settings, members, services, providerServices, availabilityRows, timeOffRows, recurringRows, bookings, manageTokens, emails, canonicalMappings] = await Promise.all(
      reads.map(([operation, buildQuery]) => readAllRows(operation, buildQuery))
    );
    const canonicalSourceByTarget = new Map(canonicalMappings.map((row) => [`${row.entity_type}:${row.target_id}`, row.source_id]));
    const sourceId = (entityType, targetId) => canonicalSourceByTarget.get(`${entityType}:${targetId}`) ?? targetId;
    const usersById = new Map(users.map((row) => [row.id, row]));
    const membersById = new Map(members.map((row) => [row.id, row]));
    const shopByUser = new Map(); members.forEach((row) => { if (!shopByUser.has(row.user_id)) shopByUser.set(row.user_id, row.shop_id); });
    const settingsByShop = new Map(settings.map((row) => [row.shop_id, row]));
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const offByMember = new Map(); timeOffRows.forEach((row) => {
      const value = offByMember.get(row.provider_member_id) ?? [];
      value.push({ id: sourceId("time_off", row.id), startISO: iso(row.starts_at), endISO: iso(row.ends_at), note: row.note ?? "" }); offByMember.set(row.provider_member_id, value);
    });
    const recurringByMember = new Map(); recurringRows.forEach((row) => {
      const value = recurringByMember.get(row.provider_member_id) ?? [];
      value.push({ id: row.id, weekday: days[row.weekday], start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5), label: row.label ?? "Unavailable", enabled: row.is_enabled !== false });
      recurringByMember.set(row.provider_member_id, value);
    });
    const scheduleByMember = new Map(); availabilityRows.forEach((row) => {
      const value = scheduleByMember.get(row.provider_member_id) ?? []; value.push(row); scheduleByMember.set(row.provider_member_id, value);
    });
    const availability = {};
    members.forEach((member) => {
      const user = usersById.get(member.user_id); if (!user) return;
      const rows = scheduleByMember.get(member.id) ?? []; const weekly = {};
      rows.forEach((row) => { weekly[days[row.weekday]] = { enabled: row.is_enabled, start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5) }; });
      availability[user.username] = { timezone: rows[0]?.timezone ?? "America/Chicago", bufferMinutes: rows[0]?.buffer_minutes ?? 0, weekly, timeOff: offByMember.get(member.id) ?? [], recurringBlocks: recurringByMember.get(member.id) ?? [] };
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

  // Authentication needs one user and, at most, that user's shop membership.
  // Keep /auth/me independent of the full operational snapshot so an unrelated
  // bookings/services read cannot make a valid JWT look invalid.
  async function readUserByUsername(username) {
    beginOperation();
    const key = String(username ?? "").trim();
    if (!key) return null;

    const { data: row, error: userError } = await client.from("users")
      .select("id,username,display_name,role,created_at")
      .eq("username", key)
      .is("deleted_at", null)
      .maybeSingle();
    fail(userError, "read auth user", networkFailures);
    if (!row) return null;

    const [{ data: membershipRows, error: membershipError }, { data: ownedShopRows, error: ownedShopError }] = await Promise.all([
      client.from("shop_members")
        .select("shop_id")
        .eq("user_id", row.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at")
        .limit(1),
      client.from("shops")
        .select("id")
        .eq("owner_user_id", row.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at")
        .limit(1),
    ]);
    fail(membershipError, "read auth membership", networkFailures);
    fail(ownedShopError, "read auth owned shop", networkFailures);
    const relationalShopId = membershipRows?.[0]?.shop_id ?? ownedShopRows?.[0]?.id ?? null;

    let shopId = relationalShopId;
    if (relationalShopId) {
      const { data: mapping, error: mappingError } = await client.from("legacy_source_ids")
        .select("source_id")
        .eq("entity_type", "shop")
        .eq("target_id", relationalShopId)
        .eq("is_canonical", true)
        .maybeSingle();
      fail(mappingError, "read auth shop identity", networkFailures);
      shopId = mapping?.source_id ?? relationalShopId;
    }

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      shopId,
      createdAt: iso(row.created_at),
    };
  }

  async function readCanonicalSourceIds(entityType, targetIds, operation) {
    const ids = [...new Set((targetIds ?? []).map((id) => safeText(id)).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const rows = await readAllRows(operation, () => client.from("legacy_source_ids")
      .select("source_id,target_id")
      .eq("entity_type", entityType)
      .eq("is_canonical", true)
      .in("target_id", ids));
    return new Map(rows.map((row) => [row.target_id, row.source_id]));
  }

  function mapServiceRowsToLegacy(services, providerServices, membersById, usersById, sourceByService, sourceByShop) {
    const providerByService = new Map();
    providerServices.forEach((row) => {
      if (providerByService.has(row.service_id)) return;
      const username = usersById.get(membersById.get(row.provider_member_id)?.user_id)?.username ?? "";
      providerByService.set(row.service_id, username);
    });
    return services.map((row) => {
      const provider = providerByService.get(row.id) ?? "";
      return {
        id: sourceByService.get(row.id) ?? row.id,
        name: row.name,
        title: row.name,
        price: dollars(row.price_cents),
        durationMinutes: row.duration_minutes,
        duration: row.duration_minutes,
        shopId: sourceByShop.get(row.shop_id) ?? row.shop_id,
        barberUsername: provider,
        ownerUsername: provider,
        active: row.is_active,
        createdAtISO: iso(row.created_at),
        updatedAtISO: iso(row.updated_at),
      };
    });
  }

  // Login is the sole caller allowed to receive the password hash. Keep that
  // query separate from authenticated identity reads so middleware and public
  // responses cannot acquire credential material accidentally.
  async function readLoginCredentialByUsername(username) {
    beginOperation();
    const key = String(username ?? "").trim();
    if (!key) return null;

    const { data: row, error } = await client.from("users")
      .select("id,username,display_name,password_hash,role,created_at")
      .eq("username", key)
      .is("deleted_at", null)
      .maybeSingle();
    fail(error, "read login credential", networkFailures);
    if (!row) return null;

    const [{ data: membershipRows, error: membershipError }, { data: ownedShopRows, error: ownedShopError }] = await Promise.all([
      client.from("shop_members")
        .select("shop_id")
        .eq("user_id", row.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at")
        .limit(1),
      client.from("shops")
        .select("id")
        .eq("owner_user_id", row.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at")
        .limit(1),
    ]);
    fail(membershipError, "read login membership", networkFailures);
    fail(ownedShopError, "read login owned shop", networkFailures);
    const relationalShopId = membershipRows?.[0]?.shop_id ?? ownedShopRows?.[0]?.id ?? null;

    let shopId = relationalShopId;
    if (relationalShopId) {
      const { data: mapping, error: mappingError } = await client.from("legacy_source_ids")
        .select("source_id")
        .eq("entity_type", "shop")
        .eq("target_id", relationalShopId)
        .eq("is_canonical", true)
        .maybeSingle();
      fail(mappingError, "read login shop identity", networkFailures);
      shopId = mapping?.source_id ?? relationalShopId;
    }

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      role: row.role,
      shopId,
      createdAt: iso(row.created_at),
    };
  }

  // Fetches only the anonymous booking projection. It intentionally omits
  // credential columns, customer contact fields, manage-token hashes, and
  // email/outbox rows; the route still applies its existing public allowlist.
  async function readPublicBookingStore({ shopId = "", slug = "" } = {}) {
    beginOperation();
    const requestedShopId = safeText(shopId);
    const requestedSlug = safeText(slug).toLowerCase();
    let relationalRequestedShopId = requestedShopId;
    if (requestedShopId) {
      const { data: mapping, error: mappingError } = await client.from("legacy_source_ids")
        .select("target_id").eq("entity_type", "shop").eq("source_id", requestedShopId).eq("is_canonical", true).maybeSingle();
      fail(mappingError, "resolve public booking shop", networkFailures);
      if (!mapping?.target_id && !isUuid(requestedShopId)) {
        return { users: [], shops: [], services: [], availability: {}, bookings: [], emails: [] };
      }
      relationalRequestedShopId = mapping?.target_id ?? requestedShopId;
    }
    let shopQuery = client.from("shops")
      .select("id,owner_user_id,name,slug,phone,email,logo_url,cover_url,is_active,created_at,updated_at")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("id");
    if (relationalRequestedShopId) shopQuery = shopQuery.eq("id", relationalRequestedShopId);
    else if (requestedSlug) shopQuery = shopQuery.eq("slug", requestedSlug);
    const shops = await readAllRows("read public booking shops", () => shopQuery);
    const visibleShops = (requestedShopId || requestedSlug) ? shops : shops.filter((shop) => !isSyntheticPublicShop(shop));
    const shopIds = visibleShops.map((shop) => shop.id);
    if (shopIds.length === 0) return { users: [], shops: [], services: [], availability: {}, bookings: [], emails: [] };

    const [settings, members, services, sourceByShop] = await Promise.all([
      readAllRows("read public booking settings", () => client.from("shop_settings").select("*").in("shop_id", shopIds)),
      readAllRows("read public booking members", () => client.from("shop_members")
        .select("id,shop_id,user_id").in("shop_id", shopIds).eq("is_active", true).is("deleted_at", null).order("id")),
      readAllRows("read public booking services", () => client.from("services")
        .select("id,shop_id,name,price_cents,duration_minutes,is_active,created_at,updated_at")
        .in("shop_id", shopIds).eq("is_active", true).is("deleted_at", null).order("id")),
      readCanonicalSourceIds("shop", shopIds, "read public booking shop identities"),
    ]);
    const userIds = [...new Set([...visibleShops.map((shop) => shop.owner_user_id), ...members.map((member) => member.user_id)].filter(Boolean))];
    const users = userIds.length === 0 ? [] : await readAllRows("read public booking providers", () => client.from("users")
      .select("id,username,display_name,role,created_at").in("id", userIds).is("deleted_at", null).order("id"));
    const usersById = new Map(users.map((user) => [user.id, user]));
    const membersById = new Map(members.map((member) => [member.id, member]));
    const providerMembers = members.filter((member) => PUBLIC_PROVIDER_ROLES.has(safeText(usersById.get(member.user_id)?.role).toLowerCase()));
    const providerMemberIds = providerMembers.map((member) => member.id);
    const serviceIds = services.map((service) => service.id);
    const [providerServices, availabilityRows, timeOffRows, recurringRows, bookingRows, sourceByService] = await Promise.all([
      serviceIds.length === 0 ? Promise.resolve([]) : readAllRows("read public booking provider services", () => client.from("provider_services")
        .select("provider_member_id,service_id").in("service_id", serviceIds).order("provider_member_id").order("service_id")),
      providerMemberIds.length === 0 ? Promise.resolve([]) : readAllRows("read public booking availability", () => client.from("availability")
        .select("provider_member_id,weekday,start_time,end_time,timezone,buffer_minutes,is_enabled").in("provider_member_id", providerMemberIds).order("id")),
      providerMemberIds.length === 0 ? Promise.resolve([]) : readAllRows("read public booking time off", () => client.from("time_off")
        .select("id,provider_member_id,starts_at,ends_at,note").in("provider_member_id", providerMemberIds).order("id")),
      providerMemberIds.length === 0 ? Promise.resolve([]) : readAllRows("read public booking recurring blocks", () => client.from("recurring_time_blocks")
        .select("id,provider_member_id,weekday,start_time,end_time,label,is_enabled").in("provider_member_id", providerMemberIds).order("provider_member_id").order("weekday").order("start_time")),
      readAllRows("read public booking windows", () => client.from("bookings")
        .select("shop_id,provider_member_id,start_at,end_at,duration_minutes,status").in("shop_id", shopIds).in("status", PUBLIC_BOOKING_STATUSES).order("start_at")),
      readCanonicalSourceIds("service", serviceIds, "read public booking service identities"),
    ]);
    const settingsByShop = new Map(settings.map((row) => [row.shop_id, row]));
    const providerByMember = new Map(providerMembers.map((member) => [member.id, usersById.get(member.user_id)]));
    const providerUsers = providerMembers.map((member) => {
      const user = usersById.get(member.user_id);
      return { id: user.id, username: user.username, displayName: user.display_name, role: user.role, shopId: sourceByShop.get(member.shop_id) ?? member.shop_id, createdAt: iso(user.created_at) };
    });
    const scheduleByMember = new Map();
    availabilityRows.forEach((row) => { const rows = scheduleByMember.get(row.provider_member_id) ?? []; rows.push(row); scheduleByMember.set(row.provider_member_id, rows); });
    const timeOffByMember = new Map();
    timeOffRows.forEach((row) => { const rows = timeOffByMember.get(row.provider_member_id) ?? []; rows.push({ id: row.id, startISO: iso(row.starts_at), endISO: iso(row.ends_at), note: row.note ?? "" }); timeOffByMember.set(row.provider_member_id, rows); });
    const recurringByMember = new Map();
    recurringRows.forEach((row) => { const rows = recurringByMember.get(row.provider_member_id) ?? []; rows.push({ id: row.id, weekday: PUBLIC_DAYS[row.weekday], start: safeText(row.start_time).slice(0, 5), end: safeText(row.end_time).slice(0, 5), label: row.label ?? "Unavailable", enabled: row.is_enabled !== false }); recurringByMember.set(row.provider_member_id, rows); });
    const availability = {};
    providerMembers.forEach((member) => {
      const provider = providerByMember.get(member.id); if (!provider) return;
      const rows = scheduleByMember.get(member.id) ?? []; const weekly = {};
      rows.forEach((row) => { weekly[PUBLIC_DAYS[row.weekday]] = { enabled: row.is_enabled, start: safeText(row.start_time).slice(0, 5), end: safeText(row.end_time).slice(0, 5) }; });
      availability[provider.username] = { timezone: rows[0]?.timezone ?? "America/Chicago", bufferMinutes: rows[0]?.buffer_minutes ?? 0, weekly, timeOff: timeOffByMember.get(member.id) ?? [], recurringBlocks: recurringByMember.get(member.id) ?? [] };
    });
    return {
      users: providerUsers,
      shops: visibleShops.map((shop) => ({ id: sourceByShop.get(shop.id) ?? shop.id, name: shop.name, businessName: shop.name, slug: shop.slug, ownerUsername: usersById.get(shop.owner_user_id)?.username ?? "", shopPhone: shop.phone ?? "", shopEmail: shop.email ?? "", logo: shop.logo_url ?? "", cover: shop.cover_url ?? "", createdAtISO: iso(shop.created_at), updatedAtISO: iso(shop.updated_at), bookingPolicy: legacyPolicy(settingsByShop.get(shop.id)) })),
      services: mapServiceRowsToLegacy(services, providerServices, membersById, usersById, sourceByService, sourceByShop),
      availability,
      bookings: bookingRows.map((booking) => ({ shopId: sourceByShop.get(booking.shop_id) ?? booking.shop_id, ownerUsername: providerByMember.get(booking.provider_member_id)?.username ?? "", barberUsername: providerByMember.get(booking.provider_member_id)?.username ?? "", startISO: iso(booking.start_at), endISO: iso(booking.end_at), durationMinutes: booking.duration_minutes, status: booking.status })),
      emails: [],
    };
  }

  async function listServicesForAuthenticatedUser(user) {
    beginOperation();
    const role = safeText(user?.role).toLowerCase();
    if (role !== "owner" && role !== "barber") return null;
    const userId = safeText(user?.id);
    if (!userId) return [];
    let services = [];
    if (role === "owner") {
      const sourceShopId = safeText(user?.shopId);
      if (!sourceShopId) return [];
      const { data: mapping, error: mappingError } = await client.from("legacy_source_ids")
        .select("target_id").eq("entity_type", "shop").eq("source_id", sourceShopId).eq("is_canonical", true).maybeSingle();
      fail(mappingError, "resolve owner service shop", networkFailures);
      const shopId = mapping?.target_id ?? sourceShopId;
      services = await readAllRows("read owner services", () => client.from("services")
        .select("id,shop_id,name,price_cents,duration_minutes,is_active,created_at,updated_at").eq("shop_id", shopId).is("deleted_at", null).order("id"));
    } else {
      const memberships = await readAllRows("read service memberships", () => client.from("shop_members")
        .select("id,shop_id,user_id").eq("user_id", userId).eq("is_active", true).is("deleted_at", null).order("id"));
      const memberIds = memberships.map((member) => member.id);
      if (memberIds.length === 0) return [];
      const ownLinks = await readAllRows("read barber service memberships", () => client.from("provider_services")
        .select("service_id").in("provider_member_id", memberIds).order("service_id"));
      const serviceIds = [...new Set(ownLinks.map((row) => row.service_id).filter(Boolean))];
      if (serviceIds.length === 0) return [];
      services = await readAllRows("read barber services", () => client.from("services")
        .select("id,shop_id,name,price_cents,duration_minutes,is_active,created_at,updated_at").in("id", serviceIds).is("deleted_at", null).order("id"));
    }
    const serviceIds = services.map((service) => service.id);
    if (serviceIds.length === 0) return [];
    const providerServices = await readAllRows("read service providers", () => client.from("provider_services").select("provider_member_id,service_id").in("service_id", serviceIds).order("provider_member_id").order("service_id"));
    const providerMemberIds = [...new Set(providerServices.map((row) => row.provider_member_id).filter(Boolean))];
    const [allMembers, sourceByService, sourceByShop] = await Promise.all([
      providerMemberIds.length === 0 ? Promise.resolve([]) : readAllRows("read service provider identities", () => client.from("shop_members").select("id,shop_id,user_id").in("id", providerMemberIds).eq("is_active", true).is("deleted_at", null).order("id")),
      readCanonicalSourceIds("service", serviceIds, "read service identities"),
      readCanonicalSourceIds("shop", [...new Set(services.map((service) => service.shop_id))], "read service shop identities"),
    ]);
    const providerUserIds = [...new Set(allMembers.map((member) => member.user_id).filter(Boolean))];
    const users = providerUserIds.length === 0 ? [] : await readAllRows("read service providers", () => client.from("users").select("id,username").in("id", providerUserIds).is("deleted_at", null).order("id"));
    const membersById = new Map(allMembers.map((member) => [member.id, member]));
    const usersById = new Map(users.map((entry) => [entry.id, entry]));
    const legacy = mapServiceRowsToLegacy(services, providerServices, membersById, usersById, sourceByService, sourceByShop);
    if (role === "barber") {
      const username = safeText(user?.username).toLowerCase();
      return legacy.filter((service) => safeText(service.barberUsername).toLowerCase() === username);
    }
    return legacy;
  }

  // The legacy routes save whole documents. Reconciliation must run in one
  // database RPC; it is never a browser call or a JSON fallback.
  async function writeStore(store) {
    beginOperation();
    const { error } = await client.rpc("slotzy_storage_write_snapshot_with_recurring", { snapshot: normalizePostgresSnapshot(store) });
    fail(error, "write snapshot", networkFailures);
  }

  // Registration creates one identity. Sending only that identity through the
  // additive base RPC avoids rewriting unrelated hosted operational data while
  // keeping user creation and legacy source mapping in one transaction.
  async function writeUser(user) {
    beginOperation();
    const { error } = await client.rpc("slotzy_storage_write_snapshot", {
      snapshot: buildPostgresUserSnapshot(user),
    });
    fail(error, "write user snapshot", networkFailures);
  }

  // The reconciliation RPC updates only rows named by its input. A shop-only
  // snapshot keeps branding writes atomic without retransmitting every other
  // shop's embedded images and unrelated operational data.
  async function writeShop(shop, store = null) {
    beginOperation();
    const ownerUsername = String(shop?.ownerUsername ?? "").trim().toLowerCase();
    const owner = Array.isArray(store?.users)
      ? store.users.find((user) => String(user?.username ?? "").trim().toLowerCase() === ownerUsername) || null
      : null;
    const { error } = await client.rpc("slotzy_storage_write_snapshot", {
      snapshot: buildPostgresShopSnapshot(shop, owner),
    });
    fail(error, "write shop snapshot", networkFailures);
  }

  async function writeService(service, store = null) {
    beginOperation();
    const providerUsername = String(service?.barberUsername ?? service?.ownerUsername ?? "").trim().toLowerCase();
    const provider = Array.isArray(store?.users)
      ? store.users.find((user) => String(user?.username ?? "").trim().toLowerCase() === providerUsername) || null
      : null;
    const { error } = await client.rpc("slotzy_storage_write_snapshot", {
      snapshot: buildPostgresServiceSnapshot(service, provider),
    });
    fail(error, "write service snapshot", networkFailures);
  }

  async function writeAvailability(username, availability) {
    beginOperation();
    const { error } = await client.rpc("slotzy_storage_write_snapshot_with_recurring", {
      snapshot: buildPostgresAvailabilitySnapshot(username, availability),
    });
    fail(error, "write availability snapshot", networkFailures);
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
  async function writeBooking(booking) {
    beginOperation();
    const shopSourceId = String(booking?.shopId ?? "").trim();
    const serviceSourceId = String(booking?.serviceId ?? "").trim();
    const providerSourceId = `${shopSourceId}:${String(booking?.barberUsername ?? booking?.ownerUsername ?? "").trim()}`;
    const references = [
      ["shop", shopSourceId],
      ["service", serviceSourceId],
      ["member", providerSourceId],
    ];
    const { data: mappings, error: mappingError } = await client.from("legacy_source_ids")
      .select("entity_type,source_id,target_id")
      .in("entity_type", references.map(([entityType]) => entityType))
      .in("source_id", references.map(([, sourceId]) => sourceId))
      .eq("is_canonical", true);
    fail(mappingError, "resolve booking references", networkFailures);
    const targetBySource = new Map((mappings ?? []).map((row) => [`${row.entity_type}:${row.source_id}`, row.target_id]));
    const targets = {
      shopId: targetBySource.get(`shop:${shopSourceId}`),
      serviceId: targetBySource.get(`service:${serviceSourceId}`),
      providerMemberId: targetBySource.get(`member:${providerSourceId}`),
    };
    if (!targets.shopId || !targets.serviceId || !targets.providerMemberId) {
      const error = new Error("booking references could not be resolved");
      error.code = "booking_reference_missing";
      error.storageDiagnostic = { operation: "resolve booking references" };
      throw error;
    }
    return createBookingAtomically(buildAtomicBookingPayload(booking, targets));
  }
  async function storeManageToken(bookingSourceId, tokenHash, expiresAt) {
    beginOperation();
    const { data: mapping, error: mapError } = await client.from("legacy_source_ids").select("target_id").eq("entity_type", "booking").eq("source_id", bookingSourceId).eq("is_canonical", true).maybeSingle();
    fail(mapError, "resolve manage token booking", networkFailures);
    const bookingId = mapping?.target_id ?? bookingSourceId;
    // A recovery request rotates the credential. Revoke active predecessors
    // before adding the replacement; first-time issuance simply matches none.
    const { error: revokeError } = await client.from("booking_manage_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("booking_id", bookingId)
      .is("revoked_at", null);
    fail(revokeError, "revoke previous manage token", networkFailures);
    const { error } = await client.from("booking_manage_tokens").insert({ booking_id: bookingId, token_hash: tokenHash, expires_at: expiresAt });
    fail(error, "store manage token", networkFailures);
  }
  return { readStore, readUserByUsername, readLoginCredentialByUsername, readPublicBookingStore, listServicesForAuthenticatedUser, writeStore, writeUser, writeShop, writeService, writeAvailability, writeBooking, appendOutboxEmail, listOutboxEmails, clearOutboxEmails, createBookingAtomically, storeManageToken, cents };
}

export const readStore = async () => createPostgresStore().readStore();
export const readUserByUsername = async (username) => createPostgresStore().readUserByUsername(username);
export const readLoginCredentialByUsername = async (username) => createPostgresStore().readLoginCredentialByUsername(username);
export const readPublicBookingStore = async (options) => createPostgresStore().readPublicBookingStore(options);
export const listServicesForAuthenticatedUser = async (user) => createPostgresStore().listServicesForAuthenticatedUser(user);
export const writeStore = async (store) => createPostgresStore().writeStore(store);
export const writeUser = async (user) => createPostgresStore().writeUser(user);
export const writeShop = async (shop, store) => createPostgresStore().writeShop(shop, store);
export const writeService = async (service, store) => createPostgresStore().writeService(service, store);
export const writeAvailability = async (username, availability, store) => createPostgresStore().writeAvailability(username, availability, store);
export const writeBooking = async (booking) => createPostgresStore().writeBooking(booking);
export const appendOutboxEmail = async (email) => createPostgresStore().appendOutboxEmail(email);
export const listOutboxEmails = async (limit) => createPostgresStore().listOutboxEmails(limit);
export const clearOutboxEmails = async () => createPostgresStore().clearOutboxEmails();
