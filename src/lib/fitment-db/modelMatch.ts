/**
 * Exact (compact-normalized) model matching for vehicle_fitments queries.
 *
 * PROBLEM (audit 2026-09-18, finding C4 / F5):
 * The old `modelNormalizedMatch` built `ILIKE '%mustang%'` from the input,
 * so "Mustang" matched "Mustang Mach-E" and "2024 Ford Mustang GT" resolved to
 * the Mach-E GT row (5x108 / 63.4 instead of 5x114.3 / 70.5).
 *
 * FIX:
 * Normalize BOTH sides to a compact key (lowercase, every non-alphanumeric
 * character removed) and compare for EQUALITY against the set of candidates
 * derived from the input plus the explicit alias table (modelAliases.ts).
 *
 *   "Mustang"            -> "mustang"          matches DB "Mustang", "mustang", "MUSTANG"
 *                                              does NOT match "Mustang Mach-E" ("mustangmache")
 *   "Silverado 2500 HD"  -> "silverado2500hd"  matches DB "Silverado 2500HD" / "silverado-2500hd"
 *   "F-250"              -> "f250" + alias "f250superduty"
 *   "encore-gx"          -> "encoregx"         matches DB "Encore GX"
 *
 * There is intentionally NO substring / prefix fallback here. Cross-model
 * matches must be declared in MODEL_ALIASES.
 */

import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { getModelVariants } from "./modelAliases";

/** Compact model key: lowercase, strip everything that is not [a-z0-9]. */
export function compactModelKey(input: string): string {
  return (input || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Compact keys for every variant (input + explicit aliases), deduped, no empties.
 */
export function getModelKeyCandidates(model: string): string[] {
  const out = new Set<string>();
  for (const v of getModelVariants(model)) {
    const k = compactModelKey(v);
    if (k) out.add(k);
  }
  return [...out];
}

/** Same as getModelKeyCandidates but for an already-expanded variant list. */
export function getModelKeyCandidatesFromVariants(variants: string[]): string[] {
  const out = new Set<string>();
  for (const v of variants) {
    const k = compactModelKey(v);
    if (k) out.add(k);
  }
  return [...out];
}

/**
 * Pure-JS equivalent of the SQL predicate (for tests / in-memory filtering):
 * does `dbModel` match `requestedModel` under exact compact-key semantics?
 */
export function modelMatchesExactly(dbModel: string, requestedModel: string): boolean {
  const dbKey = compactModelKey(dbModel);
  if (!dbKey) return false;
  return getModelKeyCandidates(requestedModel).includes(dbKey);
}

/**
 * SQL condition: compact-normalized model column EQUALS one of the candidates.
 * Replaces `ilike(model, '%word%word%')` substring patterns.
 */
export function modelExactMatchSql(col: AnyColumn, candidates: string[]): SQL {
  if (candidates.length === 0) {
    return sql`FALSE`;
  }
  const colKey = sql`LOWER(REGEXP_REPLACE(${col}, '[^a-zA-Z0-9]+', '', 'g'))`;
  if (candidates.length === 1) {
    return sql`${colKey} = ${candidates[0]}`;
  }
  return sql`${colKey} IN (${sql.join(candidates.map((c) => sql`${c}`), sql`, `)})`;
}

/** Convenience: build the exact-match predicate from a raw model input. */
export function modelSlugMatch(col: AnyColumn, model: string): SQL {
  return modelExactMatchSql(col, getModelKeyCandidates(model));
}

/** Convenience: build the exact-match predicate from a pre-expanded variant list. */
export function modelVariantsExactMatch(col: AnyColumn, variants: string[]): SQL {
  return modelExactMatchSql(col, getModelKeyCandidatesFromVariants(variants));
}
