import * as dataStore from "./dataStore.js";

const BUFFER_OPTIONS = [0, 5, 10, 15];
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

let currentBarberUsername = "";

initOwnerAvailability();

function initOwnerAvailability() {
  const weeklyBody = document.getElementById("availability-weekly-body");
  if (!weeklyBody) return;

  const sessionUser = dataStore.getSessionUser();
  const username = String(sessionUser?.username ?? "").trim();
  const role = String(sessionUser?.role ?? "").toLowerCase();
  const isStaff = role === "owner" || role === "barber";
  if (!username || !isStaff) {
    renderStaffOnlyState();
    return;
  }
  currentBarberUsername = username;

  renderAvailability();
  document.getElementById("availability-save-weekly")?.addEventListener("click", saveWeeklyAvailability);
  document.getElementById("availability-add-timeoff")?.addEventListener("click", addTimeOffBlock);
  document.getElementById("availability-add-lunch-break")?.addEventListener("click", () => addQuickBreakBlock({
    startTime: "12:00",
    endTime: "13:00",
    note: "Lunch",
  }));
  document.getElementById("availability-add-afternoon-break")?.addEventListener("click", () => addQuickBreakBlock({
    startTime: "15:00",
    endTime: "15:15",
    note: "Break",
  }));
  document.getElementById("availability-block-day")?.addEventListener("click", handleBlockOffDay);
  document.getElementById("availability-clear-day-blocks")?.addEventListener("click", handleClearDayBlocks);
  document.getElementById("availability-add-custom-break")?.addEventListener("click", handleAddCustomBreak);
  weeklyBody.addEventListener("change", handleWeeklyFieldChange);
  document.getElementById("availability-timeoff-list")?.addEventListener("click", handleTimeOffListClick);
  document.getElementById("availability-add-recurring")?.addEventListener("click", addRecurringBlocks);
  document.getElementById("availability-recurring-list")?.addEventListener("click", handleRecurringListClick);
}

function renderStaffOnlyState() {
  const section = document.getElementById("owner-availability");
  if (!section) return;
  section.innerHTML = `
    <section class="empty-state">
      <span class="empty-state-icon" aria-hidden="true">S</span>
      <h3>Staff sign-in required</h3>
      <p>Log in as an owner or barber to manage availability.</p>
    </section>
  `;
}

function createDefaultAvailability() {
  return {
    timezone: "America/Chicago",
    bufferMinutes: 0,
    weekly: {
      mon: { enabled: true, start: "09:00", end: "17:00" },
      tue: { enabled: true, start: "09:00", end: "17:00" },
      wed: { enabled: true, start: "09:00", end: "17:00" },
      thu: { enabled: true, start: "09:00", end: "17:00" },
      fri: { enabled: true, start: "09:00", end: "17:00" },
      sat: { enabled: true, start: "09:00", end: "17:00" },
      sun: { enabled: false, start: "09:00", end: "17:00" },
    },
    timeOff: [],
    recurringBlocks: [],
  };
}

function loadAvailability() {
  const defaults = createDefaultAvailability();
  const scoped = dataStore.getAvailabilityForBarber(currentBarberUsername);
  const parsed = scoped && typeof scoped === "object" ? scoped : {};

  const bufferRaw = Number(parsed?.bufferMinutes ?? defaults.bufferMinutes);
  const bufferMinutes = BUFFER_OPTIONS.includes(bufferRaw) ? bufferRaw : defaults.bufferMinutes;
  const timezone = String(parsed?.timezone ?? defaults.timezone).trim() || defaults.timezone;

  const weekly = {};
  DAY_ORDER.forEach((day) => {
    const fallback = defaults.weekly[day];
    const source = parsed?.weekly?.[day] || {};
    weekly[day] = {
      enabled: Boolean(source.enabled ?? fallback.enabled),
      start: normalizeTimeValue(source.start, fallback.start),
      end: normalizeTimeValue(source.end, fallback.end),
    };
  });

  const timeOff = Array.isArray(parsed?.timeOff)
    ? parsed.timeOff
      .map((block) => normalizeTimeOffBlock(block))
      .filter(Boolean)
      .sort((a, b) => a.startISO.localeCompare(b.startISO))
    : [];
  const recurringBlocks = Array.isArray(parsed?.recurringBlocks)
    ? parsed.recurringBlocks.map(normalizeRecurringBlock).filter(Boolean)
      .sort((a, b) => DAY_ORDER.indexOf(a.weekday) - DAY_ORDER.indexOf(b.weekday) || a.start.localeCompare(b.start))
    : [];

  return { timezone, bufferMinutes, weekly, timeOff, recurringBlocks };
}

