/* ==========================================================
   ✅ CFC_LOCK_PROXY_V67.0_FIRESTORE_TIMESTAMP_FIX
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
   🧠 Estado de sesiones en Firestore (persistente)
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing data" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();
    const now = Date.now();

    // Si existe una sesión previa
    if (snap.exists) {
      const data = snap.data();

      // Si otra sesión sigue activa y es distinta
      if (data.active_session === true && data.device_id !== device_id) {
        console.log(`🚨 Duplicado detectado para ${email}`);
        // Forzar cierre de la anterior
        await ref.set(
          {
            active_session: false,
            session_force_closed: true,
            last_active: now,
          },
          { merge: true }
        );
      }
    }

    // Registrar la nueva sesión como activa
    await ref.set(
      {
        device_id,
        active_session: true,
        session_force_closed: false,
        last_active: now,
      },
      { merge: true }
    );

    console.log(`✅ Sesión registrada: ${email} (${device_id})`);
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error en /login:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🔹 /check-session — Validar sesión activa
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

    if (!data.active_session) {
      console.log(`🚨 Sesión inactiva detectada: ${email}`);
      return res.json({ status: "expired" });
    }

    if (data.device_id !== device_id) {
      console.log(`🚨 Sesión transferida a otro dispositivo: ${email}`);
      return res.json({ status: "expired" });
    }

    return res.json({ status: "valid" });
  } catch (err) {
    console.error("⚠️ Error en /check-session:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   💓 /heartbeat — Mantener sesión viva
   ========================================================== */
app.post("/heartbeat", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing data" });

  try {
    const ref = db.collection("licenses").doc(email);
    const snap = await ref.get();

    if (!snap.exists) return res.json({ status: "invalid" });

    const data = snap.data();

    if (!data.active_session || data.device_id !== device_id) {
      console.log(`🚨 Heartbeat inválido: ${email}`);
      return res.json({ status: "expired" });
    }

    await ref.set({ last_active: Date.now() }, { merge: true });
    console.log(`♻️ Heartbeat renovado (${email})`);
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error en /heartbeat:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🚀 Servidor
   ========================================================== */
app.listen(PORT, "0.0.0.0", () =>
  console.log(`⚡ CFC Lock Proxy V67 activo en puerto ${PORT}`)
);
