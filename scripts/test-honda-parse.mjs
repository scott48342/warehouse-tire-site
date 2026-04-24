import fs from "fs";
import path from "path";

const COMPLETED_DIR = "scripts/trim-research/completed";

const hondaDir = path.join(COMPLETED_DIR, "Honda");
const files = fs.readdirSync(hondaDir).filter(f => f.endsWith('.json'));

console.log("Testing Honda file parsing...\n");

for (const file of files) {
  const filePath = path.join(hondaDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const data = JSON.parse(content);
    
    let years = [];
    
    if (Array.isArray(data.years)) {
      years = data.years;
      console.log(`${file}: Array format - ${data.years.length} years`);
    } else if (data.years && typeof data.years === 'object') {
      for (const [yearStr, yearData] of Object.entries(data.years)) {
        const year = parseInt(yearStr);
        if (!isNaN(year) && yearData.trims) {
          years.push({ year, trims: yearData.trims });
        }
      }
      console.log(`${file}: Object format - ${years.length} years parsed`);
    } else if (data.year && data.trims) {
      years.push({ year: data.year, trims: data.trims });
      console.log(`${file}: Simple format - year ${data.year}`);
    } else if (data.trims) {
      years.push({ year: 2024, trims: data.trims });
      console.log(`${file}: No year format - using 2024`);
    } else {
      console.log(`${file}: UNKNOWN FORMAT - keys: ${Object.keys(data).join(', ')}`);
    }
    
    // Try iteration
    for (const yearData of years) {
      if (yearData.trims) {
        // ok
      }
    }
    console.log(`  ✓ Iteration works, ${years.length} year entries`);
    
  } catch (e) {
    console.log(`${file}: ERROR - ${e.message}`);
  }
}
