/* ==========================================================
   ✅ CFC_LOCK_PROXY_V64.0_FIRESTORE_DIRECT_WRITE_FIX
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

/* ==========================================================
   🔹 Inicialización segura Firebase Admin (Service Account)
   ========================================================== */
try {
  const serviceAccount = JSON.parse(
    readFileSync("/etc/secrets/firebase-key.json", "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("🟢 Firebase Admin inicializado (Service Account)");
} catch (err) {
  console.error("❌ Error al inicializar Firebase Admin:", err);
}

const db = admin.firestore();

/* ==========================================================
   🧠 Estado local de sesiones (email → device_id)
   ========================================================== */
const sessions = new Map();

/* ==========================================================
   🔹 /login — Detecta duplicado y actualiza Firestore en modo directo
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;

  if (!email || !device_id) {
    return res.status(400).json({ error: "missing data" });
  }

  const prevDevice = sessions.get(email);

  // 🔥 Si hay duplicado → invalidar anterior
  if (prevDevice && prevDevice !== device_id) {
    console.log(`🚨 Duplicado detectado para ${email}`);

    try {
      const docRef = db.collection("licenses").doc(email);
      await docRef.update({
        active_session: false,
        last_active: new Date(),
        session_force_closed: true,
      });
      console.log(`⚡ Firestore actualizado (active_session=false) para ${email}`);
    } catch (err) {
      console.error("❌ Error directo al escribir Firestore:", err);
    }
  }

  // Registrar nueva sesión
  sessions.set(email, device_id);
  res.json({ status: "ok" });
});

/* ==========================================================
   🔹 /check-session — Validación remota
   ========================================================== */
app.get("/check-session", (req, res) => {
  const { email, device_id } = req.query;
  const current = sessions.get(email);

  if (!current) return res.json({ status: "invalid" });
  if (current !== device_id) {
    console.log(`🚨 Sesión expirada: ${email}`);
    return res.json({ status: "expired" });
  }

  return res.json({ status: "valid" });
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
  console.log(`⚡ CFC Lock Proxy V64 activo en puerto ${PORT}`)
);
