// ======================================================
// CFC_VALIDATORS_V90 — Ultra Clean
// ======================================================

export function validateEmail(email) {
  return typeof email === "string" && email.includes("@") && email.includes(".");
}

export function validateDevice(device_id) {
  return typeof device_id === "string" && device_id.length >= 6;
}

export function requireBody(req, res, fields) {
  for (const f of fields) {
    if (!req.body[f]) {
      return res.status(400).json({ error: `missing field: ${f}` });
    }
  }
  return null;
}
