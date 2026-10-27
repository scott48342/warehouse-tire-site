/**
 * Read-only proof + merchant-feed inventory reality check (READ-ONLY).
 * Run: node --env-file=.env.local scripts/merchant-feed/readonly-proof-and-counts.cjs
 */
let pgmod;
try { pgmod = require("pg"); } catch { pgmod = require("F:/clawd/warehouse-tire-site/node_modules/pg"); }
const { Client } = pgmod;
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

async function main() {
  const c = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // ---- READ-ONLY PROOF ----
  const ro = await c.query("SHOW default_transaction_read_only");
  console.log("default_transaction_read_only =", ro.rows[0].default_transaction_read_only);
  try {
    await c.query("BEGIN");
    await c.query("UPDATE wp_tires SET sku = sku WHERE false");
    console.log("PROOF FAILED: UPDATE was accepted");
    await c.query("ROLLBACK");
  } catch (e) {
    console.log("PROOF OK:", e.message);
    try { await c.query("ROLLBACK"); } catch {}
  }

  // ---- TIRES (WheelPros wp_tires + wp_inventory) ----
  const q = async (label, sql, params = []) => {
    const r = await c.query(sql, params);
    console.log(label, JSON.stringify(r.rows));
    return r.rows;
  };

  await q("tires.total:", "SELECT count(*)::int AS n FROM wp_tires");
  await q(
    "tires.feed_eligible (qoh>=4, image, price):",
    `SELECT count(*)::int AS n
     FROM wp_tires t
     JOIN wp_inventory i ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL'
     WHERE i.qoh >= 4
       AND t.image_url IS NOT NULL AND t.image_url != ''
       AND lower(t.image_url) NOT LIKE '%noimage%'
       AND lower(t.image_url) NOT LIKE '%placeholder%'
       AND (COALESCE(t.msrp_usd,0) > 0 OR COALESCE(t.map_usd,0) > 0)`
  );
  await q(
    "tires.restricted_brands among eligible:",
    `SELECT upper(t.brand_desc) AS brand, count(*)::int AS n
     FROM wp_tires t
     JOIN wp_inventory i ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL'
     WHERE i.qoh >= 4
       AND t.image_url IS NOT NULL AND t.image_url != ''
       AND (COALESCE(t.msrp_usd,0) > 0 OR COALESCE(t.map_usd,0) > 0)
       AND upper(t.brand_desc) ~ 'PIRELLI|BRIDGESTONE|GOODYEAR|MICHELIN'
     GROUP BY 1 ORDER BY 2 DESC`
  );
  await q(
    "tires.top_brands eligible:",
    `SELECT upper(t.brand_desc) AS brand, count(*)::int AS n
     FROM wp_tires t
     JOIN wp_inventory i ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL'
     WHERE i.qoh >= 4
       AND t.image_url IS NOT NULL AND t.image_url != ''
       AND (COALESCE(t.msrp_usd,0) > 0 OR COALESCE(t.map_usd,0) > 0)
     GROUP BY 1 ORDER BY 2 DESC LIMIT 10`
  );

  // wp_inventory: what product types exist (are wheels in Postgres at all?)
  await q(
    "wp_inventory.product_types:",
    `SELECT product_type, count(*)::int AS n FROM wp_inventory WHERE location_id='TOTAL' GROUP BY 1 ORDER BY 2 DESC`
  );

  // ---- WSI wheels ----
  await q("wsi.total:", "SELECT count(*)::int AS n FROM wsi_wheels");
  await q(
    "wsi.feed_eligible (stock>=4, image, price):",
    `SELECT count(*)::int AS n FROM wsi_wheels
     WHERE (COALESCE(wsi_stock,0) + COALESCE(alt_stock,0)) >= 4
       AND image_url IS NOT NULL AND image_url != ''
       AND (COALESCE(catalog_price,0) > 0 OR COALESCE(dealer_cost,0) > 0)`
  );
  await q(
    "wsi.in_stock_any (>=1):",
    `SELECT count(*)::int AS n FROM wsi_wheels
     WHERE (COALESCE(wsi_stock,0) + COALESCE(alt_stock,0)) >= 1`
  );

  // ---- Wheel-1 ----
  await q("wheel1.total (not discontinued):", "SELECT count(*)::int AS n FROM wheel1_products WHERE is_discontinued = FALSE");
  await q(
    "wheel1.feed_eligible (qty>=4, image, price):",
    `SELECT count(*)::int AS n FROM wheel1_products
     WHERE is_discontinued = FALSE
       AND COALESCE(inventory_qty,0) >= 4
       AND image1 IS NOT NULL AND image1 != ''
       AND (COALESCE(msrp,0) > 0 OR COALESCE(dealer_cost,0) > 0 OR COALESCE(map_price,0) > 0)`
  );
  await q(
    "wheel1.inventory_synced (non-null qty):",
    `SELECT count(*)::int AS n FROM wheel1_products WHERE is_discontinued = FALSE AND inventory_qty IS NOT NULL`
  );

  // ---- supplier_orders: shipping cost forensics (aggregate + key names only) ----
  await q(
    "supplier_orders.by_supplier:",
    `SELECT supplier, status, count(*)::int AS n FROM supplier_orders GROUP BY 1,2 ORDER BY 1,3 DESC`
  );
  // Inspect items_json STRUCTURE for freight/shipping fields (keys only + freight-ish values)
  const rows = await c.query(
    `SELECT supplier, items_json, created_at::date AS d FROM supplier_orders ORDER BY created_at DESC LIMIT 8`
  );
  for (const r of rows.rows) {
    let keys = [];
    let freight = {};
    try {
      const items = Array.isArray(r.items_json) ? r.items_json : (r.items_json.items || [r.items_json]);
      const first = items[0] || {};
      keys = Object.keys(first);
      for (const [k, v] of Object.entries(first)) {
        if (/ship|freight|carrier|deliver/i.test(k)) freight[k] = v;
      }
      if (!Array.isArray(r.items_json)) {
        for (const [k, v] of Object.entries(r.items_json)) {
          if (/ship|freight|carrier|deliver/i.test(k) && typeof v !== "object") freight[k] = v;
        }
      }
    } catch (e) { keys = ["<parse error>"]; }
    console.log(`supplier_orders.sample supplier=${r.supplier} date=${r.d} itemKeys=${JSON.stringify(keys)} freightish=${JSON.stringify(freight)}`);
  }

  // ---- WheelPros techfeed wheel SKU count (file-based) ----
  try {
    const fp = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = fs.readFileSync(fp);
    const data = JSON.parse(zlib.gunzipSync(buf).toString("utf8"));
    const skus = Object.keys(data.bySku || {});
    let withImage = 0;
    for (const s of skus) { if ((data.bySku[s].images || [])[0]) withImage++; }
    console.log(`techfeed.wheel_skus_total=${skus.length} with_image=${withImage} (in-stock qty requires Redis wt:inv:* — counted separately)`);
  } catch (e) {
    console.log("techfeed read failed:", e.message);
  }

  await c.end();
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
