import express from "express";
import cors from "cors";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = express();
app.use(cors());
app.use(express.json());

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Endpoint principal: verifica si el dispositivo actual sigue siendo válido
app.get("/check-session", async (req, res) => {
  const { email, device_id } = req.query;
  if (!email || !device_id) return res.status(400).json({ error: "Missing params" });

  const ref = db.collection("licenses").doc(email);
  const snap = await ref.get();
  if (!snap.exists) return res.json({ status: "invalid" });

  const data = snap.data();
  res.json({ status: data.device_id === device_id ? "valid" : "invalid" });
});

// Endpoint secundario: registra heartbeats
app.post("/heartbeat", async (req, res) => {
  const { email, device_id } = req.body;
  if (!email || !device_id) return res.status(400).json({ error: "Missing body" });
  await db.collection("licenses").doc(email).set({
    device_id,
    last_active: new Date(),
  }, { merge: true });
  res.json({ ok: true });
});

app.listen(3000, () => console.log("🔥 CFC Lock Proxy activo en puerto 3000"));
