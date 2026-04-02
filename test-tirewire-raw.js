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

function decrypt(encrypted) {
  const [ivHex, data] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

(async () => {
  // Get credentials
  const { rows: configRows } = await pool.query("SELECT key, value FROM tireweb_config");
  const accessKey = decrypt(configRows.find(r => r.key === 'access_key').value);
  const groupToken = decrypt(configRows.find(r => r.key === 'group_token').value);
  
  console.log('Access Key:', accessKey);
  console.log('Group Token:', groupToken);
  
  // Build SOAP request
  const connectionId = 488677; // ATD
  const tireSize = "1956015";
  
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(accessKey)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(tireSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

  console.log('\nSOAP Request (first 500 chars):\n', soapBody.slice(0, 500));
  
  const res = await fetch("http://ws.tirewire.com/connectionscenter/productsservice.asmx", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ws.tirewire.com/connectionscenter/productsservice/GetTires",
    },
    body: soapBody,
  });
  
  console.log('\nResponse status:', res.status, res.statusText);
  
  const text = await res.text();
  console.log('\nResponse (first 2000 chars):\n', text.slice(0, 2000));
  
  // Check for tire elements
  const tireCount = (text.match(/<Tire>/g) || []).length;
  console.log('\n<Tire> elements found:', tireCount);
  
  pool.end();
})();
