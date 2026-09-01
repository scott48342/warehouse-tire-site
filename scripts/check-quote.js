const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const p = new Pool({ connectionString: process.env.POSTGRES_URL });

(async () => {
  const r = await p.query(`SELECT id, snapshot_json FROM quotes WHERE id LIKE '626d8110%' LIMIT 1`);
  const snapshot = r.rows[0]?.snapshot_json;
  if (snapshot) {
    console.log("=== FULL QUOTE SNAPSHOT ===");
    console.log(JSON.stringify(snapshot, null, 2));
    console.log("\n=== SERVICE LINES ONLY ===");
    const svcLines = (snapshot.lines || []).filter(l => l.kind === 'catalog');
    console.log(JSON.stringify(svcLines, null, 2));
  } else {
    console.log("Quote not found");
  }
  await p.end();
})();
