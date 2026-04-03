import pg from 'pg';
import crypto from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;

// ============ Encryption ============
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
  } catch {
    return encrypted;
  }
}

// ============ SOAP ============
const PRODUCTS_SERVICE_URL = "http://ws.tirewire.com/connectionscenter/productsservice.asmx";

function buildGetTiresRequest(accessKey, groupToken, connectionId, tireSize) {
  return `<?xml version="1.0" encoding="utf-8"?>
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
}

async function test() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get credentials
    const { rows: configRows } = await pool.query('SELECT key, value FROM tireweb_config');
    const accessKeyRow = configRows.find(r => r.key === 'access_key');
    const groupTokenRow = configRows.find(r => r.key === 'group_token');
    
    if (!accessKeyRow || !groupTokenRow) {
      console.log('Missing credentials in tireweb_config');
      return;
    }
    
    const accessKey = decrypt(accessKeyRow.value);
    const groupToken = decrypt(groupTokenRow.value);
    
    console.log('Decrypted credentials:');
    console.log('  accessKey:', accessKey.slice(0, 10) + '...' + accessKey.slice(-5));
    console.log('  groupToken:', groupToken.slice(0, 10) + '...' + groupToken.slice(-5));
    
    // Get connections
    const { rows: connRows } = await pool.query('SELECT provider, connection_id FROM tireweb_connections WHERE enabled = true');
    console.log('\nEnabled connections:', connRows);
    
    // Test ATD (first one)
    const atd = connRows.find(r => r.provider === 'tireweb_atd');
    if (atd) {
      console.log('\nTesting ATD (connection_id:', atd.connection_id, ')...');
      
      const soapBody = buildGetTiresRequest(accessKey, groupToken, atd.connection_id, '2755520');
      console.log('Request size:', soapBody.length, 'bytes');
      
      const res = await fetch(PRODUCTS_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTires',
        },
        body: soapBody,
      });
      
      console.log('Response status:', res.status);
      const text = await res.text();
      console.log('Response length:', text.length);
      console.log('Response preview:', text.slice(0, 500));
      
      // Check for tires
      const tireCount = (text.match(/<Tire>/g) || []).length;
      console.log('Tire count:', tireCount);
      
      // Check for error message
      const msgMatch = text.match(/<Message>([^<]*)<\/Message>/);
      if (msgMatch) console.log('Message:', msgMatch[1]);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
