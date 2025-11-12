/* ==========================================================
   ✅ CFC_LOCK_PROXY_V63.0_FIRESTORE_CREDENTIAL_FIX
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
   🔹 Inicialización segura Firebase Admin (con credenciales locales)
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
   🧠 Estado de sesiones en memoria
   ========================================================== */
const sessions = new Map();

/* ==========================================================
   🔹 /login — Registrar y cerrar duplicados
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  const prevDevice = sessions.get(email);

  if (prevDevice && prevDevice !== device_id) {
    console.log(`🚨 Duplicado detectado para ${email}`);

    try {
      await db.collection("licenses").doc(email).set(
        {
          active_session: false,
          last_active: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`⚡ Firestore actualizado (active_session=false) para ${email}`);
    } catch (err) {
      console.error("❌ Error al actualizar Firestore:", err);
    }
  }

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
  console.log(`⚡ CFC Lock Proxy V63 activo en puerto ${PORT}`)
);
