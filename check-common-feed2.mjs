import Client from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';

const sftp = new Client();

const SFTP_CONFIG = {
  host: 'sftp.wheelpros.com',
  port: 22,
  username: 'Warehouse1',
  password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
};

await sftp.connect(SFTP_CONFIG);
console.log('Connected.\n');

const data = await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv');
const text = data.toString('utf8');
const records = parse(text, { columns: true, skip_empty_lines: true });

// Find suspension-related products with HD or 2500/3500 in description
const hdProducts = records.filter(r => {
  const desc = (r.PartDescription || '').toUpperCase();
  return desc.includes('LIFT') || desc.includes('LEVELING') || desc.includes('SUSPENSION');
}).filter(r => {
  const desc = (r.PartDescription || '').toUpperCase();
  return desc.includes('HD') || desc.includes('2500') || desc.includes('3500');
});

console.log(`Found ${hdProducts.length} HD lift/suspension products:\n`);
hdProducts.slice(0, 30).forEach(r => {
  console.log(`${r.PartNumber}: ${r.PartDescription} | ${r.Brand} | $${r.MSRP_USD}`);
});

// Check specific missing SKUs
console.log('\n\n=== Specific SKUs from DealerLine ===\n');
const dealerLineSkus = [
  '42-30660', '88-33200', '44-30620', '44-30820', '42-30640', '44-30621', '44-30821'
];

for (const sku of dealerLineSkus) {
  const found = records.find(r => r.PartNumber === sku);
  if (found) {
    console.log(`${sku}: ${found.PartDescription} | ${found.Brand}`);
  }
}

await sftp.end();
