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

export type WheelStyle = {
  styleKey: string;
  brand: string;
  brandCode: string;
  model: string;
  imageUrl?: string;
  price?: number;
  finishes: Array<{
    finish: string;
    sku: string;
    imageUrl?: string;
    price?: number;
    diameter?: string;
    width?: string;
    offset?: string;
  }>;
  // All SKUs in this style for size filtering
  skus: Array<{
    sku: string;
    diameter: string;
    width: string;
    offset: string;
    boltPattern: string;
    centerbore: string;
    finish: string;
    price?: number;
  }>;
};

type WheelsBySkuFile = {
  generatedAt?: string;
  rows?: number;
  bySku: Record<string, TechfeedWheel>;
};

let dataCache: WheelsBySkuFile | null = null;
let stylesCache: Map<string, WheelStyle> | null = null;
let stylesList: WheelStyle[] | null = null;

async function loadData(): Promise<WheelsBySkuFile | null> {
  if (dataCache) return dataCache;
  try {
    const abs = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = await fs.readFile(abs);
    const json = zlib.gunzipSync(buf).toString("utf8");
    dataCache = JSON.parse(json) as WheelsBySkuFile;
    return dataCache;
  } catch (e) {
    console.error("[wheels-browse] Failed to load techfeed:", e);
    return null;
  }
}

function buildStylesIndex(data: WheelsBySkuFile): Map<string, WheelStyle> {
  if (stylesCache) return stylesCache;
  
  const styles = new Map<string, WheelStyle>();
  
  for (const [sku, w] of Object.entries(data.bySku)) {
    const styleKey = w.style || w.display_style_no || "";
    if (!styleKey) continue;
    
    const boltPattern = w.bolt_pattern_metric || w.bolt_pattern_standard || "";
    const diameter = w.diameter || "";
    const width = w.width || "";
    const offset = w.offset || "";
    const centerbore = w.centerbore || "";
    const finish = w.abbreviated_finish_desc || w.fancy_finish_desc || "";
    const price = w.msrp ? parseFloat(w.msrp) : undefined;
    const imageUrl = w.images?.[0];
    
    let style = styles.get(styleKey);
    if (!style) {
      style = {
        styleKey,
        brand: w.brand_desc || "",
        brandCode: w.brand_cd || "",
        model: w.product_desc || styleKey,
        imageUrl,
        price,
        finishes: [],
        skus: [],
      };
      styles.set(styleKey, style);
    }
    
    // Update representative image/price if this one has them
    if (!style.imageUrl && imageUrl) style.imageUrl = imageUrl;
    if (style.price === undefined && price) style.price = price;
    if (price && style.price && price < style.price) style.price = price;
    
    // Add to skus list
    style.skus.push({
      sku,
      diameter,
      width,
      offset,
      boltPattern,
      centerbore,
      finish,
      price,
    });
    
    // Track unique finishes
    if (finish && !style.finishes.some(f => f.finish === finish)) {
      style.finishes.push({
        finish,
        sku,
        imageUrl,
        price,
        diameter,
        width,
        offset,
      });
    }
  }
  
  stylesCache = styles;
  return styles;
}

export type BrowseFilters = {
  boltPattern?: string;
  diameter?: string;
  width?: string;
  offsetMin?: number;
  offsetMax?: number;
  centerbore?: string;
  brandCode?: string;
  finish?: string;
  priceMin?: number;
  priceMax?: number;
};

export type BrowseResult = {
  styles: WheelStyle[];
  totalStyles: number;
  facets: {
    brands: Array<{ code: string; name: string; count: number }>;
    finishes: Array<{ value: string; count: number }>;
    diameters: Array<{ value: string; count: number }>;
    widths: Array<{ value: string; count: number }>;
    boltPatterns: Array<{ value: string; count: number }>;
  };
  cacheHit: boolean;
  loadMs: number;
  filterMs: number;
};

