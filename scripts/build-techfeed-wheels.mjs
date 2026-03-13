import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { parse } from "csv-parse/sync";

// Builds compact indexes from the WheelPros TechGuide CSV.
// Input (default): ../techfeed/Wheel_TechGuide.csv (relative to repo root)
// Output: src/techfeed/wheels_by_sku.json.gz and src/techfeed/wheels_by_style.json.gz

const repoRoot = process.cwd();
const inputPath = process.argv[2]
  ? path.resolve(repoRoot, process.argv[2])
  : path.resolve(repoRoot, "..", "techfeed", "Wheel_TechGuide.csv");

const outDir = path.resolve(repoRoot, "src", "techfeed");
const outSku = path.join(outDir, "wheels_by_sku.json.gz");
const outStyle = path.join(outDir, "wheels_by_style.json.gz");

function pickImages(row) {
  const keys = ["image_url1", "image_url2", "image_url3", "image_url4", "image_url"];
  const urls = [];
  for (const k of keys) {
    const v = (row[k] ?? "").toString().trim();
    if (v && !urls.includes(v)) urls.push(v);
  }
  return urls;
}

function compactRow(row) {
  return {
    sku: (row.sku ?? "").toString().trim(),
    product_desc: (row.product_desc ?? "").toString().trim(),
    brand_cd: (row.brand_cd ?? "").toString().trim(),
    brand_desc: (row.brand_desc ?? "").toString().trim(),

    style: (row.style ?? "").toString().trim(),
    display_style_no: (row.display_style_no ?? "").toString().trim(),

    diameter: (row.diameter ?? "").toString().trim(),
    width: (row.width ?? "").toString().trim(),
    offset: (row.offset ?? "").toString().trim(),
    centerbore: (row.centerbore ?? "").toString().trim(),
    backspacing: (row.backspacing ?? "").toString().trim(),

    lug_count: (row.lug_count ?? "").toString().trim(),
    bolt_pattern_metric: (row.bolt_pattern_metric ?? "").toString().trim(),
    bolt_pattern_standard: (row.bolt_pattern_standard ?? "").toString().trim(),

    abbreviated_finish_desc: (row.abbreviated_finish_desc ?? "").toString().trim(),
    fancy_finish_desc: (row.fancy_finish_desc ?? "").toString().trim(),
    box_label_desc: (row.box_label_desc ?? "").toString().trim(),

    msrp: (row.msrp ?? "").toString().trim(),
    map_price: (row.map_price ?? "").toString().trim(),

    images: pickImages(row),
  };
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`TechFeed wheel CSV not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Reading: ${inputPath}`);
  const csv = await fsp.readFile(inputPath);

  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  /** @type {Record<string, any>} */
  const bySku = {};
  /** @type {Record<string, any[]>} */
  const byStyle = {};

  let rows = 0;
  for (const row of records) {
    rows++;
    const sku = (row.sku ?? "").toString().trim();
    if (!sku) continue;

    const c = compactRow(row);
    bySku[sku] = c;

    const style = c.style || c.display_style_no;
    if (style) {
      (byStyle[style] ||= []).push(c);
    }
  }

  await fsp.mkdir(outDir, { recursive: true });

  const skuPayload = JSON.stringify({ generatedAt: new Date().toISOString(), rows, bySku });
  const stylePayload = JSON.stringify({ generatedAt: new Date().toISOString(), rows, byStyle });

  await fsp.writeFile(outSku, zlib.gzipSync(skuPayload, { level: 9 }));
  await fsp.writeFile(outStyle, zlib.gzipSync(stylePayload, { level: 9 }));

  console.log(`Wrote: ${outSku}`);
  console.log(`Wrote: ${outStyle}`);
  console.log(`Rows: ${rows}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
