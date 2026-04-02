/**
 * WHEELS + TIRES YMM RESULT GUARANTEE AUDIT
 */

import * as https from 'https';
import * as fs from 'fs';

const PROD_BASE = "https://shop.warehousetiredirect.com";
const DELAY_MS = 50;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface TrimResult { value: string; label: string; modificationId: string; }
interface AuditResult {
  year: number; make: string; model: string; trim: string; modificationId: string;
  classification: 'A' | 'B' | 'C' | 'D' | 'E';
  wheelStatus: { fitmentResolved: boolean; searchReturnsResults: boolean; resultCount: number; error?: string };
  tireStatus: { sizeResolved: boolean; searchReturnsResults: boolean; resultCount: number; error?: string };
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { resolve({ error: 'timeout' }); }, 10000);
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); } catch { resolve({ error: 'parse', raw: data.slice(0,100) }); }
      });
    }).on('error', (e) => { clearTimeout(timeout); resolve({ error: e.message }); });
  });
}

async function getMakes(): Promise<string[]> {
  const data = await fetchJson(`${PROD_BASE}/api/vehicles/makes`);
  return data.results || data || [];
}

async function getModels(make: string): Promise<string[]> {
  const data = await fetchJson(`${PROD_BASE}/api/vehicles/models?make=${encodeURIComponent(make)}`);
  return data.results || data || [];
}

