/* Find which grouping-key field differs between API-internal inputs and page inputs */
const BASE = "http://localhost:3001";

async function main() {
  const url = `${BASE}/api/wheels/fitment-search?year=2014&make=Mitsubishi&model=Lancer%20Evolution&diameter=18&pageSize=2000`;
  const d = await (await fetch(url)).json();
  const mod = await import("../src/lib/wheels/groupWheelsBySpec");
  const groupFn = (mod as any).groupWheelsBySpec || (mod as any).default;

  // A) page-style inputs (pre-extracted model)
  const pageInputs = d.results.map((it: any) => {
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
      styleKey: it?.properties?.style || undefined,
      diameter: it?.properties?.diameter ? String(it.properties.diameter) : undefined,
      width: it?.properties?.width ? String(it.properties.width) : undefined,
      offset: it?.properties?.offset ? String(it.properties.offset) : undefined,
      boltPattern: it?.properties?.boltPatternMetric || it?.properties?.boltPattern || undefined,
      centerbore: it?.properties?.centerbore ? String(it.properties.centerbore) : undefined,
      finish: it?.properties?.abbreviated_finish_desc,
    };
  });

  // B) API-facet-style inputs (full title as model, like route.ts facet block)
  const apiInputs = d.results.map((it: any) => ({
    sku: it?.sku,
    brand: it?.brand?.description,
    brandCode: it?.brand?.code,
    styleKey: it?.properties?.style || undefined,
    model: it?.title || it?.sku,
    diameter: it?.properties?.diameter != null ? String(it.properties.diameter) : undefined,
    width: it?.properties?.width != null ? String(it.properties.width) : undefined,
    offset: it?.properties?.offset != null ? String(it.properties.offset) : undefined,
    boltPattern: it?.properties?.boltPatternMetric || it?.properties?.boltPattern || undefined,
    centerbore: it?.properties?.centerbore != null ? String(it.properties.centerbore) : undefined,
    finish: it?.properties?.abbreviated_finish_desc,
  }));

  console.log("A page-style grouped:", groupFn(pageInputs).length);
  console.log("B api-style grouped:", groupFn(apiInputs).length);

  // Compare extracted models between A and B logic for mismatches
  const extractLib = (title: string) => {
    const t = String(title).trim();
    const m = t.match(/\b\d{2}X\d+(?:\.\d+)?\b/i);
    if (m && m.index !== undefined && m.index > 0) return t.substring(0, m.index).trim();
    const words = t.split(/\s+/);
    if (words.length >= 2 && /^[A-Z0-9-]+$/i.test(words[1])) return words.slice(0, 2).join(" ");
    return words[0] || t;
  };
  let mismatches = 0;
  const samples: string[] = [];
  for (let i = 0; i < d.results.length; i++) {
    const a = String(pageInputs[i].model || "").toLowerCase().trim();
    const b = extractLib(String(apiInputs[i].model || "")).toLowerCase().trim();
    if (a !== b) {
      mismatches++;
      if (samples.length < 10) samples.push(`title="${d.results[i].title}" page="${a}" lib="${b}"`);
    }
  }
  console.log("model extraction mismatches:", mismatches);
  samples.forEach((s) => console.log("  ", s));

  // Also: null-vs-undefined field truthiness. Count results where properties.offset === 0 etc.
  let zeroOffset = 0, zeroWidth = 0, zeroDia = 0;
  for (const it of d.results) {
    if (it?.properties?.offset === 0 || it?.properties?.offset === "0") zeroOffset++;
    if (Number(it?.properties?.width) === 0) zeroWidth++;
  }
  console.log("zero offsets:", zeroOffset, "zero widths:", zeroWidth);
}

main().catch((e) => { console.error(e); process.exit(1); });
