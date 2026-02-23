import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { readDb, writeDb } from "./db.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(express.json());
app.use(cors({ origin: true }));

function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

function buildAuthUser(user) {
  return {
    username: user.username,
    role: user.role,
  };
}

function signToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization ?? "");
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const role = normalizeRole(req.body?.role);

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }
    if (role !== "owner" && role !== "customer") {
      return res.status(400).json({ error: "role must be owner or customer" });
    }

    const db = await readDb();
    const exists = db.users.some(
      (user) => String(user.username ?? "").toLowerCase() === username.toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ error: "username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: randomUUID(),
      username,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    await writeDb(db);

    const token = signToken(user);
    return res.status(201).json({ token, user: buildAuthUser(user) });
  } catch (error) {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const db = await readDb();
    const user = db.users.find(
      (item) => String(item.username ?? "").toLowerCase() === username.toLowerCase()
    );
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, String(user.passwordHash ?? ""));
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = signToken(user);
    return res.json({ token, user: buildAuthUser(user) });
  } catch (error) {
    return res.status(500).json({ error: "internal server error" });
  }
});

app.get("/api/auth/me", (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "missing bearer token" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({
      user: {
        username: String(payload.username ?? ""),
        role: String(payload.role ?? ""),
      },
    });
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`);
});