async function getYears(make: string, model: string): Promise<number[]> {
  const data = await fetchJson(`${PROD_BASE}/api/vehicles/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
  const years = data.results || data || [];
  return years.map((y: any) => Number(y)).filter((y: number) => !isNaN(y));
}

async function getTrims(year: number, make: string, model: string): Promise<TrimResult[]> {
  const data = await fetchJson(`${PROD_BASE}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
  return data.results || [];
}

async function testWheelSearch(year: number, make: string, model: string, modificationId: string) {
  const url = `${PROD_BASE}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&page=1&limit=1`;
  const data = await fetchJson(url);
  
  if (data.error || data.fitmentUnavailable || data.message?.includes("unavailable")) {
    const isControlled = data.error?.includes?.("no fitment") || data.error?.includes?.("No fitment") || data.fitmentUnavailable;
    return { fitmentResolved: false, searchReturnsResults: false, resultCount: 0, error: isControlled ? "controlled_no_fitment" : data.error };
  }
  const resultCount = data.pagination?.total || data.results?.length || data.total || 0;
  return { fitmentResolved: true, searchReturnsResults: resultCount > 0, resultCount };
}

async function testTireSearch(year: number, make: string, model: string, modificationId: string) {
  const url = `${PROD_BASE}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&page=1&limit=1`;
  const data = await fetchJson(url);
  
  if (data.error || data.tiresUnavailable || data.message?.includes("unavailable")) {
    const isControlled = data.error?.includes?.("no tire") || data.error?.includes?.("no fitment") || data.tiresUnavailable;
    return { sizeResolved: false, searchReturnsResults: false, resultCount: 0, error: isControlled ? "controlled_no_tires" : data.error };
  }
  const resultCount = data.pagination?.total || data.results?.length || data.total || 0;
  return { sizeResolved: true, searchReturnsResults: resultCount > 0, resultCount };
}

function classify(w: AuditResult['wheelStatus'], t: AuditResult['tireStatus']): 'A' | 'B' | 'C' | 'D' | 'E' {
  const wheelOk = w.fitmentResolved && w.searchReturnsResults;
  const tireOk = t.sizeResolved && t.searchReturnsResults;
  if (wheelOk && tireOk) return 'A';
  if (wheelOk && !tireOk) return 'B';
  if (!wheelOk && tireOk) return 'C';
  if (w.error?.includes("controlled") || t.error?.includes("controlled")) return 'D';
  return 'E';
}

async function runAudit() {
  const startTime = Date.now();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  WHEELS + TIRES YMM RESULT GUARANTEE AUDIT");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const summary = {
    totalCombinations: 0, classifications: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    failures: [] as AuditResult[], unexpectedZeroWheels: [] as AuditResult[], unexpectedZeroTires: [] as AuditResult[],
    topFailuresByMake: {} as Record<string, number>,
  };
  
  console.log("Fetching makes...");
  const makes = await getMakes();
  console.log(`Found ${makes.length} makes\n`);
  
  let processed = 0;
  
  for (const make of makes) {
    console.log(`[${make}] fetching models...`);
    const models = await getModels(make);
    console.log(`[${make}] got ${models.length} models`);
    await sleep(DELAY_MS);
    
    let makeCount = 0;
    for (const model of models) {
      console.log(`  [${make}/${model}] fetching years...`);
      const years = await getYears(make, model);
      console.log(`  [${make}/${model}] got ${years.length} years`);
      await sleep(DELAY_MS);
      
      for (const year of years) {
        const trims = await getTrims(year, make, model);
        await sleep(DELAY_MS);
        
        for (const trim of trims) {
          processed++; makeCount++;
          
          const wheelStatus = await testWheelSearch(year, make, model, trim.modificationId);
          await sleep(DELAY_MS);
          
          const tireStatus = await testTireSearch(year, make, model, trim.modificationId);
          await sleep(DELAY_MS);
          
          const classification = classify(wheelStatus, tireStatus);
          summary.classifications[classification]++;
          
          const result: AuditResult = { year, make, model, trim: trim.label, modificationId: trim.modificationId, classification, wheelStatus, tireStatus };
          
          if (classification === 'E') {
            summary.failures.push(result);
            summary.topFailuresByMake[make] = (summary.topFailuresByMake[make] || 0) + 1;
          }
          if (wheelStatus.fitmentResolved && !wheelStatus.searchReturnsResults && !wheelStatus.error) summary.unexpectedZeroWheels.push(result);
          if (tireStatus.sizeResolved && !tireStatus.searchReturnsResults && !tireStatus.error) summary.unexpectedZeroTires.push(result);
          
          if (processed % 100 === 0) console.log(`    [${processed}] ${year} ${make} ${model} = ${classification}`);
        }
      }
    }
    console.log(`[${make}] done: ${makeCount} trims\n`);
  }
  
  summary.totalCombinations = processed;
  const durationMs = Date.now() - startTime;
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log(`Total combinations: ${summary.totalCombinations}`);
  console.log(`Duration: ${(durationMs / 1000 / 60).toFixed(1)} minutes\n`);
  
  const pct = (n: number) => (n / Math.max(summary.totalCombinations, 1) * 100).toFixed(1);
  console.log("Classifications:");
  console.log(`  A (Both work):         ${summary.classifications.A} (${pct(summary.classifications.A)}%)`);
  console.log(`  B (Wheels ok, no tires): ${summary.classifications.B} (${pct(summary.classifications.B)}%)`);
  console.log(`  C (Tires ok, no wheels): ${summary.classifications.C} (${pct(summary.classifications.C)}%)`);
  console.log(`  D (Controlled unavail):  ${summary.classifications.D} (${pct(summary.classifications.D)}%)`);
  console.log(`  E (Broken/unexpected):   ${summary.classifications.E} (${pct(summary.classifications.E)}%)`);
  
  if (summary.failures.length > 0) {
    console.log("\n⚠️  CLASS E FAILURES:");
    for (const f of summary.failures.slice(0, 30)) console.log(`  ${f.year} ${f.make} ${f.model} ${f.trim} - W:${f.wheelStatus.error || 'ok'} T:${f.tireStatus.error || 'ok'}`);
    if (summary.failures.length > 30) console.log(`  ... and ${summary.failures.length - 30} more`);
  }
  
  if (summary.unexpectedZeroWheels.length > 0) {
    console.log(`\n⚠️  UNEXPECTED ZERO WHEELS: ${summary.unexpectedZeroWheels.length}`);
    for (const f of summary.unexpectedZeroWheels.slice(0, 10)) console.log(`  ${f.year} ${f.make} ${f.model} ${f.trim}`);
  }
  
  if (summary.unexpectedZeroTires.length > 0) {
    console.log(`\n⚠️  UNEXPECTED ZERO TIRES: ${summary.unexpectedZeroTires.length}`);
    for (const f of summary.unexpectedZeroTires.slice(0, 10)) console.log(`  ${f.year} ${f.make} ${f.model} ${f.trim}`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  if (summary.classifications.E > 0 || summary.unexpectedZeroWheels.length > 0 || summary.unexpectedZeroTires.length > 0) {
    console.log(`❌ AUDIT ISSUES - ${pct(summary.classifications.A)}% full pass rate`);
  } else {
    console.log(`✅ AUDIT PASSED - ${pct(summary.classifications.A)}% full pass (A)`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  fs.writeFileSync('scripts/ymm-audit-results.json', JSON.stringify({ ...summary, durationMs }, null, 2));
  console.log("Results saved to scripts/ymm-audit-results.json");
  process.exit(summary.classifications.E > 0 ? 1 : 0);
}

runAudit().catch(e => { console.error("Audit failed:", e); process.exit(1); });
