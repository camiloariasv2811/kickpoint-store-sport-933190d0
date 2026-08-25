/**
 * Logging de diagnóstico solo en desarrollo.
 * En producción es un no-op para no gastar CPU en dispositivos móviles.
 */
export const IS_DEV = Boolean(import.meta.env?.DEV);

export function devLog(...args: unknown[]) {
  if (IS_DEV) console.log(...args);
}
