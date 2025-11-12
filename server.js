// ✅ CFC_LOCK_PROXY_SERVER_V57.6_RENDER_SECURE
// Backend: Node + Express + Firebase
// Función: Manejo de sesiones únicas + heartbeats del Campus CFC
// Auditoría QA-SYNC — 2025-11-12

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { readFileSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Inicializar Firebase Admin SDK (clave desde Secret File)
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

// ✅ Endpoint principal: verificar sesión
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

// ✅ Endpoint secundario: registrar heartbeats
app.post("/heartbeat", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing body" });

  try {
    await db.collection("licenses").doc(email).set(
      {
        device_id,
        last_active: new Date(),
      },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("⚠️ Error en /heartbeat:", err);
    res.status(500).json({ error: "server error" });
  }
});

// 🔄 Servidor Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`⚡ CFC Lock Proxy activo en puerto ${PORT}`)
);
