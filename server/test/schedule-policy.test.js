import test from "node:test";
import assert from "node:assert/strict";
import { isBookingAllowedByAvailability } from "../src/schedulePolicy.js";

const availability = {
  timezone: "America/Chicago",
  weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } },
  timeOff: [{ startISO: "2032-06-07T19:00:00.000Z", endISO: "2032-06-07T19:30:00.000Z" }],
  recurringBlocks: [{ weekday: "mon", start: "12:00", end: "13:00", label: "Lunch", enabled: true }],
};

test("authoritative availability rejects recurring and one-time blocks while allowing outside slots", () => {
  assert.equal(isBookingAllowedByAvailability(availability, new Date("2032-06-07T17:00:00.000Z"), new Date("2032-06-07T17:30:00.000Z")), false);
  assert.equal(isBookingAllowedByAvailability(availability, new Date("2032-06-07T19:00:00.000Z"), new Date("2032-06-07T19:30:00.000Z")), false);
  assert.equal(isBookingAllowedByAvailability(availability, new Date("2032-06-07T20:00:00.000Z"), new Date("2032-06-07T20:30:00.000Z")), true);
});
