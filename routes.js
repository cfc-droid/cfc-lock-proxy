// ======================================================
// CFC_ROUTES_V90 — Ultra Clean
// ======================================================

import express from "express";
import {
  sessionStore,
  createSession,
  getSession,
  forceCloseSession,
  validateExpiration,
  touchSession
} from "./session-store.js";

import {
  validateEmail,
  validateDevice,
  requireBody
} from "./validators.js";

export const router = express.Router();

// ----------------------------------------
// POST /login
// ----------------------------------------
router.post("/login", async (req, res) => {
  if (requireBody(req, res, ["email", "device_id"])) return;

  const { email, device_id } = req.body;

  if (!validateEmail(email)) return res.status(400).json({ error: "invalid email" });
  if (!validateDevice(device_id)) return res.status(400).json({ error: "invalid device" });

  const prev = getSession(email);

  // Si existe una sesión previa y es otro dispositivo → forzar cierre
  if (prev && prev.device_id !== device_id) {
    forceCloseSession(email);
  }

  createSession(email, device_id);

  console.log(`🔐 LOGIN OK — ${email} (${device_id})`);

  return res.json({ status: "ok" });
});

// ----------------------------------------
// GET /check-session
// ----------------------------------------
router.get("/check-session", (req, res) => {
  const { email, device_id } = req.query;

  if (!email || !device_id)
    return res.status(400).json({ error: "missing params" });

  const s = getSession(email);
  if (!s) return res.json({ status: "invalid" });

  const state = validateExpiration(s);

  if (state === "expired") return res.json({ status: "expired" });
  if (state === "force_close") return res.json({ status: "force_close" });
  if (s.device_id !== device_id) return res.json({ status: "transferred" });

  touchSession(email);

  return res.json({ status: "valid" });
});

// ----------------------------------------
// POST /logout
// ----------------------------------------
router.post("/logout", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "missing email" });

  sessionStore.delete(email);
  return res.json({ status: "closed" });
});

// ----------------------------------------
// GET /heartbeat
// ----------------------------------------
router.get("/heartbeat", (req, res) => {
  const { email } = req.query;
  if (email) touchSession(email);
  return res.json({ alive: true });
});