export async function browseWheels(
  filters: BrowseFilters,
  page: number = 1,
  pageSize: number = 24
): Promise<BrowseResult> {
  const t0 = Date.now();
  
  const data = await loadData();
  if (!data?.bySku) {
    return {
      styles: [],
      totalStyles: 0,
      facets: { brands: [], finishes: [], diameters: [], widths: [], boltPatterns: [] },
      cacheHit: false,
      loadMs: Date.now() - t0,
      filterMs: 0,
    };
  }
  
  const loadMs = Date.now() - t0;
  const t1 = Date.now();
  const cacheHit = stylesCache !== null;
  
  const stylesMap = buildStylesIndex(data);
  
  // Build list if not cached
  if (!stylesList) {
    stylesList = Array.from(stylesMap.values());
  }
  
  // Filter styles based on criteria
  let filtered = stylesList;
  
  if (filters.boltPattern) {
    const bp = filters.boltPattern.toUpperCase().replace(/\s/g, "");
    filtered = filtered.filter(s => 
      s.skus.some(sku => {
        const skuBp = sku.boltPattern.toUpperCase().replace(/\s/g, "");
        return skuBp === bp || skuBp.includes(bp);
      })
    );
  }
  
  if (filters.diameter) {
    const d = parseFloat(filters.diameter);
    filtered = filtered.filter(s =>
      s.skus.some(sku => {
        const skuD = parseFloat(sku.diameter);
        return Math.abs(skuD - d) < 0.1;
      })
    );
  }
  
  if (filters.width) {
    const w = parseFloat(filters.width);
    filtered = filtered.filter(s =>
      s.skus.some(sku => {
        const skuW = parseFloat(sku.width);
        return Math.abs(skuW - w) < 0.1;
      })
    );
  }
  
  if (filters.offsetMin !== undefined || filters.offsetMax !== undefined) {
    filtered = filtered.filter(s =>
      s.skus.some(sku => {
        const o = parseFloat(sku.offset);
        if (!Number.isFinite(o)) return false;
        if (filters.offsetMin !== undefined && o < filters.offsetMin) return false;
        if (filters.offsetMax !== undefined && o > filters.offsetMax) return false;
        return true;
      })
    );
  }
  
  if (filters.centerbore) {
    const cb = parseFloat(filters.centerbore);
    filtered = filtered.filter(s =>
      s.skus.some(sku => {
        const skuCb = parseFloat(sku.centerbore);
        // Wheel centerbore must be >= vehicle hub (with small tolerance)
        return skuCb >= cb - 0.5;
      })
    );
  }
  
  if (filters.brandCode) {
    filtered = filtered.filter(s => s.brandCode === filters.brandCode);
  }
  
  if (filters.finish) {
    const f = filters.finish.toLowerCase();
    filtered = filtered.filter(s =>
      s.finishes.some(fin => fin.finish.toLowerCase().includes(f))
    );
  }
  
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    filtered = filtered.filter(s => {
      const p = s.price;
      if (p === undefined) return false;
      if (filters.priceMin !== undefined && p < filters.priceMin) return false;
      if (filters.priceMax !== undefined && p > filters.priceMax) return false;
      return true;
    });
  }
  
  // Prefer styles with images
  const withImages = filtered.filter(s => s.imageUrl);
  const finalFiltered = withImages.length >= Math.min(12, filtered.length) ? withImages : filtered;
  
  // Sort by price (low to high)
  finalFiltered.sort((a, b) => {
    const pa = a.price ?? Infinity;
    const pb = b.price ?? Infinity;
    return pa - pb;
  });
  
  // Build facets from filtered results
  const brandCounts = new Map<string, { name: string; count: number }>();
  const finishCounts = new Map<string, number>();
  const diameterCounts = new Map<string, number>();
  const widthCounts = new Map<string, number>();
  const boltPatternCounts = new Map<string, number>();
  
  for (const s of finalFiltered) {
    // Brand
    if (s.brandCode) {
      const existing = brandCounts.get(s.brandCode);
      if (existing) {
        existing.count++;
      } else {
        brandCounts.set(s.brandCode, { name: s.brand, count: 1 });
      }
    }
    
    // Finishes
    for (const f of s.finishes) {
      if (f.finish) {
        finishCounts.set(f.finish, (finishCounts.get(f.finish) || 0) + 1);
      }
    }
    
    // Diameters/widths/bolt patterns from SKUs
    const seenD = new Set<string>();
    const seenW = new Set<string>();
    const seenBp = new Set<string>();
    for (const sku of s.skus) {
      if (sku.diameter && !seenD.has(sku.diameter)) {
        seenD.add(sku.diameter);
        diameterCounts.set(sku.diameter, (diameterCounts.get(sku.diameter) || 0) + 1);
      }
      if (sku.width && !seenW.has(sku.width)) {
        seenW.add(sku.width);
        widthCounts.set(sku.width, (widthCounts.get(sku.width) || 0) + 1);
      }
      if (sku.boltPattern && !seenBp.has(sku.boltPattern)) {
        seenBp.add(sku.boltPattern);
        boltPatternCounts.set(sku.boltPattern, (boltPatternCounts.get(sku.boltPattern) || 0) + 1);
      }
    }
  }
  
  // Paginate
  const start = (page - 1) * pageSize;
  const pageStyles = finalFiltered.slice(start, start + pageSize);
  
  const filterMs = Date.now() - t1;
  
  return {
    styles: pageStyles,
    totalStyles: finalFiltered.length,
    facets: {
      brands: Array.from(brandCounts.entries())
        .map(([code, { name, count }]) => ({ code, name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
      finishes: Array.from(finishCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
      diameters: Array.from(diameterCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
        .slice(0, 20),
      widths: Array.from(widthCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
        .slice(0, 20),
      boltPatterns: Array.from(boltPatternCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
    },
    cacheHit,
    loadMs,
    filterMs,
  };
}

/**
 * Warmup: load and index data so first user request is fast
 */
export async function warmBrowseCache(): Promise<{ loaded: boolean; styleCount: number; skuCount: number }> {
  const data = await loadData();
  if (!data?.bySku) {
    return { loaded: false, styleCount: 0, skuCount: 0 };
  }
  
  const styles = buildStylesIndex(data);
  stylesList = Array.from(styles.values());
  
  return {
    loaded: true,
    styleCount: styles.size,
    skuCount: Object.keys(data.bySku).length,
  };
}
