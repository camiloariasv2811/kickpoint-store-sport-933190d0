/**
 * Utilidades para evitar que una ruta quede "congelada" esperando datos.
 *
 * En móvil (redes inestables) una promesa del loader que nunca resuelve deja
 * la navegación bloqueada y el usuario debe refrescar. Con estos helpers el
 * loader siempre termina y la UI se hidrata con lo que haya, dejando que
 * TanStack Query reintente en segundo plano.
 */

export const LOADER_TIMEOUT_MS = 6000;

export function withTimeout<T>(promise: Promise<T>, fallback: T, ms = LOADER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value ?? fallback);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}
