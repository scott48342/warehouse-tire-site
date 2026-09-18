// R1 proof: is the preview connection string enforcing read-only at the session level?
// Read-only by construction: SHOW + a write attempt inside a transaction that is always rolled back.
import pg from "pg";
const url = process.env.POSTGRES_URL;
if (!url) { console.log("POSTGRES_URL missing"); process.exit(2); }
const u = new URL(url);
console.log("options param:", u.searchParams.get("options"));
const pool = new pg.Pool({ connectionString: url, max: 1 });
const c = await pool.connect();
try {
  const r1 = await c.query("SHOW default_transaction_read_only");
  console.log("default_transaction_read_only =", r1.rows[0].default_transaction_read_only);
  const r2 = await c.query("SELECT current_user, rolsuper, rolcreatedb FROM pg_roles WHERE rolname = current_user");
  console.log("role:", r2.rows[0]);
  const before = await c.query("SELECT count(*)::int AS n, max(created_at) AS mx FROM tireweb_sku_cache");
  console.log("tireweb_sku_cache before:", before.rows[0]);
  await c.query("BEGIN");
  try {
    await c.query("UPDATE tireweb_sku_cache SET created_at = created_at WHERE false");
    console.log("WRITE ATTEMPT: ALLOWED (session is NOT read-only)");
  } catch (e) {
    console.log("WRITE ATTEMPT: BLOCKED ->", e.message);
  } finally {
    await c.query("ROLLBACK");
  }
} finally {
  c.release();
  await pool.end();
}
