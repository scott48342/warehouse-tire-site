import fs from 'fs';
import https from 'https';
import http from 'http';

const BATCH_FILE = 'batches-overnight/overnight-125-gmc.json';
const OUTPUT_FILE = 'results-overnight/overnight-125-gmc.json';
const BASE_URL = 'https://shop.warehousetiredirect.com';

// Read batch
const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'));
console.log(`Processing ${batch.length} vehicles...`);

// Ensure output directory exists
if (!fs.existsSync('results-overnight')) {
  fs.mkdirSync('results-overnight', { recursive: true });
}

async function fetchAPI(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.get(url.href, {
      headers: { 'User-Agent': 'FitmentVerifier/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: 'JSON parse error', raw: data.substring(0, 200) });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function verifyVehicle(vehicle) {
  const { year, make, model, trim } = vehicle;
  const result = {
    id: vehicle.id,
    year,
    make,
    model,
    trim,
    expected: {
      boltPattern: vehicle.currentBoltPattern,
      hubBore: vehicle.currentHubBore,
      wheelSizes: vehicle.currentWheelSizes,
      tireSizes: vehicle.currentTireSizes
    },
    source: vehicle.source,
    status: 'pending',
    checks: {}
  };

  try {
    // 1. Check trims API
    const trimsPath = `/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const trimsRes = await fetchAPI(trimsPath);
    
    if (trimsRes.status !== 200) {
      result.status = 'error';
      result.checks.trims = { error: `HTTP ${trimsRes.status}` };
      return result;
    }
    
    // Trims API returns { results: [{ label, value, modificationId }, ...] }
    const trimsData = trimsRes.data;
    const trimsList = trimsData?.results || [];
    const trimLabels = trimsList.map(t => t.label);
    const trimExists = trimLabels.some(t => t.toLowerCase() === trim.toLowerCase() || t.toLowerCase().includes(trim.toLowerCase()));
    result.checks.trimExists = trimExists;
    result.checks.availableTrims = trimLabels;
    result.checks.hasCoverage = trimsData?.hasCoverage || false;
    
    // 2. Check fitment API
    const fitmentPath = `/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}`;
    const fitmentRes = await fetchAPI(fitmentPath);
    
    if (fitmentRes.status !== 200) {
      result.status = 'partial';
      result.checks.fitment = { error: `HTTP ${fitmentRes.status}` };
      return result;
    }
    
    const fitmentData = fitmentRes.data;
    const envelope = fitmentData?.fitment?.envelope || {};
    const dbProfile = fitmentData?.fitment?.dbProfile || {};
    
    // Extract fitment specs from API
    const apiBoltPattern = envelope.boltPattern || dbProfile.boltPattern;
    const apiHubBore = String(envelope.centerBore || dbProfile.centerBoreMm || '');
    const apiOemWheelSizes = dbProfile.oemWheelSizes || [];
    const apiOemTireSizes = dbProfile.oemTireSizes || [];
    
    result.checks.fitment = {
      boltPattern: apiBoltPattern,
      hubBore: apiHubBore,
      wheelSizes: apiOemWheelSizes,
      tireSizes: apiOemTireSizes,
      source: dbProfile.source || 'unknown',
      confidence: fitmentData?.fitment?.confidence || 'unknown',
      wheelResults: fitmentData?.totalCount || 0
    };
    
    // Compare expected vs actual
    const boltMatch = apiBoltPattern === vehicle.currentBoltPattern;
    const hubMatch = apiHubBore === vehicle.currentHubBore || 
                     parseFloat(apiHubBore).toFixed(1) === parseFloat(vehicle.currentHubBore).toFixed(1);
    
    result.checks.matches = {
      boltPattern: boltMatch,
      hubBore: hubMatch
    };
    
    if (!boltMatch || !hubMatch) {
      result.status = 'mismatch';
      result.mismatchDetails = {
        boltPattern: boltMatch ? null : { expected: vehicle.currentBoltPattern, actual: apiBoltPattern },
        hubBore: hubMatch ? null : { expected: vehicle.currentHubBore, actual: apiHubBore }
      };
    } else if (fitmentData?.totalCount > 0) {
      result.status = 'pass';
    } else {
      result.status = 'pass_no_wheels';
    }
    
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
  }
  
  return result;
}

async function processBatch() {
  const results = [];
  const stats = { pass: 0, pass_no_wheels: 0, mismatch: 0, error: 0, partial: 0 };
  
  for (let i = 0; i < batch.length; i++) {
    const vehicle = batch[i];
    console.log(`[${i+1}/${batch.length}] ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}...`);
    
    const result = await verifyVehicle(vehicle);
    results.push(result);
    stats[result.status] = (stats[result.status] || 0) + 1;
    
    // Status indicator
    const icon = result.status === 'pass' ? '✓' : result.status === 'mismatch' ? '✗' : '?';
    process.stdout.write(` ${icon}\n`);
    
    // Small delay to avoid overwhelming the API
    await new Promise(r => setTimeout(r, 200));
  }
  
  const output = {
    batchName: 'overnight-125-gmc',
    timestamp: new Date().toISOString(),
    totalVehicles: batch.length,
    stats,
    results
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log('\n=== COMPLETE ===');
  console.log(`Pass: ${stats.pass}, Pass (no wheels): ${stats.pass_no_wheels}, Mismatch: ${stats.mismatch}, Error: ${stats.error}, Partial: ${stats.partial}`);
  console.log(`Results saved to: ${OUTPUT_FILE}`);
}

processBatch().catch(console.error);
