// Direct test against Tirewire SOAP API
// Uses hardcoded decrypted values to bypass DB issues

const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

// These are the decrypted values from the DB
// access_key: d80ec567ad1683d4c7c0727aa4ba53... (truncated in preview)
// group_token: e1664d735bfcaa7b4684cf24aa0670... (truncated in preview)

// We need the full values - let me decrypt them properly
import crypto from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

function getEncryptionKey() {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function decrypt(encrypted) {
  try {
    const [ivHex, data] = encrypted.split(":");
    if (!ivHex || !data) return encrypted;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.log("Decrypt error:", e.message);
    return encrypted;
  }
}

// From DB query - full encrypted values
const encryptedAccessKey = process.argv[2];
const encryptedGroupToken = process.argv[3];
const connectionId = parseInt(process.argv[4] || "488677"); // ATD default

if (!encryptedAccessKey || !encryptedGroupToken) {
  console.log("Usage: node test-tirewire-direct.mjs <encrypted_access_key> <encrypted_group_token> [connection_id]");
  console.log("\nOr testing with connection ID only (needs DB)...");
  
  // Let's try with fetch from DB
  testFromDB();
} else {
  const accessKey = decrypt(encryptedAccessKey);
  const groupToken = decrypt(encryptedGroupToken);
  testAPI(accessKey, groupToken, connectionId);
}

async function testFromDB() {
  const pg = await import('pg');
  const { Pool } = pg.default;
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const { rows: configRows } = await pool.query('SELECT key, value FROM tireweb_config');
    const accessKeyRow = configRows.find(r => r.key === 'access_key');
    const groupTokenRow = configRows.find(r => r.key === 'group_token');
    
    const accessKey = decrypt(accessKeyRow.value);
    const groupToken = decrypt(groupTokenRow.value);
    
    console.log("Decrypted credentials:");
    console.log("  accessKey length:", accessKey.length);
    console.log("  groupToken length:", groupToken.length);
    console.log("  accessKey:", accessKey);
    console.log("  groupToken:", groupToken);
    
    // Test all 3 connections
    const { rows: connRows } = await pool.query('SELECT provider, connection_id FROM tireweb_connections WHERE enabled = true');
    
    for (const conn of connRows) {
      console.log(`\n=== Testing ${conn.provider} (${conn.connection_id}) ===`);
      await testAPI(accessKey, groupToken, conn.connection_id);
    }
  } finally {
    await pool.end();
  }
}

async function testAPI(accessKey, groupToken, connectionId) {
  const tireSize = "2755520"; // 275/55R20
  
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${accessKey}</prod:AccessKey>
        <prod:GroupToken>${groupToken}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${tireSize}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

  console.log("Calling Tirewire API...");
  console.log("  URL:", PRODUCTS_SERVICE_URL);
  console.log("  ConnectionID:", connectionId);
  console.log("  TireSize:", tireSize);
  
  try {
    const res = await fetch(PRODUCTS_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTires',
      },
      body: soapBody,
    });
    
    console.log("Response status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response length:", text.length);
    
    // Check for error
    const faultMatch = text.match(/<faultstring>([^<]*)<\/faultstring>/);
    if (faultMatch) {
      console.log("SOAP Fault:", faultMatch[1]);
    }
    
    const msgMatch = text.match(/<Message>([^<]*)<\/Message>/);
    if (msgMatch) {
      console.log("API Message:", msgMatch[1]);
    }
    
    // Count tires
    const tireCount = (text.match(/<Tire>/g) || []).length;
    console.log("Tires found:", tireCount);
    
    if (tireCount === 0 && text.length < 2000) {
      console.log("\nFull response:\n", text);
    } else if (tireCount > 0) {
      // Show first tire
      const firstTire = text.match(/<Tire>([\s\S]*?)<\/Tire>/);
      if (firstTire) {
        console.log("\nFirst tire (truncated):", firstTire[0].slice(0, 500));
      }
    }
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}
