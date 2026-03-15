import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Client } = pg;

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function num(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function int(v) {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

const DATABASE_URL = required("DATABASE_URL");

const argv = process.argv.slice(2);
// Directory containing WheelPros feed files (Wheel_TechGuide.csv, Tire_TechGuide.csv, MapPrice_TechGuide.csv)
// Default: current working directory.
const dataDir = argv[0] ? path.resolve(argv[0]) : path.resolve(process.cwd());

const wheelCsv = path.join(dataDir, "Wheel_TechGuide.csv");
const tireCsv = path.join(dataDir, "Tire_TechGuide.csv");
const mapCsv = path.join(dataDir, "MapPrice_TechGuide.csv");

for (const p of [wheelCsv, tireCsv, mapCsv]) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("Loading MAP prices...");
const mapRows = parse(fs.readFileSync(mapCsv, "utf8"), { columns: true, skip_empty_lines: true });
const mapBySku = new Map();
for (const r of mapRows) {
  const sku = (r.sku || r.SKU || "").trim();
  if (!sku) continue;
  mapBySku.set(sku, { msrp_usd: num(r.msrp), map_usd: num(r.map_price) });
}
console.log(`MAP rows: ${mapBySku.size}`);

console.log("Importing wheels tech guide...");
const wheelRows = parse(fs.readFileSync(wheelCsv, "utf8"), { columns: true, skip_empty_lines: true });
let wheelCount = 0;
for (const r of wheelRows) {
  const sku = (r.sku || r.SKU || "").trim();
  if (!sku) continue;
  const mp = mapBySku.get(sku);

  const image_urls = [r.image_url1, r.image_url2, r.image_url3, r.image_url4].filter(Boolean);

  await client.query(
    `insert into wp_wheels (
      sku, brand_desc, brand_code_3, style, display_style_no, product_desc,
      diameter_in, width_in, lug_count,
      bolt_pattern_standard, bolt_pattern_metric,
      offset_mm, backspacing_in, centerbore_mm,
      load_rating_lb, image_url, image_urls,
      msrp_usd, map_usd,
      inv_order_type, division, raw, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,
      $10,$11,
      $12,$13,$14,
      $15,$16,$17,
      $18,$19,
      $20,$21,$22, now()
    )
    on conflict (sku) do update set
      brand_desc=excluded.brand_desc,
      brand_code_3=excluded.brand_code_3,
      style=excluded.style,
      display_style_no=excluded.display_style_no,
      product_desc=excluded.product_desc,
      diameter_in=excluded.diameter_in,
      width_in=excluded.width_in,
      lug_count=excluded.lug_count,
      bolt_pattern_standard=excluded.bolt_pattern_standard,
      bolt_pattern_metric=excluded.bolt_pattern_metric,
      offset_mm=excluded.offset_mm,
      backspacing_in=excluded.backspacing_in,
      centerbore_mm=excluded.centerbore_mm,
      load_rating_lb=excluded.load_rating_lb,
      image_url=excluded.image_url,
      image_urls=excluded.image_urls,
      msrp_usd=excluded.msrp_usd,
      map_usd=excluded.map_usd,
      inv_order_type=excluded.inv_order_type,
      division=excluded.division,
      raw=excluded.raw,
      updated_at=now()
    `,
    [
      sku,
      r.brand_desc || null,
      r.brand_code_3 || null,
      r.style || null,
      r.display_style_no || null,
      r.product_desc || null,
      num(r.diameter),
      num(r.width),
      int(r.lug_count),
      r.bolt_pattern_standard || null,
      r.bolt_pattern_metric || null,
      num(r.offset),
      num(r.backspacing),
      num(r.centerbore),
      int(r.load_rating_standard),
      r.image_url || null,
      image_urls.length ? image_urls : null,
      mp?.msrp_usd ?? num(r.msrp),
      mp?.map_usd ?? num(r.map_price),
      r.inv_order_type || null,
      r.division || null,
      r,
    ]
  );

  wheelCount++;
  if (wheelCount % 2000 === 0) console.log(`  wheels: ${wheelCount}`);
}
console.log(`Wheels imported: ${wheelCount}`);

console.log("Importing tires tech guide...");
const tireRows = parse(fs.readFileSync(tireCsv, "utf8"), { columns: true, skip_empty_lines: true });
let tireCount = 0;
for (const r of tireRows) {
  const sku = (r.sku || r.SKU || "").trim();
  if (!sku) continue;

  const mp = mapBySku.get(sku);

  await client.query(
    `insert into wp_tires (
      sku, brand_desc, brand_code_3, tire_size, simple_size, tire_description,
      load_index, speed_rating,
      section_width, series, rim_diameter_in, tire_diameter_in,
      image_url, weight_lb, min_width_in, max_width_in, max_load_lb,
      terrain, construction_type, mileage_warranty,
      msrp_usd, map_usd,
      inv_order_type, division, raw, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,
      $7,$8,
      $9,$10,$11,$12,
      $13,$14,$15,$16,$17,
      $18,$19,$20,
      $21,$22,
      $23,$24,$25, now()
    )
    on conflict (sku) do update set
      brand_desc=excluded.brand_desc,
      brand_code_3=excluded.brand_code_3,
      tire_size=excluded.tire_size,
      simple_size=excluded.simple_size,
      tire_description=excluded.tire_description,
      load_index=excluded.load_index,
      speed_rating=excluded.speed_rating,
      section_width=excluded.section_width,
      series=excluded.series,
      rim_diameter_in=excluded.rim_diameter_in,
      tire_diameter_in=excluded.tire_diameter_in,
      image_url=excluded.image_url,
      weight_lb=excluded.weight_lb,
      min_width_in=excluded.min_width_in,
      max_width_in=excluded.max_width_in,
      max_load_lb=excluded.max_load_lb,
      terrain=excluded.terrain,
      construction_type=excluded.construction_type,
      mileage_warranty=excluded.mileage_warranty,
      msrp_usd=excluded.msrp_usd,
      map_usd=excluded.map_usd,
      inv_order_type=excluded.inv_order_type,
      division=excluded.division,
      raw=excluded.raw,
      updated_at=now()
    `,
    [
      sku,
      r.brand_desc || null,
      r.brand_code_3 || null,
      r.tire_size || null,
      r.simple_size || null,
      r.tire_description || null,
      r.load_index || null,
      r.speed_rating || null,
      num(r.section_width),
      num(r.series),
      num(r.rim_diameter),
      num(r.tire_diameter_actual),
      r.image_url || null,
      num(r.weight),
      num(r.min_width_in),
      num(r.max_width_in),
      num(r.max_load),
      r.terrain || null,
      r.construction_type || null,
      r.mileage_warranty || null,
      mp?.msrp_usd ?? num(r.msrp),
      mp?.map_usd ?? num(r.map_price),
      r.inv_order_type || null,
      r.division || null,
      r,
    ]
  );

  tireCount++;
  if (tireCount % 2000 === 0) console.log(`  tires: ${tireCount}`);
}
console.log(`Tires imported: ${tireCount}`);

await client.end();
console.log("Done.");
