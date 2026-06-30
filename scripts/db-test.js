const pg = require("pg");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf8");
let url = "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^POSTGRES_URL="([^"]+)"/);
  if (m) { url = m[1]; break; }
}

// Try without SSL
const cleanUrl = url.replace("?sslmode=require", "");
console.log("Testing URL (no SSL):", cleanUrl.replace(/:[^:@]+@/, ":***@"));

const client = new pg.Client({ connectionString: cleanUrl });
client.connect()
  .then(() => client.query("SELECT COUNT(*) FROM wp_wheels"))
  .then(r => { console.log("wp_wheels count:", r.rows[0].count); return client.query("SELECT COUNT(*) FROM wheel1_products"); })
  .then(r => { console.log("wheel1_products count:", r.rows[0].count); return client.end(); })
  .catch(e => {
    console.error("No-SSL failed:", e.message);
    // Try with SSL
    const sslClient = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    return sslClient.connect()
      .then(() => sslClient.query("SELECT COUNT(*) FROM wp_wheels"))
      .then(r => { console.log("SSL connected! wp_wheels count:", r.rows[0].count); return sslClient.end(); })
      .catch(e2 => console.error("SSL also failed:", e2.message));
  });
