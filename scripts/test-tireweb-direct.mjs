/**
 * Direct test of TireWeb SOAP API
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const accessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const groupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

console.log('Testing TireWeb SOAP API...');
console.log('Access Key:', accessKey?.substring(0, 10) + '...');
console.log('Group Token:', groupToken?.substring(0, 10) + '...');

// Get connection IDs from database
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function getConnections() {
  try {
    const result = await pool.query(`
      SELECT provider, connection_id, enabled 
      FROM tireweb_connections 
      WHERE enabled = true
      ORDER BY provider
    `);
    return result.rows;
  } catch (err) {
    console.log('Could not query connections from DB:', err.message);
    // Fallback to known connection IDs
    return [
      { provider: 'ATD', connection_id: 488677, enabled: true },
      { provider: 'NTW', connection_id: 488546, enabled: true },
    ];
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function queryTireWeb(connectionId, tireSize) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(accessKey)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(tireSize)}</prod:TireSize>
        <prod:DetailLevel>100</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch('http://ws.tirewire.com/connectionscenter/productsservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTires',
    },
    body: soapBody,
  });

  return { status: res.status, statusText: res.statusText, body: await res.text() };
}

async function main() {
  const connections = await getConnections();
  console.log('\nFound connections:', connections.map(c => `${c.provider}(${c.connection_id})`).join(', '));

  const tireSize = '2256016'; // 225/60R16
  console.log(`\nSearching for size: ${tireSize}`);

  for (const conn of connections.slice(0, 1)) { // Test first connection only
    console.log(`\n--- ${conn.provider} (ID: ${conn.connection_id}) ---`);
    
    try {
      const { status, statusText, body } = await queryTireWeb(conn.connection_id, tireSize);
      console.log('Response:', status, statusText);
      console.log('Body length:', body.length);
      
      // Show raw response for debugging (first 2000 chars)
      console.log('\nRaw response (truncated):');
      console.log(body.substring(0, 2000));
      
      // Check for different tire structures
      const tireCount1 = (body.match(/<Tire>/gi) || []).length;
      const tireCount2 = (body.match(/<Product>/gi) || []).length;
      const tireCount3 = (body.match(/<TireProduct>/gi) || []).length;
      console.log('\n<Tire> count:', tireCount1);
      console.log('<Product> count:', tireCount2);
      console.log('<TireProduct> count:', tireCount3);
      
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
  
  await pool.end();
}

main().catch(console.error);