function saveAvailability(availability) {
  return dataStore.saveAvailabilityForBarberAsync(currentBarberUsername, availability, { fallbackOnError: false });
}

function renderAvailability() {
  const availability = loadAvailability();
  renderWeeklyTable(availability.weekly);
  renderAvailabilityMeta(availability);
  renderQuickBreakDate();
  renderTimeOffList(availability.timeOff);
  renderRecurringBlocks(availability.recurringBlocks);
  clearWeeklyError();
  clearTimeOffError();
  clearRecurringError();
}

function renderQuickBreakDate() {
  const quickDateInput = document.getElementById("availability-quick-date");
  if (!quickDateInput || quickDateInput.value) return;
  quickDateInput.value = toLocalDateInputValue(new Date());
}

function renderAvailabilityMeta(availability) {
  const timezoneEl = document.getElementById("availability-timezone");
  const bufferEl = document.getElementById("availability-buffer");
  if (timezoneEl) {
    const hasOption = Array.from(timezoneEl.options).some((opt) => opt.value === availability.timezone);
    if (!hasOption && availability.timezone) {
      const option = document.createElement("option");
      option.value = availability.timezone;
      option.textContent = availability.timezone;
      timezoneEl.appendChild(option);
    }
    timezoneEl.value = availability.timezone;
  }
  if (bufferEl) bufferEl.value = String(availability.bufferMinutes);
}

