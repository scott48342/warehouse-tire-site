import fs from 'fs';
let src = fs.readFileSync('scripts/coverage-audit/05-package-gap-trace.mjs', 'utf8');
src = src.replace(`if (v.year < 1990) { results.push({ id: v.id, year: v.year, make: v.make, model: v.model, stage: 'route_year_gate', detail: 'API rejects year<1990' }); continue; }`, '// year gate disabled for recovery estimate');
src = src.replaceAll('package-gap-trace.json', 'package-gap-trace-nogate.json');
fs.writeFileSync('scripts/coverage-audit/05b-trace-nogate.mjs', src);
console.log('written');
