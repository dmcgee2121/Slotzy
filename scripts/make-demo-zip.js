#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_ZIP_NAME = "Slotzy-Demo.zip";
const OUTPUT_ZIP_PATH = path.join(ROOT_DIR, OUTPUT_ZIP_NAME);
const STAGING_DIR = path.join(ROOT_DIR, ".demo-zip-staging");

const INCLUDE_PATHS = [
  "index.html",
  "pages",
  "js",
  "css",
  "assets",
  path.join("server", "src"),
  path.join("server", "package.json"),
  path.join("server", "package-lock.json"),
];

const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "test-results",
  "playwright-report",
]);

const TEMP_FILE_PATTERNS = [
  /\.tmp$/i,
  /\.temp$/i,
  /\.swp$/i,
  /\.swo$/i,
  /~$/,
];

function ensurePathExists(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Required path is missing: ${relativePath}`);
  }
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function shouldExcludeRelative(relativePath) {
  const normalized = toPosix(relativePath);
  const baseName = path.basename(relativePath);

  if (!normalized || normalized === ".") return false;
  if (baseName.endsWith(".zip")) return true;
  if (TEMP_FILE_PATTERNS.some((pattern) => pattern.test(baseName))) return true;

  const segments = normalized.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_DIR_NAMES.has(segment));
}

function cleanDir(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyRecursive(sourceAbsolute, targetAbsolute, sourceRelativeToRoot) {
  if (shouldExcludeRelative(sourceRelativeToRoot)) return;

  const stats = fs.statSync(sourceAbsolute);
  if (stats.isDirectory()) {
    fs.mkdirSync(targetAbsolute, { recursive: true });
    const entries = fs.readdirSync(sourceAbsolute);
    for (const entryName of entries) {
      const childSourceAbsolute = path.join(sourceAbsolute, entryName);
      const childTargetAbsolute = path.join(targetAbsolute, entryName);
      const childRelative = path.join(sourceRelativeToRoot, entryName);
      copyRecursive(childSourceAbsolute, childTargetAbsolute, childRelative);
    }
    return;
  }

  ensureParentDir(targetAbsolute);
  fs.copyFileSync(sourceAbsolute, targetAbsolute);
}

function stageFiles() {
  cleanDir(STAGING_DIR);
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  for (const includePath of INCLUDE_PATHS) {
    ensurePathExists(includePath);
    const sourceAbsolute = path.join(ROOT_DIR, includePath);
    const targetAbsolute = path.join(STAGING_DIR, includePath);
    copyRecursive(sourceAbsolute, targetAbsolute, includePath);
  }
}

function psQuote(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function buildZipFromStaging() {
  cleanDir(OUTPUT_ZIP_PATH);

  if (process.platform === "win32") {
    const stagingWildcard = path.join(STAGING_DIR, "*");
    const command = [
      "Compress-Archive",
      "-Path", psQuote(stagingWildcard),
      "-DestinationPath", psQuote(OUTPUT_ZIP_PATH),
      "-CompressionLevel", "Optimal",
      "-Force",
    ].join(" ");
    execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", command], {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
    return;
  }

  try {
    execFileSync("zip", ["-r", "-q", OUTPUT_ZIP_PATH, "."], {
      cwd: STAGING_DIR,
      stdio: "inherit",
    });
    return;
  } catch {
    execFileSync("tar", ["-a", "-c", "-f", OUTPUT_ZIP_PATH, "-C", STAGING_DIR, "."], {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
  }
}

function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function main() {
  for (const includePath of INCLUDE_PATHS) {
    ensurePathExists(includePath);
  }

  stageFiles();
  buildZipFromStaging();

  const zipStats = fs.statSync(OUTPUT_ZIP_PATH);
  cleanDir(STAGING_DIR);

  console.log(`Created ${OUTPUT_ZIP_NAME}`);
  console.log(`Output: ${OUTPUT_ZIP_PATH}`);
  console.log(`Size: ${formatSize(zipStats.size)} (${zipStats.size} bytes)`);
}

try {
  main();
} catch (error) {
  cleanDir(STAGING_DIR);
  console.error(`Failed to create ${OUTPUT_ZIP_NAME}`);
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
