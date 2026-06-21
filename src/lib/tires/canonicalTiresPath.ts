import { vehicleSlug } from "@/lib/vehicleSlug";

/**
 * Compute the canonical tires base path for a given YMM context.
 *
 * This MUST mirror the server-side `basePath` logic in src/app/tires/page.tsx:
 *   const basePath = year && make && model
 *     ? `/tires/v/${vehicleSlug(year, make, model)}`
 *     : "/tires";
 *
 * The legacy `/tires?year=...&make=...&model=...` URL is eventually redirected to
 * the canonical `/tires/v/[vehicle-slug]` URL. Gate buttons (wheel diameter / size)
 * must navigate directly to that canonical URL so a click never lands on a path
 * that is about to be redirected away — which swallows the navigation.
 */
export function canonicalTiresBasePath(
  searchParams: URLSearchParams,
): string {
  const year = (searchParams.get("year") || "").trim();
  const make = (searchParams.get("make") || "").trim();
  const model = (searchParams.get("model") || "").trim();

  if (year && make && model) {
    return `/tires/v/${vehicleSlug(year, make, model)}`;
  }
  return "/tires";
}

/**
 * Resolve the effective base path for gate navigation.
 *
 * Prefers an explicitly-provided basePath ONLY when it already targets the
 * canonical `/tires/v/` route. Otherwise (e.g. a bare "/tires" default, or the
 * current pathname while a redirect is pending) it derives the canonical path
 * from the YMM params so the click goes straight to the final URL.
 */
export function resolveCanonicalGateBasePath(
  searchParams: URLSearchParams,
  explicitBasePath?: string,
): string {
  if (explicitBasePath && explicitBasePath.startsWith("/tires/v/")) {
    return explicitBasePath;
  }
  return canonicalTiresBasePath(searchParams);
}
