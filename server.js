/* ==========================================================
   ✅ CFC_LOCK_PROXY_V62.0_BACK2FRONT_FIRESTORE_UPDATE
   Sistema: Campus CFC LITE V41-DEMO
   ========================================================== */

import express from "express";
import admin from "firebase-admin";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;

/* ==========================================================
   🔹 Inicialización segura Firebase Admin
   ========================================================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

console.log("🟢 Firebase Admin inicializado (Render Secure Mode)");

/* ==========================================================
   🧠 Estado de sesiones en memoria
   ========================================================== */
const sessions = new Map(); // email → device_id

/* ==========================================================
   🔹 Login handler
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  const prevDevice = sessions.get(email);

  if (prevDevice && prevDevice !== device_id) {
    console.log(`🚨 Duplicado detectado para ${email}`);

    // 🔥 Cerrar sesión anterior en Firestore
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

  // Registrar nueva sesión
  sessions.set(email, device_id);
  res.json({ status: "ok" });
});

/* ==========================================================
   🔹 Check session
   ========================================================== */
app.get("/check-session", (req, res) => {
  const { email, device_id } = req.query;
  const current = sessions.get(email);

  if (!current) return res.json({ status: "invalid", reason: "not_logged_in" });
  if (current !== device_id) {
    console.log(`🚨 Sesión expirada: ${email}`);
    return res.json({ status: "expired" });
  }

  return res.json({ status: "valid" });
});

/* ==========================================================
   💓 Heartbeat
   ========================================================== */
app.post("/heartbeat", (req, res) => {
  const { email, device_id } = req.body;
  const current = sessions.get(email);

  if (!current) {
    console.log(`⚠️ Heartbeat sin sesión activa: ${email}`);
    return res.json({ status: "expired" });
  }

  if (current !== device_id) {
    console.log(`🚨 Heartbeat detectó duplicado: ${email}`);
    return res.json({ status: "expired" });
  }

  sessions.set(email, device_id);
  console.log(`♻️ Sesión renovada (${device_id})`);
  return res.json({ status: "ok" });
});

/* ==========================================================
   🚀 Servidor
   ========================================================== */
app.listen(PORT, () => {
  console.log(`⚡ CFC Lock Proxy V62 activo en puerto ${PORT}`);
});
