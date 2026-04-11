/**
 * Wheel Image Audit for Visualizer Compatibility
 * Run: node scripts/wheel-image-audit.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Image type detection (matching the TypeScript logic)
function detectImageType(imageUrl) {
  if (!imageUrl) return 'unknown';
  const url = imageUrl.toUpperCase();
  
  if (url.includes('-FACE-') || url.includes('-FACE.') || url.includes('/FACE')) {
    return 'face';
  }
  if (url.includes('-A1-') || url.includes('-A1.') || 
      url.includes('-A2-') || url.includes('-A2.') ||
      url.includes('/A1') || url.includes('/A2')) {
    return 'angled';
  }
  return 'unknown';
}

function analyzeWheel(wheel) {
  const images = wheel.images || [];
  let hasFace = false;
  let hasAngled = false;
  let hasUnknown = false;
  
  for (const img of images) {
    const type = detectImageType(img);
    if (type === 'face') hasFace = true;
    else if (type === 'angled') hasAngled = true;
    else hasUnknown = true;
  }
  
  return {
    imageCount: images.length,
    hasFace,
    hasAngled,
    hasUnknown,
    visualizerCompatible: hasFace
  };
}

async function main() {
  const filePath = path.join(__dirname, '..', 'src', 'techfeed', 'wheels_by_sku.json.gz');
  
  console.log('Loading techfeed wheels...');
  const buf = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(json);
  
  const wheels = Object.values(data.bySku);
  console.log(`Total wheels in techfeed: ${wheels.length}\n`);
  
  // Aggregate stats
  let totalWithImages = 0;
  let totalWithFace = 0;
  let totalWithAngled = 0;
  let totalWithOnlyUnknown = 0;
  let totalNoImages = 0;
  
  // Brand breakdown
  const brandStats = {};
  
  // Sample incompatible wheels
  const incompatibleSamples = [];
  
  for (const wheel of wheels) {
    const analysis = analyzeWheel(wheel);
    const brand = wheel.brand_desc || 'Unknown';
    
    if (!brandStats[brand]) {
      brandStats[brand] = { total: 0, compatible: 0, withFace: 0, withAngled: 0, noImages: 0 };
    }
    brandStats[brand].total++;
    
    if (analysis.imageCount === 0) {
      totalNoImages++;
      brandStats[brand].noImages++;
    } else {
      totalWithImages++;
      if (analysis.hasFace) {
        totalWithFace++;
        brandStats[brand].withFace++;
        brandStats[brand].compatible++;
      } else if (analysis.hasAngled) {
        totalWithAngled++;
        brandStats[brand].withAngled++;
        // Capture some samples
        if (incompatibleSamples.length < 10) {
          incompatibleSamples.push({
            sku: wheel.sku,
            brand,
            style: wheel.style || wheel.display_style_no,
            images: wheel.images?.slice(0, 3)
          });
        }
      } else {
        totalWithOnlyUnknown++;
      }
    }
  }
  
  // Calculate overall stats
  const compatibilityRate = ((totalWithFace / wheels.length) * 100).toFixed(1);
  const imageRate = ((totalWithImages / wheels.length) * 100).toFixed(1);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                WHEEL IMAGE AUDIT RESULTS                  ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('OVERALL STATISTICS');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Total wheels:              ${wheels.length.toLocaleString()}`);
  console.log(`With any images:           ${totalWithImages.toLocaleString()} (${imageRate}%)`);
  console.log(`No images:                 ${totalNoImages.toLocaleString()}`);
  console.log('');
  console.log(`✅ FACE images (compatible):  ${totalWithFace.toLocaleString()} (${compatibilityRate}%)`);
  console.log(`⚠️  ANGLED only (not ideal):   ${totalWithAngled.toLocaleString()}`);
  console.log(`❓ Unknown type only:          ${totalWithOnlyUnknown.toLocaleString()}`);
  console.log('');
  
  // Top brands by volume
  const sortedBrands = Object.entries(brandStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);
  
  console.log('\nTOP BRANDS BY VOLUME');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Brand                    | Total  | Face ✅ | Angled ⚠️ | Rate');
  console.log('─────────────────────────────────────────────────────────');
  
  for (const [brand, stats] of sortedBrands) {
    const rate = stats.total > 0 ? ((stats.compatible / stats.total) * 100).toFixed(0) : 0;
    const brandName = brand.substring(0, 24).padEnd(24);
    console.log(`${brandName} | ${String(stats.total).padStart(6)} | ${String(stats.withFace).padStart(7)} | ${String(stats.withAngled).padStart(9)} | ${rate}%`);
  }
  
  if (incompatibleSamples.length > 0) {
    console.log('\n\nSAMPLE WHEELS WITH ANGLED-ONLY IMAGES');
    console.log('─────────────────────────────────────────────────────────');
    for (const sample of incompatibleSamples.slice(0, 5)) {
      console.log(`SKU: ${sample.sku}`);
      console.log(`  Brand: ${sample.brand}, Style: ${sample.style}`);
      console.log(`  Images: ${sample.images?.join(', ') || 'none'}`);
      console.log('');
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`VISUALIZER COMPATIBILITY: ${compatibilityRate}% of wheels ready`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
