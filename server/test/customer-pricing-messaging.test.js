import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const clientManageUrl = new URL("../../js/client-manage.js", import.meta.url);
const bookingEngineUrl = new URL("../../js/booking-engine.js", import.meta.url);
const managePageUrl = new URL("../../pages/manage.html", import.meta.url);

test("customer management preserves a real zero price and labels an absent price as unavailable", async () => {
  const source = await readFile(clientManageUrl, "utf8");
  assert.match(source, /price:\s*booking\?\.price\s*\?\?\s*null/);
  assert.match(source, /return "Price unavailable"/);
  assert.doesNotMatch(source, /price:\s*Number\(booking\?\.price\s*\?\?\s*0\)/);
});

test("customer receipt describes the supported private-link rescheduling workflow", async () => {
  const source = await readFile(bookingEngineUrl, "utf8");
  assert.match(source, /Use it to view, cancel, or reschedule your appointment\./);
  assert.match(source, /Rescheduling is available for eligible future appointments/);
  assert.doesNotMatch(source, /Rescheduling is not available from token links yet; cancel and rebook/i);
});

test("customer management page describes eligible private-link rescheduling", async () => {
  const source = await readFile(managePageUrl, "utf8");
  assert.match(source, /view, cancel, or reschedule eligible appointments, subject to the shop's policies/i);
  assert.doesNotMatch(source, /if you need a different time, cancel and book again/i);
});
