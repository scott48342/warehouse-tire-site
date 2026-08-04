// Sanitize env-provided upstream base URLs (WHEELPROS_WRAPPER_URL etc).
//
// Why this exists (2026-08-04): the Production WHEELPROS_WRAPPER_URL value was
// set with literal "\r\n" escape TEXT embedded at the end (bad shell quoting
// when the var was added). Combined with `new URL("/wheels/search", base)` —
// where a leading slash REPLACES the base path — the wheel PDP API resolved to
// the public /wheels/search page (= /wheels/[sku] with sku="search"), which
// called the same API again => infinite recursion => function timeout => 500
// => every wheel PDP rendered "Wheel not found".
//
// Rules:
// 1. Strip literal "\r" / "\n" / "\t" escape text and real whitespace/control chars.
// 2. Drop trailing slashes so callers can safely do `new URL(`${base}/path`)`.
// 3. NEVER pass a base with a path into `new URL("/x", base)` — append instead.
export function sanitizeUpstreamBase(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/\\r|\\n|\\t/g, "")
    .replace(/[\s\u0000-\u001f]+/g, "")
    .replace(/\/+$/, "");
}
