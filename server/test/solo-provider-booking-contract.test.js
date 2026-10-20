import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const bookingEngineUrl = new URL("../../js/booking-engine.js", import.meta.url);
const bookingPageUrl = new URL("../../pages/book.html", import.meta.url);

test("solo-provider booking auto-selects the canonical provider and shows a friendly assignment", async () => {
  const [engine, page] = await Promise.all([readFile(bookingEngineUrl, "utf8"), readFile(bookingPageUrl, "utf8")]);
  assert.match(engine, /else if \(barbers\.length === 1\) \{\s*selectedBarberUsername = barbers\[0\]\.username/);
  assert.match(engine, /Your appointment will be with \$\{soleBarber\.displayName\}\./);
  assert.match(engine, /option value="\$\{escapeHtml\(barber\.username\)\}"/);
  assert.match(page, /id="soloBarberNotice"/);
});
