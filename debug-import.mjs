import Client from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';

const SFTP_CONFIG = {
  host: 'sftp.wheelpros.com',
  port: 22,
  username: 'Warehouse1',
  password: 'Websters1!',
};

// Import the same parsing patterns
const MODEL_PATTERNS = [
  { pattern: /GM\s*2500\s*[\/&]\s*3500/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
  { pattern: /(?:GM|CHEVY|GMC|CHEVY\s*\/\s*GMC)\s+HD(?!\w)/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
];

const YEAR_PATTERNS = [
  { re: /[''](\d{2})\s*[-–]\s*['']?(\d{2})(?!\d)/g, type: '2digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{4})/g, type: '4digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/g, type: 'mixed' },
  { re: /(\d{4})\s*\+/g, type: 'plus' },
  { re: /(\d{4})\s*[-–]\s*(?:CURRENT|PRESENT|NEWER|NEW|UP)/gi, type: 'open' },
  { re: /(\d{2})\s*[-–]\s*(?:UP|CURRENT|PRESENT)/gi, type: '2digit-open' },
];

function parseYears(desc) {
  for (const { re, type } of YEAR_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(desc);
    if (match) {
      let y1, y2;
      if (type === '2digit') {
        y1 = parseInt(match[1]);
        y2 = parseInt(match[2]);
        y1 = y1 >= 50 ? 1900 + y1 : 2000 + y1;
        y2 = y2 >= 50 ? 1900 + y2 : 2000 + y2;
      } else if (type === '2digit-open') {
        y1 = parseInt(match[1]);
        y1 = y1 >= 50 ? 1900 + y1 : 2000 + y1;
        y2 = 2026;
      } else if (type === 'plus' || type === 'open') {
        y1 = parseInt(match[1]);
        y2 = 2026;
      } else if (type === '4digit') {
        y1 = parseInt(match[1]);
        y2 = parseInt(match[2]);
      } else if (type === 'mixed') {
        y1 = parseInt(match[1]);
        y2 = parseInt(match[2]);
        const century = Math.floor(y1 / 100) * 100;
        y2 = century + y2;
      }
      return { yearStart: y1, yearEnd: y2, matched: match[0], type };
    }
  }
  return null;
}

// Connect to SFTP
const sftp = new Client();
await sftp.connect(SFTP_CONFIG);

const commonCsv = await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv');
await sftp.end();

const commonRows = parse(commonCsv, { columns: true, skip_empty_lines: true });

// Check specific SKUs
const targetSkus = ['42-30660', '88-33200', '44-30620', '44-30820', '42-30640'];

console.log('Checking SKUs from CommonFeed:\n');
for (const sku of targetSkus) {
  const row = commonRows.find(r => r.PartNumber === sku);
  if (row) {
    const desc = row.PartDescription;
    console.log(`SKU: ${sku}`);
    console.log(`  Desc: ${desc}`);
    
    // Check vehicle match
    let vehicle = null;
    for (const mp of MODEL_PATTERNS) {
      const m = desc.match(mp.pattern);
      if (m) {
        vehicle = { make: mp.make, model: typeof mp.model === 'function' ? mp.model(m) : mp.model };
        break;
      }
    }
    console.log(`  Vehicle: ${vehicle ? `${vehicle.make} ${vehicle.model}` : 'NOT MATCHED'}`);
    
    // Check year match
    const years = parseYears(desc);
    console.log(`  Years: ${years ? `${years.yearStart}-${years.yearEnd} (matched: "${years.matched}", type: ${years.type})` : 'NOT MATCHED'}`);
    console.log();
  }
}
