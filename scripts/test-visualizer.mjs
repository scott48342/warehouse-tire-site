/**
 * Visualizer Test Script
 * 
 * Generates test vehicle images using DALL-E 3 and random wheels
 * Run: node scripts/test-visualizer.mjs
 */

import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment');
  console.log('Make sure .env.local has OPENAI_API_KEY set');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Test vehicles (mix of cars, not just trucks!)
const TEST_VEHICLES = [
  { year: 2024, make: 'BMW', model: 'M3', category: 'sports' },
  { year: 2024, make: 'Ford', model: 'Mustang GT', category: 'muscle' },
  { year: 2024, make: 'Honda', model: 'Accord', category: 'sedan' },
  { year: 2024, make: 'Porsche', model: '911 Carrera', category: 'sports' },
  { year: 2024, make: 'Dodge', model: 'Charger', category: 'muscle' },
];

// Category-specific prompts
const CATEGORY_STYLES = {
  muscle: "dramatic muscle car stance, aggressive fender flares if applicable, classic American muscle aesthetic",
  truck: "proper truck proportions, bed fully visible, rugged stance",
  suv: "proper SUV proportions, higher ground clearance stance, all wheel wells clearly visible",
  sedan: "elegant sedan proportions, balanced stance",
  sports: "low aggressive sports car stance, aerodynamic profile",
  classic: "period-correct classic car styling, vintage aesthetic",
  compact: "proper compact car proportions, urban-friendly stance",
};

const BASE_REQUIREMENTS = `
EXACT 90 degree side profile view looking directly at driver side,
PURE WHITE #FFFFFF seamless background with no gradients shadows or environment,
vehicle perfectly centered horizontally in frame,
full vehicle body visible from front bumper to rear bumper,
CRITICAL: wheel wells must be COMPLETELY EMPTY showing only dark black circular openings where wheels would go,
NO WHEELS NO TIRES NO RIMS visible at all - only empty black wheel well openings,
wheel well openings perfectly circular and unobstructed,
completely flat even studio lighting with no dramatic shadows or highlights,
no ground reflections,
no environment or backdrop,
vehicle appears to float on pure white,
clean vector-like quality suitable for wheel overlay compositing,
PNG style cutout look
`.trim().replace(/\n/g, " ");

function buildPrompt(vehicle) {
  const categoryStyle = CATEGORY_STYLES[vehicle.category] || CATEGORY_STYLES.sedan;
  return `Professional studio photograph of a ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${BASE_REQUIREMENTS}, ${categoryStyle}`;
}

// Load random wheels from techfeed
function loadRandomWheels(count = 5) {
  try {
    const filePath = path.join(process.cwd(), 'src/techfeed/wheels_by_sku.json.gz');
    const buf = fs.readFileSync(filePath);
    const json = zlib.gunzipSync(buf).toString('utf8');
    const data = JSON.parse(json);
    
    const allWheels = Object.values(data.bySku);
    const wheelsWithImages = allWheels.filter(w => w.images && w.images.length > 0);
    
    // Shuffle and pick random ones
    const shuffled = wheelsWithImages.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  } catch (e) {
    console.error('Failed to load wheels:', e.message);
    return [];
  }
}

async function generateVehicleImage(vehicle) {
  const prompt = buildPrompt(vehicle);
  console.log(`\n🚗 Generating: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.category})`);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
  
  const startTime = Date.now();
  
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      response_format: "url",
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const url = response.data?.[0]?.url;
    
    if (url) {
      console.log(`   ✅ Generated in ${elapsed}s`);
      console.log(`   📸 URL: ${url}`);
      return { vehicle, url, elapsed, prompt };
    } else {
      console.log(`   ❌ No URL returned`);
      return { vehicle, error: 'No URL returned' };
    }
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return { vehicle, error: e.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         VISUALIZER AI GENERATION TEST                      ');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Load some random wheels to show
  console.log('\n📦 Loading random wheels from techfeed...');
  const wheels = loadRandomWheels(5);
  
  if (wheels.length > 0) {
    console.log(`\n🎡 Sample wheels that would be overlaid:`);
    for (const w of wheels) {
      const hasface = w.images?.some(img => img.toUpperCase().includes('-FACE-'));
      const compat = hasface ? '✅' : '⚠️';
      console.log(`   ${compat} ${w.brand_desc} ${w.style || w.display_style_no} - ${w.abbreviated_finish_desc}`);
      if (w.images?.[0]) {
        console.log(`      Image: ${w.images[0]}`);
      }
    }
  }
  
  // Generate test vehicles
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('         GENERATING VEHICLE IMAGES (DALL-E 3)               ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⏱️  This will take ~15-20 seconds per vehicle...\n');
  
  // Only generate 2 for cost savings during testing
  const testVehicles = TEST_VEHICLES.slice(0, 2);
  const results = [];
  
  for (const vehicle of testVehicles) {
    const result = await generateVehicleImage(vehicle);
    results.push(result);
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      RESULTS                               ');
  console.log('═══════════════════════════════════════════════════════════');
  
  const successful = results.filter(r => r.url);
  const failed = results.filter(r => r.error);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n📸 Generated Images (open these URLs to see results):');
    for (const r of successful) {
      console.log(`\n   ${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}:`);
      console.log(`   ${r.url}`);
    }
  }
  
  // Cost estimate
  const cost = successful.length * 0.08; // DALL-E 3 HD 1792x1024
  console.log(`\n💰 Estimated cost: $${cost.toFixed(2)} (${successful.length} images @ $0.08 each)`);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      DONE                                  ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
