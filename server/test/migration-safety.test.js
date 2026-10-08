import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL("../../docs/SUPABASE_RECURRING_BLOCKS_MIGRATION.sql", import.meta.url);
const manageCancelMigrationUrl = new URL("../../docs/SUPABASE_MANAGE_CANCEL_MIGRATION.sql", import.meta.url);
const schemaUrl = new URL("../../docs/SUPABASE_SCHEMA.sql", import.meta.url);

function functionDefinition(sql, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(new RegExp(`create or replace function public\\.${escapedName}\\(payload jsonb\\)[\\s\\S]*?\\n\\$\\$;`, "i"));
  assert.ok(match, `${name} definition should exist`);
  return match[0]
    .replace(/\s*([(),;])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

test("recurring reconciliation requires an explicit recurringBlocks key", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /if not \(v_schedule \? 'recurringBlocks'\) then\s+continue;\s+end if;/i);
  assert.match(migration, /jsonb_array_elements\(coalesce\(v_schedule->'recurringBlocks', '\[\]'::jsonb\)\)/i);
});

test("recurring migration remains additive and service-role-only", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(migration, /\btruncate\b|\bdrop\s+table\b|\bdelete\s+from\s+public\.(?!recurring_time_blocks\b)/i);
  assert.match(migration, /alter table public\.recurring_time_blocks enable row level security;/i);
  assert.doesNotMatch(migration, /\bcreate\s+policy\b|\bgrant\b[^;]*\bto\s+(anon|authenticated)\b/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.recurring_time_blocks to service_role;/i);
  assert.match(migration, /revoke all on function[\s\S]*slotzy_create_booking\(jsonb\) from public;/i);
  assert.match(migration, /grant execute on function[\s\S]*slotzy_create_booking\(jsonb\) to service_role;/i);
});

test("migration booking RPC matches the canonical schema definition", async () => {
  const [migration, schema] = await Promise.all([readFile(migrationUrl, "utf8"), readFile(schemaUrl, "utf8")]);
  assert.equal(functionDefinition(migration, "slotzy_create_booking"), functionDefinition(schema, "slotzy_create_booking"));
});

test("manage cancellation migration is additive and service-role-only", async () => {
  const migration = await readFile(manageCancelMigrationUrl, "utf8");
  assert.doesNotMatch(migration, /\btruncate\b|\bdrop\s+table\b|\bdelete\s+from\b/i);
  assert.match(migration, /security definer\s+set search_path = public/i);
  assert.match(migration, /revoke all on function public\.slotzy_cancel_booking_by_manage_token_hash\(text\) from public;/i);
  assert.match(migration, /grant execute on function public\.slotzy_cancel_booking_by_manage_token_hash\(text\) to service_role;/i);
  assert.doesNotMatch(migration, /\bgrant\b[^;]*\bto\s+(anon|authenticated)\b/i);
});

test("manage cancellation RPC locks token and booking and records the cancellation event", async () => {
  const migration = await readFile(manageCancelMigrationUrl, "utf8");
  assert.match(migration, /token\.token_hash = p_token_hash[\s\S]*?token\.revoked_at is null[\s\S]*?token\.expires_at > now\(\)[\s\S]*?for update;/i);
  assert.match(migration, /where booking\.id = v_token\.booking_id\s+for update;/i);
  assert.match(migration, /v_before\.status not in \('booked', 'confirmed'\)/i);
  assert.match(migration, /v_before\.start_at - make_interval\(hours => v_cancel_hours\)/i);
  assert.match(migration, /update public\.bookings[\s\S]*?status = 'cancelled'[\s\S]*?where id = v_before\.id and status in \('booked', 'confirmed'\)/i);
  assert.match(migration, /insert into public\.booking_events[\s\S]*?'cancelled', 'public_client'/i);
  assert.doesNotMatch(migration, /['"]manageTokenHash['"]|['"]manage_token_hash['"]/i);
});
