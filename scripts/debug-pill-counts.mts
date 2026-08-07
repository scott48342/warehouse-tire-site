/* Debug: why facet style count (951) != page style count (~526) for Evo 18" */
const BASE = "http://localhost:3001";

async function main() {
  const url = `${BASE}/api/wheels/fitment-search?year=2014&make=Mitsubishi&model=Lancer%20Evolution&diameter=18&pageSize=2000`;
  const res = await fetch(url);
  const d = await res.json();
  console.log("totalCount:", d.totalCount, "results:", d.results.length);

  // Replicate page.tsx mapping
  const items = d.results.map((it) => {
    let model = it?.properties?.model;
    if (!model && it?.title) {
      const sizeMatch = it.title.match(/^(.+?)\s+\d+[Xx]\d/);
      model = sizeMatch ? sizeMatch[1].trim() : it.title.split(" ")[0];
    }
    return {
      sku: it?.sku,
      brand: it?.brand?.description,
      brandCode: it?.brand?.code,
      model,
      finish: it?.techfeed?.finish || it?.properties?.abbreviated_finish_desc || it?.properties?.finish,
      diameter: it?.properties?.diameter ? String(it.properties.diameter) : undefined,
      width: it?.properties?.width ? String(it.properties.width) : undefined,
      offset: it?.properties?.offset ? String(it.properties.offset) : undefined,
      boltPattern: it?.properties?.boltPatternMetric || it?.properties?.boltPattern || undefined,
      centerbore: it?.properties?.centerbore ? String(it.properties.centerbore) : undefined,
    };
  });

  const mod = await import("../src/lib/wheels/groupWheelsBySpec");
  const groupFn = mod.groupWheelsBySpec || mod.default;
  const grouped = groupFn(items);
  console.log("page-style grouped count:", grouped.length);

  // facet bucket for 18
  const b = (d.facets?.wheel_diameter?.buckets || []).find((x) => x.value === "18");
  console.log("facet 18 count:", b && b.count);

  // sample a few group keys' members
  const sizes = new Map();
  for (const g of grouped) {
    const k = `${g.brandCode}|${g.model}|${g.width}|${g.offset}|${g.boltPattern}|${g.centerbore}`;
    sizes.set(k, (sizes.get(k) || 0) + 1);
  }
  console.log("distinct page keys:", sizes.size);
}

main().catch((e) => { console.error(e); process.exit(1); });

