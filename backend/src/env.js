function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Reads a numeric environment variable, falling back to a safe default when the
 * value is missing or malformed (for example "30," or "thirty") so that a broken
 * deployment value can never reach SQL as NaN.
 */
export function envNumber(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return clamp(fallback, min, max);

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.warn(`${name}="${raw}" is not a number; using ${clamp(fallback, min, max)}`);
    return clamp(fallback, min, max);
  }

  return clamp(parsed, min, max);
}
