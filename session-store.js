// ======================================================
// CFC_SESSION_STORE_V90 — Ultra Clean
// ======================================================

export const sessionStore = new Map();

// Duración de sesión en milisegundos
const EXPIRE_MS = 1000 * 60 * 45; // 45 min

// Crear sesión
export function createSession(email, device_id) {
  const session = {
    email,
    device_id,
    active: true,
    force_close: false,
    last_active: Date.now(),
  };
  sessionStore.set(email, session);
  return session;
}

// Obtener sesión
export function getSession(email) {
  return sessionStore.get(email);
}

// Forzar cierre
export function forceCloseSession(email) {
  const s = sessionStore.get(email);
  if (s) {
    s.force_close = true;
  }
}

// Expirar si corresponde
export function validateExpiration(session) {
  if (!session) return "invalid";
  if (session.force_close) return "force_close";
  if (Date.now() - session.last_active > EXPIRE_MS) return "expired";
  return "valid";
}

// Actualizar actividad
export function touchSession(email) {
  const s = sessionStore.get(email);
  if (s) s.last_active = Date.now();
}
