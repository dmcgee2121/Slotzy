export function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

export function formatCsvDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatCsvTime(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function buildCsvFilename(prefix, date = new Date()) {
  const datePart = formatCsvDate(date) || "export";
  const safePrefix = String(prefix ?? "").trim() || "export";
  return `slotzy-${safePrefix}-${datePart}.csv`;
}

export function downloadCsvFile({ filename, columns, rows }) {
  const orderedColumns = Array.isArray(columns) ? columns.filter(Boolean) : [];
  const csvRows = Array.isArray(rows) ? rows : [];
  if (!orderedColumns.length || !csvRows.length) return false;

  const lines = [
    orderedColumns.map(escapeCsvValue).join(","),
    ...csvRows.map((row) => orderedColumns.map((column) => escapeCsvValue(row?.[column])).join(",")),
  ];
  const csvText = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = String(filename ?? "export.csv").trim() || "export.csv";
  link.className = "ui-offscreen-control";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  return true;
}
