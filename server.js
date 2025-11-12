/* ==========================================================
   ✅ CFC_LOCK_PROXY_V66.0_FIRESTORE_ENV_FIX
   Sistema: Campus CFC LITE V41-DEMO
   ========================================================== */

import express from "express";
import admin from "firebase-admin";
import cors from "cors";
import { readFileSync } from "fs";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;
const PROJECT_ID = process.env.PROJECT_ID || "cfc-lock-firebase";

/* ==========================================================
   🔹 Inicialización segura Firebase Admin
   ========================================================== */
let db;
try {
  const serviceAccount = JSON.parse(
    readFileSync("/etc/secrets/firebase-key.json", "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  });

  db = admin.firestore();
  console.log("🟢 Firebase Admin inicializado correctamente (Render ENV)");
} catch (err) {
  console.error("❌ Error al inicializar Firebase Admin:", err);
}

/* ==========================================================
   🧠 Estado de sesiones locales
   ========================================================== */
const sessions = new Map();

/* ==========================================================
   🔹 /login — Detectar duplicados y forzar cierre anterior
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing data" });

  const prevDevice = sessions.get(email);

  if (prevDevice && prevDevice !== device_id) {
    console.log(`🚨 Duplicado detectado para ${email}`);

    try {
      await db.collection("licenses").doc(email).set(
        {
          active_session: false,
          session_force_closed: true,
          last_active: new Date(),
        },
        { merge: true }
      );
      console.log(`⚡ Firestore actualizado correctamente para ${email}`);
    } catch (err) {
      console.error("❌ Error al actualizar Firestore:", err);
    }
  }

  sessions.set(email, device_id);
  res.json({ status: "ok" });
});

/* ==========================================================
   🔹 /check-session — Validar sesión
   ========================================================== */
app.get("/check-session", async (req, res) => {
  const { email, device_id } = req.query;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing params" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ status: "invalid" });

    const data = snap.data();

    if (data.session_force_closed === true) {
      console.log(`🚨 Sesión forzada cerrada (${email})`);
      return res.json({ status: "expired" });
    }

    if (data.device_id && data.device_id !== device_id) {
      return res.json({ status: "expired" });
    }

    return res.json({ status: "valid" });
  } catch (err) {
    console.error("⚠️ Error en /check-session:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   💓 /heartbeat — Mantener activa
   ========================================================== */
app.post("/heartbeat", (req, res) => {
  const { email, device_id } = req.body;
  const current = sessions.get(email);

  if (!current || current !== device_id) {
    console.log(`🚨 Heartbeat duplicado: ${email}`);
    return res.json({ status: "expired" });
  }

  console.log(`♻️ Sesión renovada (${device_id})`);
  return res.json({ status: "ok" });
});

/* ==========================================================
   🚀 Servidor
   ========================================================== */
app.listen(PORT, "0.0.0.0", () =>
  console.log(`⚡ CFC Lock Proxy V66 activo en puerto ${PORT}`)
);
