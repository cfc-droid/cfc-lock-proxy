// ==========================================================
// ✅ CFC_LOCK_PROXY_SERVER_V57.5_RENDER_READY
// Backend Node.js + Express + Firebase
// Función: Maneja sesiones únicas + heartbeats del Campus CFC
// Auditoría QA-SYNC — 2025-11-12
// ==========================================================

import express from "express";
import cors from "cors";
import admin from "firebase-admin";

// ==========================================================
// 🔹 Inicialización de Express
// ==========================================================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================================================
// 🔹 Inicialización de Firebase Admin
// ==========================================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// ==========================================================
// 🔍 Endpoint principal — Verifica si el dispositivo sigue válido
// ==========================================================
app.get("/check-session", async (req, res) => {
  try {
    const { email, device_id } = req.query;
    if (!email || !device_id)
      return res.status(400).json({ error: "Missing params" });

    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ status: "invalid" });

    const data = snap.data();
    const status = data.device_id === device_id ? "valid" : "invalid";
    res.json({ status });
  } catch (err) {
    console.error("❌ Error en /check-session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================================
// 💓 Endpoint secundario — Registra heartbeats
// ==========================================================
app.post("/heartbeat", async (req, res) => {
  try {
    const { email, device_id } = req.body;
    if (!email || !device_id)
      return res.status(400).json({ error: "Missing body" });

    const ref = db.collection("licenses").doc(email);
    await ref.set(
      {
        device_id,
        last_active: new Date(),
        active: true,
      },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error en /heartbeat:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================================
// 🩺 Healthcheck (Render usa esto para monitorear el servicio)
// ==========================================================
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// ==========================================================
// 🚀 Iniciar servidor
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ CFC Lock Proxy activo en puerto ${PORT}`)
);
