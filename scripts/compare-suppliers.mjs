/**
 * Compare US AutoForce vs TireWeb supplier coverage and pricing
 * 
 * Run: node scripts/compare-suppliers.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Test sizes - common passenger, SUV, truck sizes
const TEST_SIZES = [
  { size: '2256016', name: '225/60R16 - Passenger' },
  { size: '2657017', name: '265/70R17 - SUV' },
  { size: '2755520', name: '275/55R20 - Full SUV' },
  { size: '2756020', name: '275/60R20 - Truck' },
  { size: '2454518', name: '245/45R18 - Sport sedan' },
  { size: '2356517', name: '235/65R17 - CUV' },
];

// ============ TireWeb API ============

const accessKey = process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY;
const groupToken = process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN;

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getConnections() {
  try {
    const result = await pool.query(`
      SELECT provider, connection_id, enabled 
      FROM tireweb_connections 
      WHERE enabled = true
      ORDER BY provider
    `);
    return result.rows;
  } catch (err) {
    // Fallback
    return [
      { provider: 'tireweb_atd', connection_id: 488677 },
      { provider: 'tireweb_ntw', connection_id: 488546 },
      { provider: 'tireweb_usautoforce', connection_id: 488548 },
    ];
  }
}

async function queryTireWeb(connectionId, tireSize) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>${escapeXml(accessKey)}</prod:AccessKey>
        <prod:GroupToken>${escapeXml(groupToken)}</prod:GroupToken>
        <prod:ConnectionID>${connectionId}</prod:ConnectionID>
        <prod:TireSize>${escapeXml(tireSize)}</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch('http://ws.tirewire.com/connectionscenter/productsservice.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ws.tirewire.com/connectionscenter/productsservice/GetTires',
    },
    body: soapBody,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const xml = await res.text();
  
  // Check for rate limit
  if (xml.includes('ErrorCode>127<')) {
    throw new Error('Rate limited');
  }
  
  // Parse tires
  const tires = [];
  const tireMatches = xml.matchAll(/<Tire>([\s\S]*?)<\/Tire>/g);
  
  for (const match of tireMatches) {
    const t = match[1];
    const getValue = (tag) => {
      const m = t.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return m ? m[1] : null;
    };
    
    tires.push({
      brand: getValue('Make'),
      model: getValue('Pattern'),
      partNumber: getValue('ClientProductCode'),
      cost: parseFloat(getValue('BuyPrice') || '0'),
      quantity: parseInt(getValue('Quantity') || '0', 10),
    });
  }
  
  return tires;
}

async function queryAllTireWebConnections(tireSize) {
  const connections = await getConnections();
  const allTires = [];
  const seenParts = new Set();
  
  for (const conn of connections) {
    // Skip the USAF connection via TireWeb (we're testing direct USAF separately)
    if (conn.provider.includes('usautoforce')) continue;
    
    try {
      const tires = await queryTireWeb(conn.connection_id, tireSize);
      
      // Dedupe by part number
      for (const tire of tires) {
        if (!seenParts.has(tire.partNumber)) {
          seenParts.add(tire.partNumber);
          allTires.push({ ...tire, source: conn.provider });
        }
      }
      
      // Rate limit protection
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.log(`  ⚠️  ${conn.provider}: ${err.message}`);
    }
  }
  
  return allTires;
}

// ============ US AutoForce (via TireWeb connection) ============

async function queryUSAFViaTireWeb(tireSize) {
  const connections = await getConnections();
  const usafConn = connections.find(c => c.provider.includes('usautoforce'));
  
  if (!usafConn) {
    console.log('  ⚠️  No USAF TireWeb connection found');
    return [];
  }
  
  try {
    return await queryTireWeb(usafConn.connection_id, tireSize);
  } catch (err) {
    console.log(`  ⚠️  USAF via TireWeb: ${err.message}`);
    return [];
  }
}

// ============ Analysis ============

function analyzeBrands(usafTires, tirewebTires) {
  const usafBrands = new Set(usafTires.map(t => t.brand?.toUpperCase()).filter(Boolean));
  const tirewebBrands = new Set(tirewebTires.map(t => t.brand?.toUpperCase()).filter(Boolean));
  
  const onlyUSAF = [...usafBrands].filter(b => !tirewebBrands.has(b));
  const onlyTireWeb = [...tirewebBrands].filter(b => !usafBrands.has(b));
  const both = [...usafBrands].filter(b => tirewebBrands.has(b));
  
  return { usafBrands, tirewebBrands, onlyUSAF, onlyTireWeb, both };
}

function comparePricing(usafTires, tirewebTires) {
  const comparisons = [];
  
  for (const usaf of usafTires) {
    const matchingTW = tirewebTires.find(tw => 
      tw.brand?.toUpperCase() === usaf.brand?.toUpperCase() &&
      tw.model?.toUpperCase() === usaf.model?.toUpperCase()
    );
    
    if (matchingTW && usaf.cost > 0 && matchingTW.cost > 0) {
      comparisons.push({
        brand: usaf.brand,
        model: usaf.model,
        usafPrice: usaf.cost,
        twPrice: matchingTW.cost,
        diff: matchingTW.cost - usaf.cost,
      });
    }
  }
  
  return comparisons;
}

// ============ Main ============

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    SUPPLIER COMPARISON: US AutoForce vs TireWeb (ATD/NTW)      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (!accessKey || !groupToken) {
    console.log('❌ TireWeb credentials not found');
    return;
  }
  
  const allResults = [];
  
  for (const { size, name } of TEST_SIZES) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📏 ${name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Query USAF (via TireWeb connection)
    console.log('  Querying US AutoForce (via TireWeb)...');
    const usafTires = await queryUSAFViaTireWeb(size);
    console.log(`  USAF: ${usafTires.length} SKUs`);
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Query other TireWeb connections (ATD, NTW)
    console.log('  Querying TireWeb (ATD + NTW)...');
    const tirewebTires = await queryAllTireWebConnections(size);
    console.log(`  TireWeb: ${tirewebTires.length} SKUs`);
    
    if (usafTires.length === 0 && tirewebTires.length === 0) {
      console.log(`  ⚠️  No data from either source`);
      continue;
    }
    
    // Brand analysis
    const { usafBrands, tirewebBrands, onlyUSAF, onlyTireWeb, both } = analyzeBrands(usafTires, tirewebTires);
    
    console.log(`\n  📊 Brand Coverage:`);
    console.log(`     USAF: ${usafBrands.size} brands | TireWeb: ${tirewebBrands.size} brands | Both: ${both.length}`);
    
    if (onlyUSAF.length > 0) {
      console.log(`     Only USAF: ${onlyUSAF.slice(0, 8).join(', ')}${onlyUSAF.length > 8 ? ` (+${onlyUSAF.length - 8})` : ''}`);
    }
    if (onlyTireWeb.length > 0) {
      console.log(`     Only TireWeb: ${onlyTireWeb.slice(0, 8).join(', ')}${onlyTireWeb.length > 8 ? ` (+${onlyTireWeb.length - 8})` : ''}`);
    }
    
    // Pricing
    const priceComps = comparePricing(usafTires, tirewebTires);
    
    if (priceComps.length > 0) {
      const avgDiff = priceComps.reduce((sum, c) => sum + c.diff, 0) / priceComps.length;
      const usafCheaper = priceComps.filter(c => c.diff > 0).length;
      const twCheaper = priceComps.filter(c => c.diff < 0).length;
      
      console.log(`\n  💰 Pricing (${priceComps.length} matching):`);
      console.log(`     USAF cheaper: ${usafCheaper} | TireWeb cheaper: ${twCheaper}`);
      console.log(`     Avg diff: $${avgDiff.toFixed(2)} (${avgDiff > 0 ? 'USAF cheaper' : 'TireWeb cheaper'})`);
      
      // Examples
      const sorted = priceComps.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      for (const ex of sorted.slice(0, 2)) {
        const winner = ex.diff > 0 ? 'USAF' : 'TW';
        console.log(`     • ${ex.brand} ${ex.model.substring(0, 20)}: USAF $${ex.usafPrice.toFixed(2)} vs TW $${ex.twPrice.toFixed(2)} (${winner} -$${Math.abs(ex.diff).toFixed(2)})`);
      }
    }
    
    allResults.push({
      size: name,
      usafCount: usafTires.length,
      tirewebCount: tirewebTires.length,
      onlyUSAF,
      onlyTireWeb,
      bothBrands: both.length,
      priceComps: priceComps.length,
      avgPriceDiff: priceComps.length > 0 ? priceComps.reduce((sum, c) => sum + c.diff, 0) / priceComps.length : 0,
    });
    
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const totalUSAF = allResults.reduce((sum, r) => sum + r.usafCount, 0);
  const totalTW = allResults.reduce((sum, r) => sum + r.tirewebCount, 0);
  
  console.log(`Total SKUs: USAF ${totalUSAF} | TireWeb ${totalTW}`);
  
  const allOnlyTW = [...new Set(allResults.flatMap(r => r.onlyTireWeb))];
  const allOnlyUSAF = [...new Set(allResults.flatMap(r => r.onlyUSAF))];
  
  console.log(`\n📌 Brands ONLY in TireWeb (ATD/NTW): ${allOnlyTW.length}`);
  if (allOnlyTW.length > 0) {
    console.log(`   ${allOnlyTW.join(', ')}`);
  }
  
  console.log(`\n📌 Brands ONLY in US AutoForce: ${allOnlyUSAF.length}`);
  if (allOnlyUSAF.length > 0) {
    console.log(`   ${allOnlyUSAF.join(', ')}`);
  }
  
  const avgOverall = allResults.filter(r => r.priceComps > 0).reduce((sum, r) => sum + r.avgPriceDiff, 0) / allResults.filter(r => r.priceComps > 0).length;
  if (!isNaN(avgOverall)) {
    console.log(`\n💰 Overall: ${avgOverall > 0 ? 'USAF' : 'TireWeb'} is ~$${Math.abs(avgOverall).toFixed(2)} cheaper on average`);
  }
  
  console.log(`\n🎯 Recommendation:`);
  if (totalUSAF === 0) {
    console.log(`   ⚠️  No USAF data (need to verify connection)`);
  } else if (allOnlyTW.length === 0) {
    console.log(`   ✅ USAF covers all TireWeb brands - safe to go USAF-only`);
  } else if (allOnlyTW.length <= 3) {
    console.log(`   ⚠️  ${allOnlyTW.length} brands only in TireWeb: ${allOnlyTW.join(', ')}`);
    console.log(`   Consider: Are these brands important for your customers?`);
  } else {
    console.log(`   ⚠️  ${allOnlyTW.length} brands only in TireWeb - keep TireWeb for coverage`);
  }
  
  // Save results
  const fs = await import('fs');
  fs.writeFileSync(
    path.join(__dirname, 'supplier-comparison-results.json'),
    JSON.stringify(allResults, null, 2)
  );
  console.log(`\n📄 Results saved to scripts/supplier-comparison-results.json`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
