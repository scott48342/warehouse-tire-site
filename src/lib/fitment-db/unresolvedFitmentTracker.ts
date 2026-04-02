/**
 * Unresolved Fitment Tracker
 * 
 * Tracks vehicle searches that cannot be resolved in the fitment DB.
 * Used to prioritize adding missing coverage based on real customer demand.
 * 
 * Storage: Postgres table `unresolved_fitment_searches`
 * 
 * Key design decisions:
 * - Aggregate by Y/M/M/trim to avoid per-request row explosion
 * - Track first_seen, last_seen, and occurrence_count
 * - Store metadata about search context (wheel/tire, source, sample paths)
 * - Filter obvious bot/spam traffic before logging
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { eq, desc, and, gte, lte, ilike, count, sum } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const unresolvedFitmentSearches = pgTable(
  "unresolved_fitment_searches",
  {
    id: serial("id").primaryKey(),
    
    // Vehicle identification (normalized)
    year: integer("year").notNull(),
    make: text("make").notNull(),        // Lowercase, trimmed
    model: text("model").notNull(),      // Lowercase, trimmed
    trim: text("trim"),                  // Optional, lowercase
    
    // Search context
    searchType: text("search_type").notNull(), // 'wheel' | 'tire' | 'fitment' | 'unknown'
    source: text("source").notNull(),          // 'selector' | 'direct_url' | 'api' | 'unknown'
    
    // Aggregation counters
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    
    // Timestamps
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    
    // Metadata (sample paths, user agents, etc.)
    metadata: jsonb("metadata").$type<UnresolvedMetadata>(),
  },
  (table) => ({
    // Unique constraint for aggregation
    vehicleUnique: uniqueIndex("unresolved_vehicle_unique_idx").on(
      table.year,
      table.make,
      table.model,
      table.trim,
      table.searchType
    ),
    // Query indexes
    makeIdx: index("unresolved_make_idx").on(table.make),
    modelIdx: index("unresolved_model_idx").on(table.model),
    countIdx: index("unresolved_count_idx").on(table.occurrenceCount),
    lastSeenIdx: index("unresolved_last_seen_idx").on(table.lastSeen),
  })
);

export interface UnresolvedMetadata {
  samplePaths?: string[];      // Up to 5 sample request paths
  sampleUserAgents?: string[]; // Up to 3 sample user agents
  lastModificationId?: string; // Last requested modificationId (if any)
  resolutionAttempts?: string[]; // What resolution paths were tried
}

export type UnresolvedFitmentSearch = typeof unresolvedFitmentSearches.$inferSelect;
export type NewUnresolvedFitmentSearch = typeof unresolvedFitmentSearches.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// BOT/SPAM FILTERING
// ═══════════════════════════════════════════════════════════════════════════════

const BOT_USER_AGENT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i,
  /curl/i, /wget/i, /python/i, /axios/i,
  /node-fetch/i, /go-http/i, /java\//i,
  /headless/i, /phantom/i, /selenium/i,
];

const SPAM_PATTERNS = {
  // Obviously fake years
  invalidYears: (year: number) => year < 1900 || year > new Date().getFullYear() + 2,
  // Known spam make patterns
  fakeMakes: /^(test|asdf|xxx|null|undefined|select|drop|insert|script)$/i,
  // Obvious injection attempts
  injection: /[<>'"`;{}()\[\]]/,
};

/**
 * Check if a request looks like bot/spam traffic
 */
