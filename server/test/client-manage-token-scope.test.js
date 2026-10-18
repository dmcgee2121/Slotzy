import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("token-scoped manage reschedule bypasses only the legacy contact filter", async () => {
  const source = await readFile(new URL("../../js/client-manage.js", import.meta.url), "utf8");
  assert.match(source, /if \(currentQuery\.token && dataStore\.shouldUsePublicBookingApi\(\)\) \{\s*return String\(booking\?\.id \?\? ""\)\.trim\(\) === String\(currentPublicBooking\?\.id \?\? ""\)\.trim\(\);/);
  assert.match(source, /return Boolean\(currentContact\) && bookingContact === currentContact;/);
  assert.match(source, /return currentPublicBooking \? \[currentPublicBooking\] : \[\];/);
});
