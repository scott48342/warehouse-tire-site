/** READ-ONLY: proof + WheelPros wheel inventory reality check via wp_inventory + techfeed file. */
let pgmod;
try { pgmod = require("pg"); } catch { pgmod = require("F:/clawd/warehouse-tire-site/node_modules/pg"); }
const { Client } = pgmod;
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

(async () => {
  const c = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // proof
  const ro = await c.query("SHOW default_transaction_read_only");
  console.log("default_transaction_read_only =", ro.rows[0].default_transaction_read_only);
  try {
    await c.query("BEGIN");
    await c.query("UPDATE wp_inventory SET qoh = qoh WHERE false");
    console.log("PROOF FAILED: UPDATE accepted");
  } catch (e) { console.log("PROOF OK:", e.message); }
  try { await c.query("ROLLBACK"); } catch {}

  // wp_inventory wheel columns
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='wp_inventory' ORDER BY ordinal_position`
  );
  console.log("wp_inventory.columns:", cols.rows.map(r => r.column_name).join(","));

  // freshness
  const fresh = await c.query(
    `SELECT product_type, max(updated_at) AS max_updated, max(run_date) AS max_run, count(*)::int AS n
     FROM wp_inventory WHERE location_id='TOTAL' GROUP BY 1`
  );
  console.log("wp_inventory.freshness:", JSON.stringify(fresh.rows));

  // wheels qoh>=4
  const w4 = await c.query(
    `SELECT count(*)::int AS n FROM wp_inventory WHERE product_type='wheel' AND location_id='TOTAL' AND qoh >= 4`
  );
  console.log("wp_inventory.wheels_qoh_ge4:", JSON.stringify(w4.rows));

  // intersect with techfeed (image + msrp/map for pricing)
  const fp = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString("utf8"));
  const bySku = data.bySku || {};
  const inv = await c.query(
    `SELECT sku, qoh FROM wp_inventory WHERE product_type='wheel' AND location_id='TOTAL' AND qoh >= 4`
  );
  let eligible = 0, noImage = 0, noPrice = 0, notInTechfeed = 0;
  const brandCount = new Map();
  for (const row of inv.rows) {
    const w = bySku[row.sku];
    if (!w) { notInTechfeed++; continue; }
    const img = (w.images || [])[0];
    if (!img) { noImage++; continue; }
    const msrp = Number(w.msrp) || 0;
    const map = Number(w.map_price) || 0;
    if (msrp <= 0 && map <= 0) { noPrice++; continue; }
    eligible++;
    const b = (w.brand_desc || w.brand_cd || "?").toUpperCase();
    brandCount.set(b, (brandCount.get(b) || 0) + 1);
  }
  console.log(`wheelpros.wheels: inv_ge4=${inv.rows.length} eligible(img+price)=${eligible} notInTechfeed=${notInTechfeed} noImage=${noImage} noPrice=${noPrice}`);
  const top = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("wheelpros.top_brands:", JSON.stringify(top));

  await c.end();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