function renderWeeklyTable(weekly) {
  const body = document.getElementById("availability-weekly-body");
  if (!body) return;

  body.innerHTML = DAY_ORDER.map((day) => {
    const row = weekly[day];
    const disabled = row.enabled ? "" : "disabled";
    const dayLabel = escapeHtml(DAY_LABELS[day]);
    return `
      <tr>
        <td class="availability-day-cell">${dayLabel}</td>
        <td class="availability-enabled-cell">
          <label class="availability-enabled-control">
            <span class="availability-mobile-label">Enabled</span>
            <span class="availability-day-state ${row.enabled ? "availability-day-state-open" : "availability-day-state-closed"}" data-day-state="${day}">${row.enabled ? "Open" : "Closed"}</span>
            <input
              type="checkbox"
              aria-label="${dayLabel} enabled"
              data-day="${day}"
              data-field="enabled"
              ${row.enabled ? "checked" : ""}
            />
          </label>
        </td>
        <td class="availability-time-cell">
          <label class="availability-time-control">
            <span class="availability-mobile-label">Start</span>
            <input
              type="time"
              aria-label="${dayLabel} start time"
              data-day="${day}"
              data-field="start"
              value="${escapeHtml(row.start)}"
              ${disabled}
            />
          </label>
        </td>
        <td class="availability-time-cell">
          <label class="availability-time-control">
            <span class="availability-mobile-label">End</span>
            <input
              type="time"
              aria-label="${dayLabel} end time"
              data-day="${day}"
              data-field="end"
              value="${escapeHtml(row.end)}"
              ${disabled}
            />
          </label>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTimeOffList(timeOff) {
  const list = document.getElementById("availability-timeoff-list");
  if (!list) return;

  if (!timeOff.length) {
    list.innerHTML = `
      <section class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">S</span>
        <h3>No time off blocks</h3>
        <p>Add planned time off, a break, or a blocked day to keep unavailable times out of public booking.</p>
      </section>
    `;
    return;
  }

  list.innerHTML = `
    <ul class="availability-timeoff-items">
      ${timeOff.map((block) => `
        <li class="availability-timeoff-item">
          <div>
            <strong>${formatLocalDateTime(block.startISO)}</strong>
            <span class="small"> to </span>
            <strong>${formatLocalDateTime(block.endISO)}</strong>
            ${block.note ? `<p class="small">${escapeHtml(block.note)}</p>` : ""}
          </div>
          <button class="btn btn-danger" type="button" data-action="delete-timeoff" data-id="${escapeHtml(block.id)}">Delete</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function handleWeeklyFieldChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const day = target.dataset.day;
  const field = target.dataset.field;
  if (!day || !field || !DAY_ORDER.includes(day)) return;
  if (field !== "enabled") return;

  const row = target.closest("tr");
  if (!row) return;
  const enabled = target.checked;
  row.querySelectorAll('input[type="time"]').forEach((timeInput) => {
    timeInput.disabled = !enabled;
  });
  const state = row.querySelector("[data-day-state]");
  if (state) {
    state.textContent = enabled ? "Open" : "Closed";
    state.className = `availability-day-state ${enabled ? "availability-day-state-open" : "availability-day-state-closed"}`;
  }
}

async function saveWeeklyAvailability() {
  const availability = loadAvailability();
  const weekly = {};
  const errors = [];

  DAY_ORDER.forEach((day) => {
    const enabledEl = document.querySelector(`input[data-day="${day}"][data-field="enabled"]`);
    const startEl = document.querySelector(`input[data-day="${day}"][data-field="start"]`);
    const endEl = document.querySelector(`input[data-day="${day}"][data-field="end"]`);

    const enabled = Boolean(enabledEl?.checked);
    const start = String(startEl?.value ?? "");
    const end = String(endEl?.value ?? "");

    if (enabled) {
      if (!start || !end) {
        errors.push(`${DAY_LABELS[day]} needs both a start and end time.`);
      } else if (start >= end) {
        errors.push(`${DAY_LABELS[day]} needs an end time later than its start time.`);
      }
    }

    weekly[day] = {
      enabled,
      start: normalizeTimeValue(start, "09:00"),
      end: normalizeTimeValue(end, "17:00"),
    };
  });

  const timezoneRaw = String(document.getElementById("availability-timezone")?.value ?? "").trim();
  const bufferRaw = Number(document.getElementById("availability-buffer")?.value ?? "0");
  const timezone = timezoneRaw || "America/Chicago";
  const bufferMinutes = BUFFER_OPTIONS.includes(bufferRaw) ? bufferRaw : 0;

  if (errors.length > 0) {
    showWeeklyError(errors.join("<br />"));
    setWeeklyStatus("", "");
    return;
  }

  availability.timezone = timezone;
  availability.bufferMinutes = bufferMinutes;
  availability.weekly = weekly;
  setWeeklyStatus("Saving availability…", "saving");
  try {
    await saveAvailability(availability);
    clearWeeklyError();
    renderAvailability();
    setWeeklyStatus("Saved. Your weekly hours are ready for new bookings.", "success");
  } catch (error) {
    console.error("[Slotzy:availability] Could not save weekly availability.", error);
    setWeeklyStatus("We couldn’t save your weekly hours. Please try again.", "error");
  }
}

async function addTimeOffBlock() {
  const availability = loadAvailability();
  const startLocal = String(document.getElementById("availability-timeoff-start")?.value ?? "");
  const endLocal = String(document.getElementById("availability-timeoff-end")?.value ?? "");
  const note = String(document.getElementById("availability-timeoff-note")?.value ?? "").trim();

  const errors = [];
  if (!startLocal || !endLocal) {
    errors.push("Start and end datetime are required.");
  }

  const startDate = new Date(startLocal);
  const endDate = new Date(endLocal);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    errors.push("Please provide valid start and end datetime values.");
  } else if (startDate >= endDate) {
    errors.push("Time off start must be before end.");
  } else if (hasTimeOffOverlap(availability.timeOff, startDate, endDate)) {
    errors.push("That time off block overlaps an existing break or time off entry.");
  }

  if (errors.length > 0) {
    showTimeOffError(errors.join("<br />"));
    return;
  }

  addTimeOffEntry(availability, { startDate, endDate, note });
  try {
    await saveAvailability(availability);
    clearTimeOffInputs();
    clearTimeOffError();
    renderAvailability();
  } catch (error) {
    console.error("[Slotzy:availability] Could not save time off.", error);
    showTimeOffError("Could not save changes. Try again.");
  }
}

function renderRecurringBlocks(blocks) {
  const list = document.getElementById("availability-recurring-list");
  if (!list) return;
  if (!blocks.length) {
    list.innerHTML = '<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">S</span><h3>No recurring blocks</h3><p>Add a weekly lunch, break, or unavailable period.</p></section>';
    return;
  }
  list.innerHTML = `<ul class="availability-timeoff-items">${blocks.map((block) => `
    <li class="availability-timeoff-item">
      <div><strong>${escapeHtml(DAY_LABELS[block.weekday])}: ${escapeHtml(formatTimeLabel(block.start))}–${escapeHtml(formatTimeLabel(block.end))}</strong><p class="small">${escapeHtml(block.label)}</p></div>
      <button class="btn btn-danger" type="button" data-action="delete-recurring" data-id="${escapeHtml(block.id)}">Delete</button>
    </li>`).join("")}</ul>`;
}

async function addRecurringBlocks() {
  const availability = loadAvailability();
  const days = Array.from(document.querySelectorAll('input[name="availability-recurring-day"]:checked'))
    .map((input) => String(input.value ?? "")).filter((day) => DAY_ORDER.includes(day));
  const start = String(document.getElementById("availability-recurring-start")?.value ?? "").trim();
  const end = String(document.getElementById("availability-recurring-end")?.value ?? "").trim();
  const label = String(document.getElementById("availability-recurring-label")?.value ?? "").trim() || "Unavailable";
  const errors = [];
  if (!days.length) errors.push("Select at least one weekday.");
  if (!start) errors.push("Start time is required.");
  if (!end) errors.push("End time is required.");
  if (start && end && start >= end) errors.push("End time must be later than start time.");
  if (errors.length) {
    showRecurringError(errors.join("<br />"));
    return;
  }
  const additions = days.map((weekday) => ({
    id: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : fallbackUuid(),
    weekday, start, end, label: label.slice(0, 80), enabled: true,
  }));
  availability.recurringBlocks = [...availability.recurringBlocks, ...additions];
  try {
    await saveAvailability(availability);
    document.querySelectorAll('input[name="availability-recurring-day"]:checked').forEach((input) => { input.checked = false; });
    renderAvailability();
    window.showToast?.("Recurring block saved.", "success");
  } catch (error) {
    console.error("[Slotzy:availability] Could not save recurring block.", String(error?.message ?? "save_failed"));
    showRecurringError("Could not save recurring block. Please try again.");
  }
}

async function handleRecurringListClick(event) {
  const target = event.target?.closest?.('button[data-action="delete-recurring"]');
  if (!target) return;
  const id = String(target.getAttribute("data-id") ?? "");
  const availability = loadAvailability();
  if (!availability.recurringBlocks.some((block) => block.id === id)) return;
  availability.recurringBlocks = availability.recurringBlocks.filter((block) => block.id !== id);
  target.disabled = true;
  try {
    await saveAvailability(availability);
    renderAvailability();
  } catch (error) {
    target.disabled = false;
    console.error("[Slotzy:availability] Could not delete recurring block.", String(error?.message ?? "delete_failed"));
    showRecurringError("Could not delete that recurring block. It is still unavailable. Please try again.");
  }
}

function normalizeRecurringBlock(block) {
  const weekday = String(block?.weekday ?? "").trim().toLowerCase();
  const start = normalizeTimeValue(block?.start, "");
  const end = normalizeTimeValue(block?.end, "");
  if (!DAY_ORDER.includes(weekday) || !start || !end || start >= end) return null;
  return { id: String(block?.id ?? fallbackUuid()), weekday, start, end, label: String(block?.label ?? "Unavailable").trim() || "Unavailable", enabled: block?.enabled !== false };
}

function fallbackUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function formatTimeLabel(value) {
  const [hourText, minuteText] = String(value).split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minuteText} ${suffix}`;
}

async function handleAddCustomBreak() {
  const dateValue = String(document.getElementById("availability-quick-date")?.value ?? "").trim();
  const startTime = String(document.getElementById("availability-custom-break-start")?.value ?? "").trim();
  const endTime = String(document.getElementById("availability-custom-break-end")?.value ?? "").trim();

  if (!dateValue) {
    showTimeOffError("Choose a date before adding a custom break.");
    return;
  }
  if (!startTime || !endTime) {
    showTimeOffError("Choose both a custom break start and end time.");
    return;
  }

  await addQuickBreakBlock({
    dateValue,
    startTime,
    endTime,
    note: "Custom break",
  });
}

async function handleBlockOffDay() {
  const availability = loadAvailability();
  const dayWindow = getSelectedDayBlockWindow(availability);
  if (!dayWindow) return;

  if (hasTimeOffOverlap(availability.timeOff, dayWindow.startDate, dayWindow.endDate)) {
    showTimeOffError("That day block overlaps an existing break or time off entry.");
    return;
  }

  addTimeOffEntry(availability, {
    startDate: dayWindow.startDate,
    endDate: dayWindow.endDate,
    note: "Blocked day",
  });

  try {
    await saveAvailability(availability);
  } catch (error) {
    console.error("[Slotzy:availability] Could not block day.", error);
    showTimeOffError("Could not save changes. Try again.");
    return;
  }

  const startInput = document.getElementById("availability-timeoff-start");
  const endInput = document.getElementById("availability-timeoff-end");
  const noteInput = document.getElementById("availability-timeoff-note");
  if (startInput) startInput.value = toLocalDateTimeInputValue(dayWindow.startDate);
  if (endInput) endInput.value = toLocalDateTimeInputValue(dayWindow.endDate);
  if (noteInput) noteInput.value = "Blocked day";

  clearTimeOffError();
  renderAvailability();
  window.showToast?.("Day blocked off.", "success");
}

async function handleClearDayBlocks() {
  const availability = loadAvailability();
  const selectedDate = getQuickDateValue();
  if (!selectedDate) {
    showTimeOffError("Choose a date before clearing day blocks.");
    return;
  }

  const nextTimeOff = availability.timeOff.filter((block) => !isBlockOffDayEntry(block, selectedDate));
  const removedCount = availability.timeOff.length - nextTimeOff.length;
  if (removedCount === 0) {
    showTimeOffError("No blocked day entries were found for that date.");
    return;
  }

  availability.timeOff = nextTimeOff;
  try {
    await saveAvailability(availability);
  } catch (error) {
    console.error("[Slotzy:availability] Could not clear day blocks.", error);
    showTimeOffError("Could not save changes. Try again.");
    return;
  }
  clearTimeOffError();
  renderAvailability();
  window.showToast?.(`Cleared ${removedCount} day block${removedCount === 1 ? "" : "s"}.`, "success");
}

async function addQuickBreakBlock({ dateValue, startTime, endTime, note }) {
  const availability = loadAvailability();
  const selectedDate = String(dateValue ?? getQuickDateValue()).trim();

  if (!selectedDate) {
    showTimeOffError("Choose a date before adding a quick break.");
    return;
  }

  const startDate = new Date(`${selectedDate}T${String(startTime ?? "").trim()}`);
  const endDate = new Date(`${selectedDate}T${String(endTime ?? "").trim()}`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    showTimeOffError("Could not create that break. Check the date and times.");
    return;
  }
  if (startDate >= endDate) {
    showTimeOffError("Break start must be before break end.");
    return;
  }
  if (hasTimeOffOverlap(availability.timeOff, startDate, endDate)) {
    showTimeOffError("That break overlaps an existing break or time off entry.");
    return;
  }

  addTimeOffEntry(availability, {
    startDate,
    endDate,
    note: String(note ?? "").trim(),
  });

  try {
    await saveAvailability(availability);
  } catch (error) {
    console.error("[Slotzy:availability] Could not save break.", error);
    showTimeOffError("Could not save changes. Try again.");
    return;
  }

  const startInput = document.getElementById("availability-timeoff-start");
  const endInput = document.getElementById("availability-timeoff-end");
  const noteInput = document.getElementById("availability-timeoff-note");
  if (startInput) startInput.value = toLocalDateTimeInputValue(startDate);
  if (endInput) endInput.value = toLocalDateTimeInputValue(endDate);
  if (noteInput) noteInput.value = String(note ?? "").trim();

  clearTimeOffError();
  renderAvailability();
  window.showToast?.(`${note || "Break"} added.`, "success");
}

function addTimeOffEntry(availability, { startDate, endDate, note }) {
  availability.timeOff.push({
    id: `to_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    note: String(note ?? "").trim(),
  });
  availability.timeOff.sort((a, b) => a.startISO.localeCompare(b.startISO));
}

function getQuickDateValue() {
  return String(document.getElementById("availability-quick-date")?.value ?? "").trim();
}

function getSelectedDayBlockWindow(availability) {
  const selectedDate = getQuickDateValue();
  if (!selectedDate) {
    showTimeOffError("Choose a date before blocking off a day.");
    return null;
  }

  const dayDate = new Date(`${selectedDate}T00:00`);
  if (Number.isNaN(dayDate.getTime())) {
    showTimeOffError("Choose a valid date before blocking off a day.");
    return null;
  }

  const dayKey = DAY_ORDER[(dayDate.getDay() + 6) % 7];
  const daySchedule = availability?.weekly?.[dayKey];
  let startTime = "00:00";
  let endTime = "23:59";

  if (daySchedule?.enabled) {
    startTime = normalizeTimeValue(daySchedule.start, "09:00");
    endTime = normalizeTimeValue(daySchedule.end, "17:00");
  }

  const startDate = new Date(`${selectedDate}T${startTime}`);
  const endDate = new Date(`${selectedDate}T${endTime}`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    showTimeOffError("Could not create a day block from the selected schedule.");
    return null;
  }

  return { selectedDate, startDate, endDate };
}

function isBlockOffDayEntry(block, selectedDate) {
  const note = String(block?.note ?? "").trim().toLowerCase();
  if (note !== "blocked day") return false;
  const start = new Date(String(block?.startISO ?? ""));
  if (Number.isNaN(start.getTime())) return false;
  return toLocalDateInputValue(start) === selectedDate;
}

function hasTimeOffOverlap(timeOff, startDate, endDate) {
  if (!Array.isArray(timeOff)) return false;
  return timeOff.some((block) => {
    const start = new Date(String(block?.startISO ?? ""));
    const end = new Date(String(block?.endISO ?? ""));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return startDate < end && endDate > start;
  });
}

async function handleTimeOffListClick(event) {
  const eventTarget = event.target;
  if (!(eventTarget instanceof Element)) return;
  const target = eventTarget.closest('[data-action="delete-timeoff"]');
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.getAttribute("data-action");
  if (action !== "delete-timeoff") return;

  const id = String(target.getAttribute("data-id") ?? "");
  if (!id) return;

  const availability = loadAvailability();
  const block = availability.timeOff.find((item) => item.id === id);
  if (!block) return;

  const confirmed = window.confirm(`Delete this ${block.note || "time off"} block? Those times may become bookable again.`);
  if (!confirmed) return;

  availability.timeOff = availability.timeOff.filter((item) => item.id !== id);
  target.disabled = true;
  target.textContent = "Deleting…";
  clearTimeOffError();
  try {
    await saveAvailability(availability);
  } catch (error) {
    console.error("[Slotzy:availability] Could not delete time off.", error);
    target.disabled = false;
    target.textContent = "Delete";
    showTimeOffError("Could not delete that block. It is still unavailable. Please try again.");
    return;
  }
  renderAvailability();
}

function clearTimeOffInputs() {
  const start = document.getElementById("availability-timeoff-start");
  const end = document.getElementById("availability-timeoff-end");
  const note = document.getElementById("availability-timeoff-note");
  if (start) start.value = "";
  if (end) end.value = "";
  if (note) note.value = "";
}

function toLocalDateTimeInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  return local.toISOString().slice(0, 16);
}

function toLocalDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  return local.toISOString().slice(0, 10);
}

function showWeeklyError(messageHtml) {
  const el = document.getElementById("availability-weekly-error");
  if (!el) return;
  el.innerHTML = messageHtml;
  el.classList.remove("hidden");
}

function setWeeklyStatus(message, type) {
  const el = document.getElementById("availability-weekly-status");
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.className = "availability-save-status hidden";
    return;
  }
  el.textContent = message;
  el.className = `availability-save-status availability-save-status-${type}`;
}

function clearWeeklyError() {
  const el = document.getElementById("availability-weekly-error");
  if (!el) return;
  el.innerHTML = "";
  el.classList.add("hidden");
}

function showTimeOffError(messageHtml) {
  const el = document.getElementById("availability-timeoff-error");
  if (!el) return;
  el.innerHTML = messageHtml;
  el.classList.remove("hidden");
}

function clearTimeOffError() {
  const el = document.getElementById("availability-timeoff-error");
  if (!el) return;
  el.innerHTML = "";
  el.classList.add("hidden");
}

function showRecurringError(messageHtml) {
  const el = document.getElementById("availability-recurring-error");
  if (!el) return;
  el.innerHTML = messageHtml;
  el.classList.remove("hidden");
}

function clearRecurringError() {
  const el = document.getElementById("availability-recurring-error");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function normalizeTimeOffBlock(block) {
  const startISO = String(block?.startISO ?? "");
  const endISO = String(block?.endISO ?? "");
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;
  return {
    id: String(block?.id ?? `to_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    note: String(block?.note ?? "").trim(),
  };
}

function normalizeTimeValue(value, fallback) {
  const val = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  return fallback;
}

function formatLocalDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
