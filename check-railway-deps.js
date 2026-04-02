/**
 * Railway Dependency Check
 * Identifies all code paths that use DATABASE_URL (Railway)
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findFiles(dir, ext, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath, ext, files);
    } else if (item.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];
  
  // Check for DATABASE_URL usage
  if (content.includes('DATABASE_URL')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('DATABASE_URL')) {
        results.push({
          file: path.relative(srcDir, filePath),
          line: i + 1,
          content: lines[i].trim().substring(0, 100),
          type: lines[i].includes('required("DATABASE_URL")') ? 'REQUIRED' :
                lines[i].includes('|| process.env.POSTGRES_URL') ? 'FALLBACK' : 'OTHER'
        });
      }
    }
  }
  
  // Check for Railway hostname
  if (content.includes('railway.app') || content.includes('rlwy.net')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('railway.app') || lines[i].includes('rlwy.net')) {
        results.push({
          file: path.relative(srcDir, filePath),
          line: i + 1,
          content: lines[i].trim().substring(0, 100),
          type: 'RAILWAY_HOST'
        });
      }
    }
  }
  
  // Check for legacy table access
  const legacyTables = ['vehicles', 'vehicle_fitment', 'vehicle_wheel_specs', 'vehicle_oem_tire_size'];
  for (const table of legacyTables) {
    const regex = new RegExp(`FROM\\s+${table}|INTO\\s+${table}|UPDATE\\s+${table}`, 'i');
    if (regex.test(content)) {
      results.push({
        file: path.relative(srcDir, filePath),
        line: 0,
        content: `Uses legacy table: ${table}`,
        type: 'LEGACY_TABLE'
      });
    }
  }
  
  return results;
}

console.log('='.repeat(70));
console.log('RAILWAY DEPENDENCY ANALYSIS');
console.log('='.repeat(70));

const tsFiles = findFiles(srcDir, '.ts');
const tsxFiles = findFiles(srcDir, '.tsx');
const allFiles = [...tsFiles, ...tsxFiles];

const allResults = [];
for (const file of allFiles) {
  const results = checkFile(file);
  allResults.push(...results);
}

// Group by type
const required = allResults.filter(r => r.type === 'REQUIRED');
const fallback = allResults.filter(r => r.type === 'FALLBACK');
const legacyTable = allResults.filter(r => r.type === 'LEGACY_TABLE');
const railwayHost = allResults.filter(r => r.type === 'RAILWAY_HOST');

console.log('\n1️⃣ FILES THAT REQUIRE DATABASE_URL (will fail without it):');
if (required.length === 0) {
  console.log('   None found');
} else {
  for (const r of required) {
    console.log(`   ${r.file}:${r.line}`);
    console.log(`      ${r.content}`);
  }
}

console.log('\n2️⃣ FILES WITH FALLBACK (DATABASE_URL || POSTGRES_URL):');
if (fallback.length === 0) {
  console.log('   None found');
} else {
  const uniqueFiles = [...new Set(fallback.map(r => r.file))];
  console.log(`   ${uniqueFiles.length} files (will use POSTGRES_URL when DATABASE_URL is missing)`);
  for (const f of uniqueFiles.slice(0, 10)) {
    console.log(`   - ${f}`);
  }
  if (uniqueFiles.length > 10) console.log(`   ... and ${uniqueFiles.length - 10} more`);
}

console.log('\n3️⃣ FILES USING LEGACY RAILWAY TABLES:');
const legacyFiles = [...new Set(legacyTable.map(r => r.file))];
if (legacyFiles.length === 0) {
  console.log('   None found');
} else {
  for (const f of legacyFiles) {
    console.log(`   - ${f}`);
  }
}

console.log('\n4️⃣ FILES WITH RAILWAY HOSTNAMES:');
if (railwayHost.length === 0) {
  console.log('   None found');
} else {
  for (const r of railwayHost) {
    console.log(`   ${r.file}:${r.line}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`
  Files requiring DATABASE_URL: ${required.length}
  Files with fallback:          ${[...new Set(fallback.map(r => r.file))].length}
  Files using legacy tables:    ${legacyFiles.length}
  Files with Railway hosts:     ${railwayHost.length}
`);

if (required.length === 0) {
  console.log('✅ SAFE TO REMOVE DATABASE_URL');
  console.log('   All code paths either have fallback to POSTGRES_URL or are optional.');
} else {
  console.log('⚠️  CAUTION');
  console.log(`   ${required.length} files require DATABASE_URL and may fail.`);
}
