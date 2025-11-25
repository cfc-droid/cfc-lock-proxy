/* ==========================================================
   ✅ CFC_LOCK_PROXY_V69.1_COLLECTION_FIX
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
   🔹 Inicialización Firebase Admin
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
   🔐 /login — Registrar sesión y forzar cierre anterior
   ========================================================== */
app.post("/login", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id) return res.status(400).json({ error: "missing data" });

  const ref = db.collection("sessions").doc(email);   // 🔥 FIX
  const now = Date.now();

  try {
    const snap = await ref.get();

    if (snap.exists) {
      const data = snap.data();
      if (data.active_session && data.device_id !== device_id) {
        console.log(`🚨 Duplicado detectado para ${email}`);

        await ref.update({
          active_session: false,
          session_force_closed: true,
          last_active: now,
        });
      }
    }

    await ref.set(
      {
        device_id,
        active_session: true,
        session_force_closed: false,
        last_active: now,
      },
      { merge: true }
    );

    console.log(`✅ Sesión activa registrada: ${email} (${device_id})`);
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error en /login:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ==========================================================
   🔍 /check-session — Respuesta exacta según Firestore
   ========================================================== */
app.get("/check-session", async (req, res) => {
  const { email, device_id } = req.query;
  if (!email || !device_id)
    return res.status(400).json({ error: "missing params" });

  try {
    const ref = db.collection("sessions").doc(email);   // 🔥 FIX
    const snap = await ref.get();

    if (!snap.exists) return res.json({ status: "invalid" });

    const data = snap.data();

    if (!data.active_session || data.session_force_closed) {
      console.log(`🚨 Sesión expirada para ${email}`);
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
   🔥 /heartbeat — Mantener la sesión viva
   ========================================================== */
app.post("/heartbeat", async (req, res) => {
  try {
    const { email, device_id } = req.body;

    if (!email || !device_id) {
      return res.status(400).json({ error: "missing email or device_id" });
    }

    const ref = db.collection("sessions").doc(email);   // 🔥 FIX

    await ref.set(
      {
        last_active: Date.now(),
        active_session: true,
        session_force_closed: false,
      },
      { merge: true }
    );

    return res.json({ status: "alive" });
  } catch (err) {
    console.error("❌ Heartbeat ERROR:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

/* ==========================================================
   🚀 Servidor
   ========================================================== */
app.listen(PORT, "0.0.0.0", () =>
  console.log(`⚡ CFC Lock Proxy V69.1 FIX activo en puerto ${PORT}`)
);
