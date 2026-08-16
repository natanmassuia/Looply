// Minimal structured logger. One JSON line per event, no dependencies.
// Redacts sensitive keys before serializing.

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.includes(key.toLowerCase()) ? "[redacted]" : redact(val, depth + 1);
  }
  return out;
}

function emit(level: string, message: string, fields?: Record<string, unknown>) {
  const line = {
    time: new Date().toISOString(),
    level,
    service: "looply-backend",
    message,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else console.log(text);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
};

export { redact };
