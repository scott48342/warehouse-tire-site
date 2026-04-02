require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const pg = require('pg');

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

function getEncryptionKey() {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  console.log('Using encryption key source:', process.env.CREDENTIALS_KEY ? 'CREDENTIALS_KEY' : process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD' : 'default');
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function decrypt(encrypted) {
  try {
    const [ivHex, data] = encrypted.split(":");
    if (!ivHex || !data) {
      console.log('  Not encrypted (no colon separator)');
      return encrypted;
    }
    console.log('  IV hex length:', ivHex.length);
    console.log('  Data length:', data.length);
    
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.log('  Decryption failed:', err.message);
    return encrypted;
  }
}

(async () => {
  const { rows } = await pool.query("SELECT key, value FROM tireweb_config");
  
  for (const row of rows) {
    console.log('\n' + row.key + ':');
    console.log('  Raw length:', row.value.length);
    const decrypted = decrypt(row.value);
    console.log('  Decrypted length:', decrypted.length);
    console.log('  Decrypted preview:', decrypted.slice(0, 10) + '...');
  }
  
  pool.end();
})();
