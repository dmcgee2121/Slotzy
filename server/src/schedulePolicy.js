function zonedParts(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { weekday: String(values.weekday ?? "").slice(0, 3).toLowerCase(), minutes: Number(values.hour) * 60 + Number(values.minute) };
  } catch {
    return null;
  }
}

function minutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}

export function isBookingAllowedByAvailability(availability, start, end) {
  const timeZone = String(availability?.timezone ?? "America/Chicago");
  const startParts = zonedParts(start, timeZone);
  const endParts = zonedParts(end, timeZone);
  if (!startParts || !endParts || startParts.weekday !== endParts.weekday) return false;
  const hours = availability?.weekly?.[startParts.weekday];
  if (!hours?.enabled || startParts.minutes < minutes(hours.start) || endParts.minutes > minutes(hours.end)) return false;
  if ((availability?.timeOff ?? []).some((block) => start < new Date(block.endISO) && end > new Date(block.startISO))) return false;
  return !(availability?.recurringBlocks ?? []).some((block) => block?.enabled !== false
    && block?.weekday === startParts.weekday
    && startParts.minutes < minutes(block.end)
    && endParts.minutes > minutes(block.start));
}
