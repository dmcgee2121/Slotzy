const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const HOST = "127.0.0.1";
const LOCAL_E2E_MODE = process.env.SLOTZY_LOCAL_E2E === "1";
const LOCAL_E2E_PUBLIC_CONFIG = `// Generated only by the isolated local E2E server.\nwindow.SLOTZY_CONFIG = Object.freeze({ apiBaseUrl: "http://127.0.0.1:3001/api", forceApiMode: true });\n`;

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
};

function sendFile(res, absolutePath) {
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(absolutePath).pipe(res);
}

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function sendLocalE2ePublicConfig(res) {
  res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
  res.end(LOCAL_E2E_PUBLIC_CONFIG);
}

function resolveRequestPath(requestUrl) {
  const parsed = url.parse(requestUrl || "/");
  const pathname = decodeURIComponent(parsed.pathname || "/");
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = path.resolve(ROOT, `.${normalized}`);

  if (!absolutePath.startsWith(ROOT)) return null;
  return absolutePath;
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url || "/").pathname;
  // Keep the checked-in hosted configuration intact. This response exists only
  // in the dedicated loopback E2E process.
  if (LOCAL_E2E_MODE && pathname === "/js/public-config.js") {
    sendLocalE2ePublicConfig(res);
    return;
  }
  const filePath = resolveRequestPath(req.url);
  if (!filePath) {
    sendNotFound(res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    if (!err && stats.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          sendFile(res, indexPath);
          return;
        }
        sendNotFound(res);
      });
      return;
    }

    sendNotFound(res);
  });
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Try closing the other server or run: node scripts/serve.cjs 5174`);
    process.exit(1);
  }

  console.error("Failed to start Slotzy dev server.");
  console.error(error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("Slotzy dev server is running.");
  console.log(`Open: http://${HOST}:${PORT}`);
  if (LOCAL_E2E_MODE) console.log("Local E2E API isolation is active.");
  console.log(`Serving: ${ROOT}`);
  console.log("Press Ctrl+C to stop.");
});
