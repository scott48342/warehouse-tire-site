import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

export type TechfeedWheel = {
  sku: string;
  product_desc?: string;
  brand_cd?: string;
  brand_desc?: string;
  style?: string;
  display_style_no?: string;

  diameter?: string;
  width?: string;
  offset?: string;
  centerbore?: string;
  backspacing?: string;

  lug_count?: string;
  bolt_pattern_metric?: string;
  bolt_pattern_standard?: string;

  abbreviated_finish_desc?: string;
  fancy_finish_desc?: string;
  box_label_desc?: string;

  msrp?: string;
  map_price?: string;

  images?: string[];
};

type WheelsBySkuFile = {
  generatedAt?: string;
  rows?: number;
  bySku: Record<string, TechfeedWheel>;
};

type WheelsByStyleFile = {
  generatedAt?: string;
  rows?: number;
  byStyle: Record<string, TechfeedWheel[]>;
};

let bySkuCache: WheelsBySkuFile | null = null;
let byStyleCache: WheelsByStyleFile | null = null;

// Bolt-pattern index (built lazily, per server instance)
let byBoltPatternCache: Map<string, TechfeedWheel[]> | null = null;
let techfeedIndexBuiltAt: string | null = null;

async function loadGzJson<T>(relPath: string): Promise<T | null> {
  try {
    const abs = path.join(process.cwd(), relPath);
    const buf = await fs.readFile(abs);
    const json = zlib.gunzipSync(buf).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function getTechfeedWheelBySku(sku: string): Promise<TechfeedWheel | null> {
  if (!sku) return null;
  if (!bySkuCache) {
    bySkuCache = await loadGzJson<WheelsBySkuFile>("src/techfeed/wheels_by_sku.json.gz");
  }
  if (!bySkuCache?.bySku) return null;
  return bySkuCache.bySku[sku] || null;
}

/**
 * Best-effort warmup so first real user request after deploy doesn't pay the gunzip+parse cost.
 * Returns a sample SKU when available.
 */
export async function warmTechfeedWheelCache(): Promise<{ loaded: boolean; firstSku?: string }> {
  if (!bySkuCache) {
    bySkuCache = await loadGzJson<WheelsBySkuFile>("src/techfeed/wheels_by_sku.json.gz");
  }
  const keys = bySkuCache?.bySku ? Object.keys(bySkuCache.bySku) : [];
  return { loaded: Boolean(keys.length), firstSku: keys[0] };
}

export async function getTechfeedWheelsByStyle(style: string): Promise<TechfeedWheel[] | null> {
  if (!style) return null;
  if (!byStyleCache) {
    byStyleCache = await loadGzJson<WheelsByStyleFile>("src/techfeed/wheels_by_style.json.gz");
  }
  if (!byStyleCache?.byStyle) return null;
  return byStyleCache.byStyle[style] || null;
}

function normalizeBoltPatternKey(bp: string): string {
  return String(bp || "")
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[×-]/g, "x")
    .trim();
}

function parseBoltPatternKeys(bp: string): string[] {
  const raw = String(bp || "").trim();
  if (!raw) return [];
  const parts = raw.split(/[\/,]/).map((p) => normalizeBoltPatternKey(p));
  return parts.filter(Boolean);
}

/**
 * Build / cache a bolt-pattern index for quick candidate lookup.
 * NOTE: This is best-effort and lives in-memory per server instance.
 */
async function ensureBoltPatternIndex(): Promise<void> {
  if (byBoltPatternCache) return;
  if (!bySkuCache) {
    bySkuCache = await loadGzJson<WheelsBySkuFile>("src/techfeed/wheels_by_sku.json.gz");
  }

  const idx = new Map<string, TechfeedWheel[]>();
  const bySku = bySkuCache?.bySku || {};
  for (const w of Object.values(bySku)) {
    const bpRaw = w.bolt_pattern_metric || w.bolt_pattern_standard || "";
    const keys = parseBoltPatternKeys(bpRaw);
    if (!keys.length) continue;
    for (const k of keys) {
      const arr = idx.get(k);
      if (arr) arr.push(w);
      else idx.set(k, [w]);
    }
  }

  byBoltPatternCache = idx;
  techfeedIndexBuiltAt = new Date().toISOString();
}

export async function getTechfeedCandidatesByBoltPattern(boltPattern: string): Promise<TechfeedWheel[]> {
  await ensureBoltPatternIndex();
  const k = normalizeBoltPatternKey(boltPattern);
  return (byBoltPatternCache?.get(k) || []).slice();
}

export function getTechfeedIndexBuiltAt(): string | null {
  return techfeedIndexBuiltAt;
}
