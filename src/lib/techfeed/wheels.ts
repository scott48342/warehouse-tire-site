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

export async function getTechfeedWheelsByStyle(style: string): Promise<TechfeedWheel[] | null> {
  if (!style) return null;
  if (!byStyleCache) {
    byStyleCache = await loadGzJson<WheelsByStyleFile>("src/techfeed/wheels_by_style.json.gz");
  }
  if (!byStyleCache?.byStyle) return null;
  return byStyleCache.byStyle[style] || null;
}
