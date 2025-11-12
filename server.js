// ✅ CFC_LOCK_PROXY_SERVER_V60.0_RENDER_FORCE_SINGLE_SESSION
// Backend: Node + Express + Firebase
// Función: Control real de sesión única cross-device
// QA-SYNC — 2025-11-12

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { readFileSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Inicializar Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync("/etc/secrets/firebase-key.json", "utf8")
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("🟢 Firebase Admin inicializado (Render Secure Mode)");
} catch (err) {
  console.error("❌ Error al inicializar Firebase Admin:", err);
}

const db = admin.firestore();

/* ==========================================================
   🔹 /login — registra nuevo dispositivo y desactiva el anterior
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing body" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();

    if (!snap.exists) {
      // Primer inicio
      await ref.set({
        email,
        device_id,
        active_session: true,
        last_active: new Date(),
      });
      console.log(`🆕 Nueva sesión creada para ${email}`);
      return res.json({ ok: true });
    }

    const data = snap.data();

    // Si es el mismo dispositivo, solo refrescar
    if (data.device_id === device_id) {
      await ref.update({
        active_session: true,
        last_active: new Date(),
      });
      console.log(`♻️ Sesión renovada (${device_id})`);
      return res.json({ ok: true });
    }

    // Si es otro dispositivo, reemplazar y marcar cambio
    await ref.update({
      device_id,
      active_session: true,
      session_changed_at: new Date(),
    });

    console.log(`⚠️ Nuevo dispositivo detectado para ${email}. Anterior cerrado.`);
    return res.json({ ok: true, replaced: true });
  } catch (err) {
    console.error("⚠️ Error en /login:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🔹 /check-session — valida si la sesión sigue activa
   ========================================================== */
app.get("/check-session", async (req, res) => {
  const { email, device_id } = req.query;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing params" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();
    if (!snap.exists)
      return res.json({ status: "invalid", reason: "no license" });

    const data = snap.data();

    // Verificar si coincide el device_id
    if (data.device_id === device_id && data.active_session) {
      return res.json({ status: "valid" });
    } else {
      console.log(`🚨 Sesión inválida detectada (${email})`);
      return res.json({ status: "invalid" });
    }
  } catch (err) {
    console.error("⚠️ Error en /check-session:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   💓 /heartbeat — detecta expiración remota y responde “expired”
   ========================================================== */
app.post("/heartbeat", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing body" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();

    if (!snap.exists) return res.json({ status: "invalid" });

    const data = snap.data();

    if (data.device_id !== device_id) {
      console.log(`🚨 Sesión expirada: ${email} (${device_id})`);
      return res.json({ status: "expired" });
    }

    await ref.update({
      last_active: new Date(),
      active_session: true,
    });

    res.json({ status: "valid" });
  } catch (err) {
    console.error("⚠️ Error en /heartbeat:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🔄 Servidor Render
   ========================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`⚡ CFC Lock Proxy V60 activo en puerto ${PORT}`)
);