export function isLikelyBotOrSpam(params: {
  year: number;
  make: string;
  model: string;
  userAgent?: string;
}): boolean {
  const { year, make, model, userAgent } = params;
  
  // Invalid year
  if (SPAM_PATTERNS.invalidYears(year)) return true;
  
  // Fake make names
  if (SPAM_PATTERNS.fakeMakes.test(make)) return true;
  
  // Injection attempts
  if (SPAM_PATTERNS.injection.test(make) || SPAM_PATTERNS.injection.test(model)) return true;
  
  // Bot user agents
  if (userAgent) {
    for (const pattern of BOT_USER_AGENT_PATTERNS) {
      if (pattern.test(userAgent)) return true;
    }
  }
  
  // Too short (probably garbage)
  if (make.length < 2 || model.length < 2) return true;
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeText(s: string): string {
  return String(s || "").trim().toLowerCase();
}

function normalizeYear(y: string | number): number {
  const n = Number(y);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogUnresolvedParams {
  year: number | string;
  make: string;
  model: string;
  trim?: string;
  searchType: "wheel" | "tire" | "fitment" | "unknown";
  source: "selector" | "direct_url" | "api" | "unknown";
  path?: string;
  userAgent?: string;
  modificationId?: string;
  resolutionAttempts?: string[];
}

/**
 * Log an unresolved fitment search
 * 
 * This upserts into the aggregation table, incrementing the count
 * if the vehicle was already seen.
 */
export async function logUnresolvedFitment(params: LogUnresolvedParams): Promise<void> {
  const year = normalizeYear(params.year);
  const make = normalizeText(params.make);
  const model = normalizeText(params.model);
  const trim = params.trim ? normalizeText(params.trim) : null;
  
  // Skip if likely bot/spam
  if (isLikelyBotOrSpam({ year, make, model, userAgent: params.userAgent })) {
    console.log(`[unresolvedFitment] Skipping likely bot/spam: ${year} ${make} ${model}`);
    return;
  }
  
  try {
    const now = new Date();
    
    // Try to find existing record
    const existing = await db
      .select()
      .from(unresolvedFitmentSearches)
      .where(
        and(
          eq(unresolvedFitmentSearches.year, year),
          eq(unresolvedFitmentSearches.make, make),
          eq(unresolvedFitmentSearches.model, model),
          trim 
            ? eq(unresolvedFitmentSearches.trim, trim)
            : sql`${unresolvedFitmentSearches.trim} IS NULL`,
          eq(unresolvedFitmentSearches.searchType, params.searchType)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const record = existing[0];
      const metadata: UnresolvedMetadata = (record.metadata as UnresolvedMetadata) || {};
      
      // Update sample paths (keep max 5)
      if (params.path) {
        const paths = metadata.samplePaths || [];
        if (!paths.includes(params.path)) {
          paths.push(params.path);
          if (paths.length > 5) paths.shift();
        }
        metadata.samplePaths = paths;
      }
      
      // Update sample user agents (keep max 3)
      if (params.userAgent) {
        const agents = metadata.sampleUserAgents || [];
        if (!agents.includes(params.userAgent)) {
          agents.push(params.userAgent);
          if (agents.length > 3) agents.shift();
        }
        metadata.sampleUserAgents = agents;
      }
      
      // Update modification ID
      if (params.modificationId) {
        metadata.lastModificationId = params.modificationId;
      }
      
      // Update resolution attempts
      if (params.resolutionAttempts) {
        metadata.resolutionAttempts = params.resolutionAttempts;
      }
      
      await db
        .update(unresolvedFitmentSearches)
        .set({
          occurrenceCount: sql`${unresolvedFitmentSearches.occurrenceCount} + 1`,
          lastSeen: now,
          source: params.source, // Update to most recent source
          metadata,
        })
        .where(eq(unresolvedFitmentSearches.id, record.id));
      
      console.log(`[unresolvedFitment] Updated: ${year} ${make} ${model} (count: ${record.occurrenceCount + 1})`);
      
      // Check for alert conditions (threshold crossing)
      const newCount = record.occurrenceCount + 1;
      const config = await import("./gapAlerts").then(m => m.getAlertConfig());
      const thresholdCrossed = record.occurrenceCount < config.threshold && newCount >= config.threshold;
      
      // Calculate priority score for alert decision
      const daysSinceFirstSeen = (now.getTime() - record.firstSeen.getTime()) / (24 * 60 * 60 * 1000);
      const recencyBoost = Math.max(0, 1 - daysSinceFirstSeen / 14);
      const priorityScore = newCount * (1 + recencyBoost);
      
      // Check and send alert (fire and forget)
      import("./gapAlerts").then(({ checkAndSendAlert }) => {
        checkAndSendAlert({
          year,
          make,
          model,
          trim,
          searchType: params.searchType,
          occurrenceCount: newCount,
          firstSeen: record.firstSeen,
          lastSeen: now,
          source: params.source,
          samplePaths: (record.metadata as UnresolvedMetadata)?.samplePaths,
          priorityScore,
          isNewVehicle: false,
          thresholdCrossed,
        }).catch(() => {});
      }).catch(() => {});
      
    } else {
      // Insert new record
      const metadata: UnresolvedMetadata = {};
      if (params.path) metadata.samplePaths = [params.path];
      if (params.userAgent) metadata.sampleUserAgents = [params.userAgent];
      if (params.modificationId) metadata.lastModificationId = params.modificationId;
      if (params.resolutionAttempts) metadata.resolutionAttempts = params.resolutionAttempts;
      
      await db.insert(unresolvedFitmentSearches).values({
        year,
        make,
        model,
        trim,
        searchType: params.searchType,
        source: params.source,
        occurrenceCount: 1,
        firstSeen: now,
        lastSeen: now,
        metadata,
      });
      
      console.log(`[unresolvedFitment] New: ${year} ${make} ${model} ${trim || ""} (${params.searchType})`);
      
      // Check for new vehicle alert (fire and forget)
      import("./gapAlerts").then(({ checkAndSendAlert }) => {
        checkAndSendAlert({
          year,
          make,
          model,
          trim,
          searchType: params.searchType,
          occurrenceCount: 1,
          firstSeen: now,
          lastSeen: now,
          source: params.source,
          samplePaths: metadata.samplePaths,
          priorityScore: 1, // New vehicle starts with score 1
          isNewVehicle: true,
          thresholdCrossed: false,
        }).catch(() => {});
      }).catch(() => {});
    }
  } catch (err: any) {
    // Don't let logging errors break the main flow
    console.error(`[unresolvedFitment] Failed to log:`, err?.message || err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTING QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UnresolvedVehicleReport {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  searchType: string;
  occurrenceCount: number;
  firstSeen: Date;
  lastSeen: Date;
  daysSinceLastSeen: number;
  metadata: UnresolvedMetadata | null;
}

/**
 * Get top unresolved vehicles by occurrence count
 */
export async function getTopUnresolvedVehicles(options?: {
  limit?: number;
  searchType?: "wheel" | "tire" | "fitment" | "unknown";
  minCount?: number;
  sinceDays?: number;
}): Promise<UnresolvedVehicleReport[]> {
  const { limit = 50, searchType, minCount = 1, sinceDays } = options || {};
  
  let query = db
    .select()
    .from(unresolvedFitmentSearches)
    .where(
      and(
        gte(unresolvedFitmentSearches.occurrenceCount, minCount),
        searchType ? eq(unresolvedFitmentSearches.searchType, searchType) : undefined,
        sinceDays 
          ? gte(unresolvedFitmentSearches.lastSeen, new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000))
          : undefined
      )
    )
    .orderBy(desc(unresolvedFitmentSearches.occurrenceCount))
    .limit(limit);
  
  const results = await query;
  const now = Date.now();
  
  return results.map(r => ({
    year: r.year,
    make: r.make,
    model: r.model,
    trim: r.trim,
    searchType: r.searchType,
    occurrenceCount: r.occurrenceCount,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
    daysSinceLastSeen: Math.floor((now - r.lastSeen.getTime()) / (24 * 60 * 60 * 1000)),
    metadata: r.metadata as UnresolvedMetadata | null,
  }));
}

/**
 * Get recently unresolved vehicles
 */
export async function getRecentUnresolvedVehicles(options?: {
  limit?: number;
  sinceDays?: number;
}): Promise<UnresolvedVehicleReport[]> {
  const { limit = 50, sinceDays = 7 } = options || {};
  
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  
  const results = await db
    .select()
    .from(unresolvedFitmentSearches)
    .where(gte(unresolvedFitmentSearches.lastSeen, cutoff))
    .orderBy(desc(unresolvedFitmentSearches.lastSeen))
    .limit(limit);
  
  const now = Date.now();
  
  return results.map(r => ({
    year: r.year,
    make: r.make,
    model: r.model,
    trim: r.trim,
    searchType: r.searchType,
    occurrenceCount: r.occurrenceCount,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
    daysSinceLastSeen: Math.floor((now - r.lastSeen.getTime()) / (24 * 60 * 60 * 1000)),
    metadata: r.metadata as UnresolvedMetadata | null,
  }));
}

/**
 * Get counts grouped by make
 */
export async function getUnresolvedCountsByMake(options?: {
  limit?: number;
  sinceDays?: number;
}): Promise<{ make: string; vehicleCount: number; totalSearches: number }[]> {
  const { limit = 30, sinceDays } = options || {};
  
  const results = await db
    .select({
      make: unresolvedFitmentSearches.make,
      vehicleCount: count(),
      totalSearches: sum(unresolvedFitmentSearches.occurrenceCount),
    })
    .from(unresolvedFitmentSearches)
    .where(
      sinceDays
        ? gte(unresolvedFitmentSearches.lastSeen, new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000))
        : undefined
    )
    .groupBy(unresolvedFitmentSearches.make)
    .orderBy(desc(sum(unresolvedFitmentSearches.occurrenceCount)))
    .limit(limit);
  
  return results.map(r => ({
    make: r.make,
    vehicleCount: Number(r.vehicleCount) || 0,
    totalSearches: Number(r.totalSearches) || 0,
  }));
}

/**
 * Get counts grouped by model (for a specific make)
 */
export async function getUnresolvedCountsByModel(
  make: string,
  options?: { limit?: number; sinceDays?: number }
): Promise<{ model: string; vehicleCount: number; totalSearches: number }[]> {
  const { limit = 30, sinceDays } = options || {};
  const normalizedMake = normalizeText(make);
  
  const results = await db
    .select({
      model: unresolvedFitmentSearches.model,
      vehicleCount: count(),
      totalSearches: sum(unresolvedFitmentSearches.occurrenceCount),
    })
    .from(unresolvedFitmentSearches)
    .where(
      and(
        eq(unresolvedFitmentSearches.make, normalizedMake),
        sinceDays
          ? gte(unresolvedFitmentSearches.lastSeen, new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000))
          : undefined
      )
    )
    .groupBy(unresolvedFitmentSearches.model)
    .orderBy(desc(sum(unresolvedFitmentSearches.occurrenceCount)))
    .limit(limit);
  
  return results.map(r => ({
    model: r.model,
    vehicleCount: Number(r.vehicleCount) || 0,
    totalSearches: Number(r.totalSearches) || 0,
  }));
}

/**
 * Get daily counts for trend analysis
 */
export async function getUnresolvedDailyCounts(options?: {
  days?: number;
}): Promise<{ date: string; newVehicles: number; totalSearches: number }[]> {
  const { days = 30 } = options || {};
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // This query gets vehicles first seen on each day
  const results = await db
    .select({
      date: sql<string>`DATE(${unresolvedFitmentSearches.firstSeen})`,
      newVehicles: count(),
      totalSearches: sum(unresolvedFitmentSearches.occurrenceCount),
    })
    .from(unresolvedFitmentSearches)
    .where(gte(unresolvedFitmentSearches.firstSeen, cutoff))
    .groupBy(sql`DATE(${unresolvedFitmentSearches.firstSeen})`)
    .orderBy(desc(sql`DATE(${unresolvedFitmentSearches.firstSeen})`));
  
  return results.map(r => ({
    date: String(r.date),
    newVehicles: Number(r.newVehicles) || 0,
    totalSearches: Number(r.totalSearches) || 0,
  }));
}

/**
 * Get high-value gap candidates
 * 
 * "High value" = frequently searched + recent activity
 * This helps prioritize which vehicles to add first.
 */
export async function getHighValueGaps(options?: {
  limit?: number;
  minCount?: number;
  recentDays?: number;
}): Promise<(UnresolvedVehicleReport & { priorityScore: number })[]> {
  const { limit = 20, minCount = 3, recentDays = 14 } = options || {};
  
  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);
  
  const results = await db
    .select()
    .from(unresolvedFitmentSearches)
    .where(
      and(
        gte(unresolvedFitmentSearches.occurrenceCount, minCount),
        gte(unresolvedFitmentSearches.lastSeen, cutoff)
      )
    )
    .orderBy(desc(unresolvedFitmentSearches.occurrenceCount))
    .limit(limit * 2); // Get more than needed for scoring
  
  const now = Date.now();
  
  // Calculate priority score
  const scored = results.map(r => {
    const daysSinceLastSeen = (now - r.lastSeen.getTime()) / (24 * 60 * 60 * 1000);
    const recencyBoost = Math.max(0, 1 - daysSinceLastSeen / recentDays);
    
    // Priority = count * recency factor
    // More recent + more frequent = higher priority
    const priorityScore = r.occurrenceCount * (1 + recencyBoost);
    
    return {
      year: r.year,
      make: r.make,
      model: r.model,
      trim: r.trim,
      searchType: r.searchType,
      occurrenceCount: r.occurrenceCount,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      daysSinceLastSeen: Math.floor(daysSinceLastSeen),
      metadata: r.metadata as UnresolvedMetadata | null,
      priorityScore: Math.round(priorityScore * 10) / 10,
    };
  });
  
  // Sort by priority score and return top N
  return scored
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

/**
 * Mark a vehicle as resolved (delete from tracking)
 * Call this after adding fitment data for a vehicle.
 */
export async function markVehicleResolved(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<number> {
  const normalizedMake = normalizeText(make);
  const normalizedModel = normalizeText(model);
  const normalizedTrim = trim ? normalizeText(trim) : null;
  
  const result = await db
    .delete(unresolvedFitmentSearches)
    .where(
      and(
        eq(unresolvedFitmentSearches.year, year),
        eq(unresolvedFitmentSearches.make, normalizedMake),
        eq(unresolvedFitmentSearches.model, normalizedModel),
        normalizedTrim
          ? eq(unresolvedFitmentSearches.trim, normalizedTrim)
          : sql`${unresolvedFitmentSearches.trim} IS NULL`
      )
    )
    .returning({ id: unresolvedFitmentSearches.id });
  
  console.log(`[unresolvedFitment] Marked resolved: ${year} ${make} ${model} (deleted ${result.length} records)`);
  return result.length;
}

/**
 * Get summary statistics
 */
export async function getUnresolvedSummary(): Promise<{
  totalVehicles: number;
  totalSearches: number;
  uniqueMakes: number;
  lastWeekVehicles: number;
  lastWeekSearches: number;
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const [totals] = await db
    .select({
      totalVehicles: count(),
      totalSearches: sum(unresolvedFitmentSearches.occurrenceCount),
    })
    .from(unresolvedFitmentSearches);
  
  const [makes] = await db
    .select({
      uniqueMakes: sql<number>`COUNT(DISTINCT ${unresolvedFitmentSearches.make})`,
    })
    .from(unresolvedFitmentSearches);
  
  const [lastWeek] = await db
    .select({
      vehicles: count(),
      searches: sum(unresolvedFitmentSearches.occurrenceCount),
    })
    .from(unresolvedFitmentSearches)
    .where(gte(unresolvedFitmentSearches.lastSeen, weekAgo));
  
  return {
    totalVehicles: Number(totals?.totalVehicles) || 0,
    totalSearches: Number(totals?.totalSearches) || 0,
    uniqueMakes: Number(makes?.uniqueMakes) || 0,
    lastWeekVehicles: Number(lastWeek?.vehicles) || 0,
    lastWeekSearches: Number(lastWeek?.searches) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE CREATION (for migrations)
// ═══════════════════════════════════════════════════════════════════════════════

export const createUnresolvedTableSQL = `
CREATE TABLE IF NOT EXISTS unresolved_fitment_searches (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  search_type TEXT NOT NULL,
  source TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS unresolved_vehicle_unique_idx 
  ON unresolved_fitment_searches (year, make, model, trim, search_type);
CREATE INDEX IF NOT EXISTS unresolved_make_idx ON unresolved_fitment_searches (make);
CREATE INDEX IF NOT EXISTS unresolved_model_idx ON unresolved_fitment_searches (model);
CREATE INDEX IF NOT EXISTS unresolved_count_idx ON unresolved_fitment_searches (occurrence_count);
CREATE INDEX IF NOT EXISTS unresolved_last_seen_idx ON unresolved_fitment_searches (last_seen);
`;

export default {
  logUnresolvedFitment,
  getTopUnresolvedVehicles,
  getRecentUnresolvedVehicles,
  getUnresolvedCountsByMake,
  getUnresolvedCountsByModel,
  getUnresolvedDailyCounts,
  getHighValueGaps,
  markVehicleResolved,
  getUnresolvedSummary,
  isLikelyBotOrSpam,
};
