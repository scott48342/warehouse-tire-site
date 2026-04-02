require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const pg = require('pg');

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

function getEncryptionKey() {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

(async () => {
  const accessKey = "88da35e5e34e487d857e19796e1c4cd1";
  const groupToken = "062016053140195130236092063000161188036119245215046012029007224056229125172170174199020018062063";
  
  console.log('Encrypting credentials...');
  const encAccessKey = encrypt(accessKey);
  const encGroupToken = encrypt(groupToken);
  
  console.log('Updating database...');
  
  await pool.query(
    "UPDATE tireweb_config SET value = $1, updated_at = NOW() WHERE key = 'access_key'",
    [encAccessKey]
  );
  console.log('  access_key updated');
  
  await pool.query(
    "UPDATE tireweb_config SET value = $1, updated_at = NOW() WHERE key = 'group_token'",
    [encGroupToken]
  );
  console.log('  group_token updated');
  
  // Verify
  console.log('\nVerifying decryption...');
  const { rows } = await pool.query("SELECT key, value FROM tireweb_config");
  
  for (const row of rows) {
    const [ivHex, data] = row.value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    console.log(`  ${row.key}: ${decrypted.slice(0, 8)}... (length: ${decrypted.length})`);
  }
  
  console.log('\nDone!');
  pool.end();
})();
