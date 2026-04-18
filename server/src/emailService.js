import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { readDb, writeDb } from "./db.js";

let transportPromise = null;

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => normalizeString(tag))
    .filter(Boolean);
}

function normalizeMeta(meta) {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? { ...meta }
    : {};
}

function isSmtpConfigured() {
  const host = normalizeString(process.env.SMTP_HOST);
  const user = normalizeString(process.env.SMTP_USER);
  const pass = normalizeString(process.env.SMTP_PASS);
  const from = normalizeString(process.env.SMTP_FROM);
  const port = Number(process.env.SMTP_PORT ?? 0);

  return Boolean(host && user && pass && from && Number.isFinite(port) && port > 0);
}

function getTransportOptions() {
  const host = normalizeString(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT ?? 0);
  const user = normalizeString(process.env.SMTP_USER);
  const pass = normalizeString(process.env.SMTP_PASS);

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  };
}

async function getTransport() {
  if (!transportPromise) {
    transportPromise = Promise.resolve().then(() => nodemailer.createTransport(getTransportOptions()));
  }
  return transportPromise;
}

function buildEmailRecord(payload) {
  const createdAtISO = new Date().toISOString();
  return {
    id: randomUUID(),
    createdAtISO,
    to: normalizeString(payload?.to),
    subject: normalizeString(payload?.subject),
    html: String(payload?.html ?? ""),
    text: String(payload?.text ?? ""),
    tags: normalizeTags(payload?.tags),
    meta: normalizeMeta(payload?.meta),
  };
}

async function saveToOutbox(payload) {
  const db = await readDb();
  const email = buildEmailRecord(payload);
  db.emails.push(email);
  await writeDb(db);
  return email;
}

export function getEmailMode() {
  return isSmtpConfigured() ? "smtp" : "outbox";
}

export async function sendEmail({ to, subject, html, text, tags = [], meta = {} } = {}) {
  const payload = {
    to: normalizeString(to),
    subject: normalizeString(subject),
    html: String(html ?? ""),
    text: String(text ?? ""),
    tags: normalizeTags(tags),
    meta: normalizeMeta(meta),
  };

  if (!payload.to || !payload.subject) {
    throw new Error("Email requires both to and subject.");
  }

  if (getEmailMode() !== "smtp") {
    const email = await saveToOutbox(payload);
    return {
      mode: "outbox",
      email,
    };
  }

  const transport = await getTransport();
  const from = normalizeString(process.env.SMTP_FROM);
  const info = await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html || undefined,
    text: payload.text || undefined,
  });

  return {
    mode: "smtp",
    messageId: normalizeString(info?.messageId),
    accepted: Array.isArray(info?.accepted) ? info.accepted : [],
    rejected: Array.isArray(info?.rejected) ? info.rejected : [],
  };
}

export async function getRecentEmails(limit = 50) {
  const db = await readDb();
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 50;
  return [...db.emails]
    .sort((left, right) => String(right?.createdAtISO ?? "").localeCompare(String(left?.createdAtISO ?? "")))
    .slice(0, safeLimit);
}

export async function clearEmails() {
  const db = await readDb();
  const cleared = Array.isArray(db.emails) ? db.emails.length : 0;
  db.emails = [];
  await writeDb(db);
  return { cleared };
}
