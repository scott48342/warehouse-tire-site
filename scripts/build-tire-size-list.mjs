import fs from "node:fs";
import path from "node:path";

const URL = "https://www.wheel-size.com/tire/";

function uniq(arr) {
  return Array.from(new Set(arr));
}

function parseSection(html, id) {
  const idx = html.indexOf(`id=\"${id}\"`);
  if (idx < 0) return "";
  // take a chunk after the id; sections are large, but this is good enough for regex extraction.
  return html.slice(idx, idx + 2_500_000);
}

function parseMetricSizes(sectionHtml) {
  // Examples: 245/45R17, LT265/70R17, 245/40ZR18
  // We intentionally normalize ZR -> R and drop LT prefix for our UI.
  const re = /\b(LT)?(\d{3})\/(\d{2})(?:ZR|R)(\d{2})\b/g;
  const out = [];
  let m;
  while ((m = re.exec(sectionHtml))) {
    const width = Number(m[2]);
    const aspect = Number(m[3]);
    const rim = Number(m[4]);
    if (![width, aspect, rim].every((n) => Number.isFinite(n) && n > 0)) continue;
    out.push({ width, aspect, rim, label: `${width}/${aspect}R${rim}` });
  }
  // Dedup by label (width/aspect/rim)
  const by = new Map(out.map((x) => [x.label, x]));
  return Array.from(by.values()).sort((a, b) => (a.aspect - b.aspect) || (a.width - b.width) || (a.rim - b.rim));
}

const EXTRA_FLOTATION = [
  // Common modern flotation sizes that may not appear in the Wheel-Size list but show up in real inventory.
  // Format: ##x##.##R##
  { dia: 33, width: 10.5, rim: 15 },
  { dia: 33, width: 12.5, rim: 15 },
  { dia: 33, width: 12.5, rim: 17 },
  { dia: 33, width: 12.5, rim: 18 },
  { dia: 33, width: 12.5, rim: 20 },
  { dia: 33, width: 12.5, rim: 22 },
  { dia: 35, width: 12.5, rim: 18 },
  { dia: 35, width: 12.5, rim: 20 },
  { dia: 35, width: 12.5, rim: 22 },
  { dia: 37, width: 12.5, rim: 20 },
  { dia: 37, width: 12.5, rim: 22 },
];

function parseFlotationSizes(sectionHtml) {
  // Examples: 31X10.50R15LT, 33X12.50R20, 37X12.50R16.5LT
  const re = /\b(\d{2})\s*[Xx]\s*(\d{1,2}\.\d{2})\s*R\s*(\d{2}(?:\.5)?)\s*(?:LT)?\b/g;
  const out = [];
  let m;
  while ((m = re.exec(sectionHtml))) {
    const dia = Number(m[1]);
    const width = Number(m[2]);
    const rim = Number(m[3]);
    if (![dia, width, rim].every((n) => Number.isFinite(n) && n > 0)) continue;
    out.push({ dia, width, rim, label: `${dia}x${width.toFixed(2)}R${rim}` });
  }
  const by = new Map(out.map((x) => [x.label, x]));
  return Array.from(by.values()).sort((a, b) => (a.dia - b.dia) || (a.width - b.width) || (a.rim - b.rim));
}

async function main() {
  const res = await fetch(URL, {
    headers: {
      "user-agent": "warehouse-tire-site/1.0 (build script; contact: info@warehousetiredirect.com)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();

  // Sections we care about (per Scott): ISO metric, LT-metric, LT-high flotation.
  const iso = parseSection(html, "tire-cloud-for-iso-metric");
  const lt = parseSection(html, "tire-cloud-for-lt-metric");
  const hf = parseSection(html, "tire-cloud-for-lt-hf");

  const metric = uniq([
    ...parseMetricSizes(iso).map((x) => x.label),
    ...parseMetricSizes(lt).map((x) => x.label),
  ]).sort();

  const flotation = [
    ...parseFlotationSizes(hf),
    ...EXTRA_FLOTATION.map((x) => ({ ...x, label: `${x.dia}x${Number(x.width).toFixed(2)}R${x.rim}` })),
  ];

  // Dedup flotation by label
  const flotationBy = new Map(flotation.map((x) => [x.label, x]));
  const flotationDeduped = Array.from(flotationBy.values()).sort((a, b) => (a.dia - b.dia) || (a.width - b.width) || (a.rim - b.rim));

  const out = {
    source: {
      url: URL,
      fetchedAt: new Date().toISOString(),
      note: "Generated from wheel-size.com/tire/ sections: ISO metric + LT-metric (normalized to ###/##R##), and LT-high flotation (##x##.##R##).",
    },
    metric, // string[] like 245/45R17
    flotation: flotationDeduped, // objects
  };

  const outPath = path.join(process.cwd(), "src", "data", "tire-sizes.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`Wrote ${out.metric.length} metric sizes and ${out.flotation.length} flotation sizes -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
