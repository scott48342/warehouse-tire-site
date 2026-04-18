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

// Download and check accessoriesInvPriceData.csv
const data = await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv');
const text = data.toString('utf8');
const records = parse(text, { columns: true, skip_empty_lines: true });

console.log(`Total rows: ${records.length}`);
console.log('\nFirst row columns:', Object.keys(records[0]));
console.log('\nSample row:', records[0]);

// Check for our missing SKUs
const dealerLineSkus = [
  '42-30660', '88-33200', '26-3204', '44-30620', '44-30820',
  '42-30640', 'PCSGMLL231', '44-30621', '44-30821'
];

console.log('\n\nChecking missing SKUs:');
for (const sku of dealerLineSkus) {
  const found = records.find(r => r.PartNumber === sku || r.SKU === sku || r.partNumber === sku);
  if (found) {
    console.log(`✅ ${sku}: ${found.Description || found.description || 'no desc'}`);
  } else {
    console.log(`❌ ${sku}: NOT FOUND`);
  }
}

await sftp.end();
