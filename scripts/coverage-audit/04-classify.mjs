/**
 * Coverage audit step 3: join probe results back to all vehicles,
 * classify A–E, root-cause failures, emit CSVs + JSON + report.
 * READ-ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const vehicles = JSON.parse(fs.readFileSync(path.join(OUT, 'vehicles.json')));
const state = JSON.parse(fs.readFileSync(path.join(OUT, 'probe-state.json')));

const esc = s => {
  s = String(s ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = arr => arr.map(esc).join(',');

let counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const rows = [];
for (const v of vehicles) {
  // tire_count = max availability across this vehicle's modern tire sizes
  let tireCount = 0, tireErr = null;
  for (const s of v.modernTireSizes) {
    const t = state.tires[s];
    if (!t) continue;
    if (t.count > tireCount) tireCount = t.count;
    if (t.count === -1) tireErr = t.err;
  }
  const w = state.wheels[v.wheelClass];
  const wheelCount = w ? Math.max(0, w.count) : 0;
  const wheelErr = w && w.count === -1 ? w.err : null;
  const p = state.packages[v.wheelClass];
  const pkgCount = p ? Math.max(0, p.count) : 0;

  // failure reason / root cause
  let failureReason = '';
  let rootCause = '';
  const hasBolt = !!v.boltPattern;
  const hasBore = Number.isFinite(v.centerBore);
  const hasModernTire = v.modernTireSizes.length > 0;
  const hasAnyTireSize = v.tireSizes.length > 0;
  const hasDiams = v.wheelDiams.length > 0;

  let cls;
  if (!hasBolt && !hasAnyTireSize) {
    cls = 'E'; failureReason = 'no bolt pattern and no tire sizes — cannot resolve'; rootCause = 'missing_bolt_pattern';
  } else if (wheelErr && tireErr) {
    cls = 'E'; failureReason = `probe errors: ${wheelErr}; ${tireErr}`; rootCause = 'code_bug_or_api_error';
  } else if (tireCount > 0 && wheelCount > 0) {
    cls = 'A';
    if (pkgCount === 0) { failureReason = 'tires+wheels OK but no packages'; rootCause = 'package_generation_gap'; }
  } else if (tireCount > 0) {
    cls = 'B';
    if (!hasBolt) { failureReason = 'no bolt pattern — wheel search impossible'; rootCause = 'missing_bolt_pattern'; }
    else if (!hasDiams) { failureReason = 'no OEM wheel diameters parsed'; rootCause = 'missing_wheel_sizes'; }
    else if (wheelErr) { failureReason = `wheel probe error: ${wheelErr}`; rootCause = 'code_bug_or_api_error'; }
    else { failureReason = 'no wheel inventory for bolt/diameter'; rootCause = 'missing_inventory_wheels'; }
  } else if (wheelCount > 0) {
    cls = 'C';
    if (!hasAnyTireSize) { failureReason = 'no OEM tire sizes in record'; rootCause = 'missing_oem_tire_size'; }
    else if (!hasModernTire) { failureReason = `only vintage/non-standard sizes: ${v.tireSizes.slice(0, 3).join(' ')}`; rootCause = 'vintage_tire_size'; }
    else if (tireErr) { failureReason = `tire probe error: ${tireErr}`; rootCause = 'code_bug_or_api_error'; }
    else { failureReason = 'no tire inventory for size(s)'; rootCause = 'missing_inventory_tires'; }
  } else {
    cls = 'D';
    if (!hasAnyTireSize && !hasDiams) { failureReason = 'record has no tire sizes and no wheel sizes'; rootCause = 'missing_oem_tire_size'; }
    else if (!hasModernTire && !hasDiams) { failureReason = 'vintage sizes only, no wheel diameters'; rootCause = 'vintage_tire_size'; }
    else if (!hasModernTire) { failureReason = `vintage sizes only: ${v.tireSizes.slice(0, 3).join(' ')}`; rootCause = 'vintage_tire_size'; }
    else if (!hasBolt) { failureReason = 'missing bolt pattern'; rootCause = 'missing_bolt_pattern'; }
    else if (wheelErr || tireErr) { failureReason = `probe error: ${wheelErr || tireErr}`; rootCause = 'code_bug_or_api_error'; }
    else { failureReason = 'no products for size or bolt/diameter'; rootCause = 'missing_inventory_both'; }
  }
  counts[cls]++;
  rows.push({
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim,
    tire_count: tireCount, wheel_count: wheelCount, package_count: pkgCount,
    category: cls, failure_reason: failureReason, root_cause: rootCause,
    tire_sizes: v.tireSizes.join('|'), bolt_pattern: v.boltPattern,
    wheel_diams: v.wheelDiams.join('|'),
  });
}

// ---- CSV exports ----
const header = ['id', 'year', 'make', 'model', 'trim', 'tire_count', 'wheel_count', 'package_count', 'category', 'failure_reason', 'root_cause', 'tire_sizes', 'bolt_pattern', 'wheel_diams'];
const byCat = { A: 'full-coverage.csv', B: 'tire-only.csv', C: 'wheel-only.csv', D: 'no-products.csv', E: 'lookup-failures.csv' };
for (const [cat, file] of Object.entries(byCat)) {
  const lines = [csvRow(header)];
  for (const r of rows) if (r.category === cat) lines.push(csvRow(header.map(h => r[h])));
  fs.writeFileSync(path.join(OUT, file), lines.join('\n'));
}
const failures = rows.filter(r => r.category !== 'A' || r.package_count === 0);
fs.writeFileSync(path.join(OUT, 'failure-analysis.csv'),
  [csvRow(header), ...failures.map(r => csvRow(header.map(h => r[h])))].join('\n'));

// ---- JSON ----
fs.writeFileSync(path.join(OUT, 'audit-results.json'), JSON.stringify(rows));

// ---- Summary stats ----
const total = rows.length;
const pct = n => (100 * n / total).toFixed(1) + '%';
const causeCounts = {};
for (const r of rows) if (r.root_cause) causeCounts[r.root_cause] = (causeCounts[r.root_cause] || 0) + 1;
const topCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);

const makeFail = {}, modelFail = {};
for (const r of rows) {
  if (r.category === 'A') continue;
  makeFail[r.make] = (makeFail[r.make] || 0) + 1;
  const mk = `${r.make} ${r.model}`;
  modelFail[mk] = (modelFail[mk] || 0) + 1;
}
const topMakes = Object.entries(makeFail).sort((a, b) => b[1] - a[1]).slice(0, 15);
const topModels = Object.entries(modelFail).sort((a, b) => b[1] - a[1]).slice(0, 20);

// Revenue impact: recent vehicles (2015+) not in A, weighted by recency
const revImpact = {};
for (const r of rows) {
  if (r.category === 'A' || r.year < 2015) continue;
  const k = `${r.make} ${r.model}`;
  revImpact[k] = revImpact[k] || { count: 0, years: new Set(), cats: new Set() };
  revImpact[k].count++;
  revImpact[k].years.add(r.year);
  revImpact[k].cats.add(r.category);
}
const topRev = Object.entries(revImpact).sort((a, b) => b[1].count - a[1].count).slice(0, 20)
  .map(([k, v]) => ({ vehicle: k, affected: v.count, years: [...v.years].sort().join(','), categories: [...v.cats].join('') }));

const summary = {
  auditDate: new Date().toISOString(),
  totalVehicles: total,
  categories: {
    A_full_coverage: { count: counts.A, pct: pct(counts.A) },
    B_tire_only: { count: counts.B, pct: pct(counts.B) },
    C_wheel_only: { count: counts.C, pct: pct(counts.C) },
    D_no_products: { count: counts.D, pct: pct(counts.D) },
    E_lookup_failure: { count: counts.E, pct: pct(counts.E) },
  },
  rootCauses: Object.fromEntries(topCauses),
  topFailureMakes: topMakes,
  topFailureModels: topModels,
  revenueImpactTop20: topRev,
  probeStats: {
    tireSizesProbed: Object.keys(state.tires).length,
    tireSizesWithResults: Object.values(state.tires).filter(t => t.count > 0).length,
    wheelClassesProbed: Object.keys(state.wheels).length,
    wheelClassesWithResults: Object.values(state.wheels).filter(w => w.count > 0).length,
    packageClassesProbed: Object.keys(state.packages).length,
    packageClassesWithResults: Object.values(state.packages).filter(p => p.count > 0).length,
  },
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
