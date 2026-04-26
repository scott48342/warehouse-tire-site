/**
 * Cluster remaining tire/wheel mismatches to identify contamination patterns
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function extractDiameter(tireSize: string | null): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1]));
}

function parseWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (Array.isArray(data)) {
    for (const w of data) {
      if (typeof w === 'string') {
        const match = w.match(/x(\d+)/i);
        if (match) diameters.push(parseInt(match[1]));
      } else if (w?.diameter) {
        diameters.push(Math.floor(w.diameter));
      }
      if (w?.rearDiameter) diameters.push(Math.floor(w.rearDiameter));
    }
  } else if (typeof data === 'object') {
    if (data.diameter) diameters.push(Math.floor(data.diameter));
    if (data.rearDiameter) diameters.push(Math.floor(data.rearDiameter));
  }
  
  return [...new Set(diameters)];
}

function parseTireDiameters(oemTireSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemTireSizes) return diameters;
  
  const data = typeof oemTireSizes === 'string' ? JSON.parse(oemTireSizes) : oemTireSizes;
  
  if (Array.isArray(data)) {
    for (const t of data) {
      const size = typeof t === 'string' ? t : t?.size || t?.front;
      if (size) {
        const dia = extractDiameter(String(size));
        if (dia) diameters.push(dia);
      }
      if (t?.rear) {
        const dia = extractDiameter(String(t.rear));
        if (dia) diameters.push(dia);
      }
    }
  } else if (typeof data === 'string') {
    const dia = extractDiameter(data);
    if (dia) diameters.push(dia);
  }
  
  return [...new Set(diameters)];
}

interface Mismatch {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  source: string;
  wheelDiameters: number[];
  tireDiameters: number[];
  rawWheels: any;
  rawTires: any;
}

interface Cluster {
  key: string;
  make: string;
  model: string;
  yearMin: number;
  yearMax: number;
  sources: Set<string>;
  records: Mismatch[];
  wheelPattern: string;
  tirePattern: string;
  issueType: string;
}

async function main() {
  console.log('=== Clustering Complete Tire/Wheel Mismatches ===\n');

  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, source, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_tire_sizes IS NOT NULL
  `);

  // Find all complete mismatches
  const mismatches: Mismatch[] = [];

  for (const row of records.rows) {
    const wheelDiameters = parseWheelDiameters(row.oem_wheel_sizes);
    const tireDiameters = parseTireDiameters(row.oem_tire_sizes);
    
    if (wheelDiameters.length === 0 || tireDiameters.length === 0) continue;
    
    const hasMatch = tireDiameters.some(td => wheelDiameters.includes(td));
    
    if (!hasMatch) {
      mismatches.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.display_trim || 'Base',
        source: row.source || 'unknown',
        wheelDiameters,
        tireDiameters,
        rawWheels: row.oem_wheel_sizes,
        rawTires: row.oem_tire_sizes
      });
    }
  }

  console.log(`Total complete mismatches: ${mismatches.length}\n`);

  // Cluster by make + model
  const clusterMap = new Map<string, Cluster>();

  for (const m of mismatches) {
    const key = `${m.make}|${m.model}`;
    
    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        key,
        make: m.make,
        model: m.model,
        yearMin: m.year,
        yearMax: m.year,
        sources: new Set(),
        records: [],
        wheelPattern: '',
        tirePattern: '',
        issueType: ''
      });
    }
    
    const cluster = clusterMap.get(key)!;
    cluster.yearMin = Math.min(cluster.yearMin, m.year);
    cluster.yearMax = Math.max(cluster.yearMax, m.year);
    cluster.sources.add(m.source);
    cluster.records.push(m);
  }

  // Analyze each cluster
  const clusters = Array.from(clusterMap.values());
  
  for (const cluster of clusters) {
    // Find common wheel and tire patterns
    const wheelCounts = new Map<string, number>();
    const tireCounts = new Map<string, number>();
    
    for (const r of cluster.records) {
      const wKey = r.wheelDiameters.sort((a,b) => a-b).join('/');
      const tKey = r.tireDiameters.sort((a,b) => a-b).join('/');
      wheelCounts.set(wKey, (wheelCounts.get(wKey) || 0) + 1);
      tireCounts.set(tKey, (tireCounts.get(tKey) || 0) + 1);
    }
    
    // Most common patterns
    cluster.wheelPattern = [...wheelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}" (${v})`)
      .join(', ');
    
    cluster.tirePattern = [...tireCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `R${k} (${v})`)
      .join(', ');
    
    // Determine issue type
    const avgWheel = cluster.records.reduce((s, r) => s + Math.min(...r.wheelDiameters), 0) / cluster.records.length;
    const avgTire = cluster.records.reduce((s, r) => s + Math.min(...r.tireDiameters), 0) / cluster.records.length;
    
    if (avgTire > avgWheel + 2) {
      cluster.issueType = 'AFTERMARKET_TIRES: Tire sizes are larger than OEM wheels';
    } else if (avgWheel > avgTire + 2) {
      cluster.issueType = 'AFTERMARKET_WHEELS: Wheel sizes are larger than OEM tires';
    } else if (cluster.yearMax - cluster.yearMin > 10) {
      cluster.issueType = 'GENERATION_CONTAMINATION: Wide year range suggests mixed generation data';
    } else {
      cluster.issueType = 'DATA_MISMATCH: Wheel and tire data from different sources';
    }
  }

  // Sort by record count
  clusters.sort((a, b) => b.records.length - a.records.length);

  // Output results
  console.log('=== TOP OFFENDER CLUSTERS ===\n');
  
  let totalInTop20 = 0;
  
  for (let i = 0; i < Math.min(25, clusters.length); i++) {
    const c = clusters[i];
    totalInTop20 += c.records.length;
    
    console.log(`${i + 1}. ${c.make} ${c.model} (${c.records.length} records)`);
    console.log(`   Years: ${c.yearMin}-${c.yearMax}`);
    console.log(`   Sources: ${[...c.sources].join(', ')}`);
    console.log(`   Wheels: ${c.wheelPattern}`);
    console.log(`   Tires: ${c.tirePattern}`);
    console.log(`   Issue: ${c.issueType}`);
    
    // Show sample records
    const samples = c.records.slice(0, 3);
    console.log(`   Samples:`);
    for (const s of samples) {
      console.log(`     - ${s.year} [${s.trim}]: wheels ${s.wheelDiameters.join('/')}\" vs tires R${s.tireDiameters.join('/R')}`);
    }
    console.log('');
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total clusters: ${clusters.length}`);
  console.log(`Top 25 clusters account for: ${totalInTop20} / ${mismatches.length} (${(totalInTop20/mismatches.length*100).toFixed(1)}%)`);
  
  // Group by issue type
  const byIssueType = new Map<string, number>();
  for (const c of clusters) {
    const type = c.issueType.split(':')[0];
    byIssueType.set(type, (byIssueType.get(type) || 0) + c.records.length);
  }
  
  console.log(`\nBy Issue Type:`);
  for (const [type, count] of [...byIssueType.entries()].sort((a,b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} records (${(count/mismatches.length*100).toFixed(1)}%)`);
  }

  // Group by source
  const bySource = new Map<string, number>();
  for (const m of mismatches) {
    bySource.set(m.source, (bySource.get(m.source) || 0) + 1);
  }
  
  console.log(`\nBy Source:`);
  for (const [source, count] of [...bySource.entries()].sort((a,b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count} records (${(count/mismatches.length*100).toFixed(1)}%)`);
  }

  // Recommended corrections
  console.log(`\n\n=== RECOMMENDED CORRECTIONS ===\n`);
  
  for (let i = 0; i < Math.min(10, clusters.length); i++) {
    const c = clusters[i];
    let recommendation = '';
    
    if (c.issueType.startsWith('AFTERMARKET_TIRES')) {
      recommendation = `CLEAR oem_tire_sizes - these appear to be aftermarket/upgrade sizes. ` +
        `Derive correct OEM tires from wheel diameters (${c.wheelPattern}).`;
    } else if (c.issueType.startsWith('AFTERMARKET_WHEELS')) {
      recommendation = `CLEAR oem_wheel_sizes - these appear to be aftermarket/upgrade sizes. ` +
        `Derive correct OEM wheels from tire diameters (${c.tirePattern}).`;
    } else if (c.issueType.startsWith('GENERATION_CONTAMINATION')) {
      recommendation = `SPLIT by generation. Years ${c.yearMin}-${c.yearMax} likely span multiple generations ` +
        `with different OEM specs. Research correct specs per generation.`;
    } else {
      recommendation = `RESEARCH correct OEM specs. Current data is inconsistent.`;
    }
    
    console.log(`${i + 1}. ${c.make} ${c.model} (${c.records.length} records)`);
    console.log(`   → ${recommendation}`);
    console.log('');
  }

  await pool.end();
}

main().catch(console.error);
