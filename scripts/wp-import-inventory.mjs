import fs from "node:fs";
import path from "node:path";
import pg from "pg";

import { inTransaction } from "./_pg-batch.mjs";

const { Client } = pg;

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function intish(v) {
  const n = Number(String(v ?? "").trim() || 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const DATABASE_URL = required("DATABASE_URL");

const argv = process.argv.slice(2);
// Directory containing WheelPros inventory feed files (wheelInvPriceData.json, tireInvPriceData.json, accessoriesInvPriceData.json)
// Default: current working directory.
const dataDir = argv[0] ? path.resolve(argv[0]) : path.resolve(process.cwd());

const wheelJson = path.join(dataDir, "wheelInvPriceData.json");
const tireJson = path.join(dataDir, "tireInvPriceData.json");
const accJson = path.join(dataDir, "accessoriesInvPriceData.json");

for (const p of [wheelJson, tireJson, accJson]) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

async function importFile(filePath, productType) {
  console.log(`Loading ${productType} inventory JSON: ${path.basename(filePath)}`);
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`Rows: ${rows.length}`);

  const BATCH = 5000;
  let count = 0;

  let skus = [];
  let qohs = [];
  let runDates = [];

  async function flush() {
    if (!skus.length) return;

    // Use UNNEST to upsert many rows in one round-trip.
    // run_date is text->timestamptz cast; nulls are ok.
    await client.query(
      `insert into wp_inventory (sku, product_type, location_id, qoh, run_date, updated_at)
       select sku, $1::text, 'TOTAL', qoh, run_date::timestamptz, now()
       from unnest($2::text[], $3::int4[], $4::text[]) as t(sku, qoh, run_date)
       on conflict (sku, product_type, location_id) do update set
         qoh=excluded.qoh,
         run_date=excluded.run_date,
         updated_at=now()`,
      [productType, skus, qohs, runDates]
    );

    skus = [];
    qohs = [];
    runDates = [];
  }

  for (const r of rows) {
    const sku = String(r.PartNumber || r.sku || r.SKU || "").trim();
    if (!sku) continue;

    // Determine run date (may be like "03/14/2026 10:10:00 PM")
    let runDate = "";
    if (r.RunDate) {
      const d = new Date(r.RunDate);
      if (!Number.isNaN(d.getTime())) runDate = d.toISOString();
    }

    skus.push(sku);
    qohs.push(intish(r.TotalQOH));
    runDates.push(runDate);

    count++;
    if (skus.length >= BATCH) {
      await flush();
      console.log(`  ${productType}: ${count}`);
    }
  }

  await flush();
  console.log(`${productType} SKUs processed: ${count}`);
}

await inTransaction(client, async () => {
  await importFile(wheelJson, "wheel");
  await importFile(tireJson, "tire");
  await importFile(accJson, "accessory");
});

await client.end();
console.log("Done.");
