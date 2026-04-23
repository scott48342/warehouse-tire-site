import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const resultsDir = './results';

const files = readdirSync(resultsDir).filter(f => f.endsWith('-results.json'));

console.log('=== FLAGGED ITEMS FOR REVIEW ===\n');

let totalComplete = 0;
let totalDNE = 0;
let totalFlagged = 0;

for (const file of files.sort()) {
  const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'));
  const results = data.results || [];
  
  const complete = results.filter(r => r.status === 'complete').length;
  const dne = results.filter(r => r.status === 'dne' || r.status === 'invalid' || r.status === 'not_produced' || r.status === 'duplicate').length;
  const flagged = results.filter(r => r.confidence === 'medium' || r.needsReview || r.flagged);
  
  totalComplete += complete;
  totalDNE += dne;
  totalFlagged += flagged.length;
  
  if (flagged.length > 0) {
    console.log(`\n### ${file} (${flagged.length} flagged)`);
    for (const item of flagged) {
      console.log(`\n${item.year} ${item.make} ${item.model}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  Confidence: ${item.confidence}`);
      if (item.data) {
        console.log(`  Bolt: ${item.data.bolt_pattern}, Hub: ${item.data.hub_bore}mm`);
      }
      console.log(`  Notes: ${item.notes || 'none'}`);
      console.log(`  Sources: ${(item.sources || []).join(', ')}`);
    }
  }
}

console.log('\n\n=== SUMMARY ===');
console.log(`Total Complete: ${totalComplete}`);
console.log(`Total DNE/Invalid: ${totalDNE}`);
console.log(`Total Flagged: ${totalFlagged}`);
console.log(`Import Ready: ${totalComplete} vehicles`);
