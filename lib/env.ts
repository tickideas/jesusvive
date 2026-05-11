// Centralized helpers for reading + validating process.env values.

export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[env] Invalid ${name}="${raw}", using ${fallback}`);
    return fallback;
  }
  return n;
}
