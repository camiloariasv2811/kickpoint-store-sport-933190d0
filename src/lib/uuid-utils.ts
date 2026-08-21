/**
 * Utility to safely validate and sanitize UUID strings for PostgreSQL / Supabase foreign keys.
 * If a value is not a valid canonical UUID (e.g. "admin-demo-user"), it safely returns `null`
 * instead of causing Postgres syntax error `invalid input syntax for type uuid: "admin-demo-user"`.
 */
export function toSafeUuid(id?: string | null): string | null {
  if (!id || typeof id !== "string") return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.trim()) ? id.trim() : null;
}

export function isUuid(id?: string | null): boolean {
  return toSafeUuid(id) !== null;
}
