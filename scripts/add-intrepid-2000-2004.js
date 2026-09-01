/**
 * Add Dodge Intrepid 2000-2004 fitment records (2nd gen ran 1998-2004;
 * DB previously stopped at 1999).
 *
 * Sources: tiresize.com (approved), cross-checked with Goodyear OEM lookup
 * and AutoPadre. LH platform: 5x114.3, 71.5mm hub, M12x1.5 (matches our
 * existing 1993-1999 Intrepid + Chrysler Concorde records).
 *
 * Usage: node scripts/add-intrepid-2000-2004.js [--dry-run]
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/POSTGRES_URL="?([^\r\n"]+)/)[1];

const W16 = [{ axle: "both", width: 7, offset: 40, diameter: 16 }];
const W17 = [{ axle: "both", width: 7, offset: 42, diameter: 17 }];
const T16 = ["225/60R16"];
const T17 = ["225/55R17"];

// year, trim, wheels, tires
const RECORDS = [
  [2000, "Base", W16, T16],
  [2000, "ES", W16, T16],
  [2000, "R/T", W17, T17],
  [2001, "SE", W16, T16],
  [2001, "ES", W16, T16],
  [2001, "R/T", W17, T17],
  [2002, "SE", W16, T16],
  [2002, "ES", W16, T16],
  [2002, "SXT", W16, T16],
  [2002, "R/T", W17, T17],
  [2003, "SE", W16, T16],
  [2003, "ES", W16, T16],
  [2003, "SXT", W16, T16],
  [2004, "SE", W16, T16],
  [2004, "ES", W16, T16],
  [2004, "SXT", W16, T16],
];

function slugTrim(trim) {
  return trim.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();

  let inserted = 0, skipped = 0;
  for (const [year, trim, wheels, tires] of RECORDS) {
    const modId = `${year}-dodge-intrepid-${slugTrim(trim)}`;
    const existing = await c.query(
      "SELECT id FROM vehicle_fitments WHERE modification_id = $1 OR (year=$2 AND make ILIKE 'dodge' AND model='Intrepid' AND display_trim=$3)",
      [modId, year, trim]
    );
    if (existing.rowCount > 0) {
      console.log(`SKIP (exists): ${modId}`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`DRY-RUN would insert: ${modId} wheels=${JSON.stringify(wheels)} tires=${JSON.stringify(tires)}`);
      inserted++;
      continue;
    }
    await c.query(
      `INSERT INTO vehicle_fitments
        (id, year, make, model, modification_id, display_trim,
         bolt_pattern, center_bore_mm, thread_size,
         offset_min_mm, offset_max_mm,
         oem_wheel_sizes, oem_tire_sizes,
         source, quality_tier, confidence_tag,
         created_at, updated_at)
       VALUES
        (gen_random_uuid(), $1, 'Dodge', 'Intrepid', $2, $3,
         '5x114.3', 71.5, 'M12x1.5',
         27.00, 55.00,
         $4::jsonb, $5::jsonb,
         'intrepid-gap-fill-2026-08-31', 'complete', 'MEDIUM',
         NOW(), NOW())`,
      [year, modId, trim, JSON.stringify(wheels), JSON.stringify(tires)]
    );
    console.log(`INSERTED: ${modId}`);
    inserted++;
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped} dryRun=${DRY_RUN}`);

  // Verify
  const v = await c.query(
    "SELECT year, display_trim, oem_tire_sizes FROM vehicle_fitments WHERE make ILIKE 'dodge' AND model='Intrepid' ORDER BY year, display_trim"
  );
  console.log(`\nAll Intrepid rows now (${v.rowCount}):`);
  v.rows.forEach((r) => console.log(` ${r.year} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`));
  await c.end();
})().catch((e) => { console.error("ERR:", e); process.exit(1); });
