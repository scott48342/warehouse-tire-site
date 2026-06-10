/**
 * P0 FIX: Slug-normalized make matching (2026-06-10)
 *
 * PROBLEM:
 * - canonicalMake("Land Rover") returns "land-rover" (hyphenated slug)
 * - vehicle_fitments.make stores "Land Rover" (spaced, proper case)
 * - `ILIKE 'land-rover'` (no wildcards) is case-insensitive EQUALITY → no match
 * - Result: ~2,400 certified records unreachable (Mercedes-Benz 1,591,
 *   Land Rover 627, Alfa Romeo 119, Aston Martin 40)
 *
 * FIX:
 * Normalize BOTH sides to slugs at query time:
 *   LOWER(REGEXP_REPLACE(make, '[^a-zA-Z0-9]+', '-', 'g'))  IN  (candidate slugs)
 *
 * Candidate slugs are derived from the input, its canonical form, and its
 * official display name. This intentionally does NOT expand to short
 * nicknames ("mb", "rover", "alfa") on the COLUMN side, so a "Land Rover"
 * query can never accidentally match a hypothetical "Rover" make row.
 * Nickname inputs still work because canonicalMake() resolves them first.
 *
 * Examples (candidates):
 *   "Land Rover"    → ["land-rover"]                  matches DB "Land Rover", "land rover", "Land-Rover"
 *   "Mercedes-Benz" → ["mercedes-benz", "mercedes"]   matches BOTH DB storages
 *   "Mercedes"      → ["mercedes", "mercedes-benz"]   matches BOTH DB storages
 *   "Chevy"         → ["chevy", "chevrolet"]          matches DB "Chevrolet"
 *   "Toyota"        → ["toyota"]                      unchanged behavior
 *
 * No data migration required. Optional expression index for performance:
 *   scripts/migrations/p0-make-slug-index.sql
 */

import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { canonicalMake, displayMake } from "@/lib/fitment/makeAliases";

/**
 * Slugify a make string the same way the SQL side does:
 * lowercase, non-alphanumeric runs → single hyphen, trim hyphens.
 */
export function slugifyMake(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * All slug candidates that should match a given make input.
 *
 * Includes:
 * - slug of the raw input        ("Mercedes-Benz" → "mercedes-benz")
 * - canonical form               ("mercedes")
 * - slug of the display name     ("Mercedes-Benz" → "mercedes-benz")
 *
 * Deliberately excludes nickname aliases on the column side (see header).
 */
export function getMakeSlugCandidates(input: string): string[] {
  const candidates = new Set<string>();
  const inputSlug = slugifyMake(input);
  if (inputSlug) candidates.add(inputSlug);

  const canonical = canonicalMake(input);
  if (canonical) candidates.add(canonical);

  const displaySlug = slugifyMake(displayMake(input));
  if (displaySlug) candidates.add(displaySlug);

  return [...candidates];
}

/**
 * SQL condition: slug-normalized make column matches the input make.
 *
 * Replaces the broken patterns:
 *   ilike(vehicleFitments.make, normalizeMake(make))          // exact ILIKE, slug vs spaced
 *   sql`lower(make) = ${make.toLowerCase()}`                  // case-only, slug vs spaced
 *
 * Both sides are slugified, so spaces / hyphens / case / extra punctuation
 * all compare equal: "Land Rover" == "land-rover" == "LAND  ROVER".
 */
export function makeSlugMatch(col: AnyColumn, input: string): SQL {
  const candidates = getMakeSlugCandidates(input);
  if (candidates.length === 0) {
    // Match nothing rather than everything for empty input
    return sql`FALSE`;
  }

  const colSlug = sql`LOWER(REGEXP_REPLACE(${col}, '[^a-zA-Z0-9]+', '-', 'g'))`;

  if (candidates.length === 1) {
    return sql`${colSlug} = ${candidates[0]}`;
  }

  return sql`${colSlug} IN (${sql.join(
    candidates.map((c) => sql`${c}`),
    sql`, `
  )})`;
}
