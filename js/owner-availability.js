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

  return { timezone, bufferMinutes, weekly, timeOff };
}

function saveAvailability(availability) {
  dataStore.saveAvailabilityForBarber(currentBarberUsername, availability);
}

function renderAvailability() {
  const availability = loadAvailability();
  renderWeeklyTable(availability.weekly);
  renderAvailabilityMeta(availability);
  renderQuickBreakDate();
  renderTimeOffList(availability.timeOff);
  clearWeeklyError();
  clearTimeOffError();
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
    return `
      <tr>
        <td>${escapeHtml(DAY_LABELS[day])}</td>
        <td>
          <input
            type="checkbox"
            data-day="${day}"
            data-field="enabled"
            ${row.enabled ? "checked" : ""}
          />
        </td>
        <td>
          <input
            type="time"
            data-day="${day}"
            data-field="start"
            value="${escapeHtml(row.start)}"
            ${disabled}
          />
        </td>
        <td>
          <input
            type="time"
            data-day="${day}"
            data-field="end"
            value="${escapeHtml(row.end)}"
            ${disabled}
          />
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
        <p>Add planned time off to prevent slot generation.</p>
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
}

function saveWeeklyAvailability() {
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
        errors.push(`${DAY_LABELS[day]} requires both start and end times.`);
      } else if (start >= end) {
        errors.push(`${DAY_LABELS[day]} start must be before end.`);
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
    return;
  }

  availability.timezone = timezone;
  availability.bufferMinutes = bufferMinutes;
  availability.weekly = weekly;
  saveAvailability(availability);
  clearWeeklyError();
  renderAvailability();
}

function addTimeOffBlock() {
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
  clearTimeOffInputs();
  clearTimeOffError();
  renderAvailability();
}

function handleAddCustomBreak() {
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

  addQuickBreakBlock({
    dateValue,
    startTime,
    endTime,
    note: "Custom break",
  });
}

function handleBlockOffDay() {
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

function handleClearDayBlocks() {
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
  saveAvailability(availability);
  clearTimeOffError();
  renderAvailability();
  window.showToast?.(`Cleared ${removedCount} day block${removedCount === 1 ? "" : "s"}.`, "success");
}

function addQuickBreakBlock({ dateValue, startTime, endTime, note }) {
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
  saveAvailability(availability);
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

function handleTimeOffListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-action");
  if (action !== "delete-timeoff") return;

  const id = String(target.getAttribute("data-id") ?? "");
  if (!id) return;

  const availability = loadAvailability();
  const block = availability.timeOff.find((item) => item.id === id);
  if (!block) return;

  const confirmed = window.confirm("Delete this time off block?");
  if (!confirmed) return;

  availability.timeOff = availability.timeOff.filter((item) => item.id !== id);
  saveAvailability(availability);
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
