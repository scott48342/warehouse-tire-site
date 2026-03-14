import fs from "node:fs";
import path from "node:path";
import pg from "pg";

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
const dataDir = argv[0] ? path.resolve(argv[0]) : path.resolve(process.cwd(), "..", "..");

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

  let count = 0;
  for (const r of rows) {
    const sku = String(r.PartNumber || r.sku || r.SKU || "").trim();
    if (!sku) continue;

    // Determine run date (may be like "03/14/2026 10:10:00 PM")
    // We'll store null if parsing fails; better than crashing.
    let runDate = null;
    if (r.RunDate) {
      const d = new Date(r.RunDate);
      if (!Number.isNaN(d.getTime())) runDate = d.toISOString();
    }

    // Scott confirmed we only need total available.
    const total = intish(r.TotalQOH);
    await client.query(
      `insert into wp_inventory (sku, product_type, location_id, qoh, run_date, updated_at)
       values ($1,$2,'TOTAL',$3,$4, now())
       on conflict (sku, product_type, location_id) do update set
         qoh=excluded.qoh,
         run_date=excluded.run_date,
         updated_at=now()
      `,
      [sku, productType, total, runDate]
    );

    count++;
    if (count % 5000 === 0) console.log(`  ${productType}: ${count}`);
  }

  console.log(`${productType} SKUs processed: ${count}`);
}

await importFile(wheelJson, "wheel");
await importFile(tireJson, "tire");
await importFile(accJson, "accessory");

await client.end();
console.log("Done.");
