// ✅ CFC_LOCK_PROXY_SERVER_V59.0_RENDER_UNIQUE_SESSION_FINAL
// Backend: Node + Express + Firebase
// Función: Sesión única cross-device (expulsa anteriores)
// QA-SYNC — 2025-11-12

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { readFileSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Inicializar Firebase Admin SDK
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
   🔹 Endpoint: registrar login y forzar sesión única
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing body" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();

    if (!snap.exists) {
      // Primera vez → crear licencia nueva
      await ref.set({
        email,
        device_id,
        active_session: true,
        last_active: new Date(),
      });
      console.log(`🆕 Nueva licencia creada: ${email}`);
    } else {
      const data = snap.data();

      // Si el dispositivo es diferente, invalida la sesión anterior
      if (data.device_id && data.device_id !== device_id) {
        console.log(`⚠️ Dispositivo cambiado para ${email}. Cerrando anterior.`);
        await ref.update({
          device_id,
          active_session: true,
          last_active: new Date(),
        });
      } else {
        // Mismo dispositivo → refresca timestamp
        await ref.update({
          active_session: true,
          last_active: new Date(),
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("⚠️ Error en /login:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🔹 Endpoint: verificar sesión
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
    const valid = data.device_id === device_id && data.active_session;

    res.json({ status: valid ? "valid" : "invalid" });
  } catch (err) {
    console.error("⚠️ Error en /check-session:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   💓 Endpoint: heartbeat (mantiene viva la sesión)
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

    // Si cambió el device_id → sesión expirada
    if (data.device_id !== device_id) {
      console.log(`🚨 Sesión expirada para ${email} (${device_id})`);
      return res.json({ status: "expired" });
    }

    await ref.update({
      last_active: new Date(),
      active_session: true,
    });

    res.json({ ok: true, status: "valid" });
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
  console.log(`⚡ CFC Lock Proxy activo en puerto ${PORT}`)
);
