/**
 * Social Content Generator
 * 
 * Generates wheel showcase content for Facebook/TikTok
 * - Picks trending wheels from inventory
 * - Creates image with overlay (specs, price)
 * - Generates captions with hashtags
 * - Outputs ready-to-post content
 * 
 * Usage: node generate.js [--count=5] [--video]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// ============================================================================
// Config
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, 'output');
const SITE_URL = 'https://shop.warehousetiredirect.com';

// Popular vehicles for showcasing wheels
const SHOWCASE_VEHICLES = [
  { year: 2024, make: 'Ford', model: 'F-150', type: 'truck' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', type: 'truck' },
  { year: 2024, make: 'RAM', model: '1500', type: 'truck' },
  { year: 2024, make: 'Toyota', model: 'Tacoma', type: 'truck' },
  { year: 2024, make: 'Toyota', model: 'Tundra', type: 'truck' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', type: 'suv' },
  { year: 2024, make: 'Jeep', model: 'Gladiator', type: 'truck' },
  { year: 2024, make: 'Ford', model: 'Bronco', type: 'suv' },
  { year: 2024, make: 'Toyota', model: '4Runner', type: 'suv' },
  { year: 2024, make: 'Chevrolet', model: 'Tahoe', type: 'suv' },
  { year: 2024, make: 'Ford', model: 'Mustang', type: 'muscle' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', type: 'muscle' },
  { year: 2024, make: 'Dodge', model: 'Challenger', type: 'muscle' },
  { year: 2024, make: 'Dodge', model: 'Charger', type: 'muscle' },
  { year: 2024, make: 'Tesla', model: 'Model Y', type: 'ev' },
  { year: 2024, make: 'Tesla', model: 'Model 3', type: 'ev' },
];

// Hashtag sets by category
const HASHTAGS = {
  truck: ['#trucks', '#trucksofinstagram', '#trucklife', '#liftedtrucks', '#trucknation', '#dieseltrucks'],
  suv: ['#suv', '#suvlife', '#offroad', '#4x4', '#overlanding', '#adventure'],
  muscle: ['#musclecar', '#americanmuscle', '#v8', '#horsepower', '#carculture', '#carsofinstagram'],
  ev: ['#ev', '#electricvehicle', '#tesla', '#teslalife', '#zeroemissions', '#futureofdriving'],
  general: ['#wheels', '#rims', '#customwheels', '#wheelgoals', '#wheelwednesday', '#newwheels', '#aftermarketwheels', '#wheelupgrade'],
};

// Caption templates - all include website link
const CAPTION_TEMPLATES = [
  "🔥 {wheelName} - Now in stock!\n\n{specs}\n\n💰 Starting at ${price}/wheel\n\n🛒 Shop now: {productUrl}\n\n{hashtags}",
  "Transform your {vehicleType} with the {wheelName} 🛞\n\n{specs}\n\n${price}/wheel\n\n🛒 {productUrl}\n\n{hashtags}",
  "New arrival alert! 🚨\n\n{wheelName}\n{specs}\n\n${price}/wheel - Ships free!\n\n🛒 Order here: {productUrl}\n\n{hashtags}",
  "Your {vehicle} deserves these {wheelName} wheels 💯\n\n{specs}\n\nStarting at ${price}\n\n🛒 {productUrl}\n\n{hashtags}",
  "Weekend project? ✅\n\n{wheelName}\n{specs}\n\nOnly ${price}/wheel\n\n🛒 Get yours: {productUrl}\n\n{hashtags}",
];

// ============================================================================
// Database
// ============================================================================

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

/**
 * Get wheels that are good for social content
 * - In stock (from inventory)
 * - Has images
 * - Has pricing
 */
async function getShowcaseWheels(limit = 10) {
  // Get wheels with images that are in stock - good for social
  const result = await pool.query(`
    SELECT 
      w.sku,
      w.brand_desc as brand,
      w.style as style_name,
      w.product_desc as finish,
      w.diameter_in as diameter,
      w.width_in as width,
      w.bolt_pattern_standard as bolt_pattern,
      w.offset_mm,
      w.image_url,
      w.msrp_usd as msrp,
      w.map_usd as map_price,
      COALESCE(inv.qoh, 0) as qty_on_hand
    FROM wp_wheels w
    JOIN wp_inventory inv ON inv.sku = w.sku AND inv.product_type = 'wheel'
    WHERE w.image_url IS NOT NULL
      AND w.image_url != ''
      AND (w.msrp_usd > 0 OR w.map_usd > 0)
      AND w.diameter_in >= 17
      AND w.diameter_in <= 22
      AND w.bolt_pattern_standard IS NOT NULL
      AND w.bolt_pattern_standard NOT LIKE '%BLANK%'
      AND w.bolt_pattern_standard NOT LIKE '%/%'
      AND w.msrp_usd BETWEEN 150 AND 450
      AND COALESCE(inv.qoh, 0) >= 4
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit * 3]); // Get extra to filter

  // Calculate sell price and filter
  const wheels = result.rows.map(w => {
    let price = 0;
    const msrp = parseFloat(w.msrp) || 0;
    const map = parseFloat(w.map_price) || 0;
    
    // Cost-based pricing: assume cost = MSRP * 0.75, sell at cost * 1.30
    if (msrp > 0) {
      const estimatedCost = msrp * 0.75;
      price = Math.round(estimatedCost * 1.30);
      // Cap at MSRP
      if (price > msrp) price = msrp;
    } else if (map > 0) {
      price = map;
    }
    
    return { ...w, sellPrice: price };
  }).filter(w => w.sellPrice >= 100 && w.sellPrice <= 800); // Reasonable price range
  
  // Shuffle to get variety
  for (let i = wheels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wheels[i], wheels[j]] = [wheels[j], wheels[i]];
  }

  return wheels.slice(0, limit);
}

// ============================================================================
// Content Generation
// ============================================================================

/**
 * Download image to local file
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Generate specs string for a wheel
 */
function formatSpecs(wheel) {
  const specs = [];
  
  if (wheel.diameter && wheel.width) {
    specs.push(`📐 ${wheel.diameter}x${wheel.width}`);
  }
  if (wheel.bolt_pattern) {
    specs.push(`🔩 ${wheel.bolt_pattern}`);
  }
  if (wheel.offset_mm) {
    specs.push(`↔️ ${wheel.offset_mm}mm offset`);
  }
  if (wheel.finish) {
    specs.push(`✨ ${wheel.finish}`);
  }
  
  return specs.join('\n');
}

/**
 * Generate caption for a wheel post
 */
function generateCaption(wheel, vehicle, sku) {
  const template = CAPTION_TEMPLATES[Math.floor(Math.random() * CAPTION_TEMPLATES.length)];
  
  const wheelName = `${wheel.brand} ${wheel.style_name}`;
  const specs = formatSpecs(wheel);
  const price = wheel.sellPrice;
  const productUrl = `${SITE_URL}/wheels/${sku}`;
  
  // Pick hashtags based on bolt pattern (truck vs car)
  const boltPattern = wheel.bolt_pattern || '';
  const isTruck = boltPattern.includes('6X') || boltPattern.includes('8X');
  const vehicleType = isTruck ? 'truck' : (vehicle?.type || 'truck');
  
  const tags = [
    ...HASHTAGS.general.slice(0, 5),
    ...HASHTAGS[vehicleType].slice(0, 3),
    `#${wheel.brand.toLowerCase().replace(/\s+/g, '')}`,
    '#warehousetiredirect',
  ];
  const hashtags = tags.join(' ');
  
  let caption = template
    .replace('{wheelName}', wheelName)
    .replace('{specs}', specs)
    .replace('{price}', price.toString())
    .replace('{productUrl}', productUrl)
    .replace('{hashtags}', hashtags)
    .replace('{vehicleType}', vehicleType)
    .replace('{vehicle}', vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'ride');
  
  return caption;
}

/**
 * Generate content for one wheel
 */
async function generateWheelContent(wheel, index) {
  const timestamp = Date.now();
  const safeStyleName = wheel.style_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const baseName = `${safeStyleName}_${timestamp}`;
  
  // Pick a random showcase vehicle
  const vehicle = SHOWCASE_VEHICLES[Math.floor(Math.random() * SHOWCASE_VEHICLES.length)];
  
  // Download wheel image
  const imageExt = wheel.image_url.split('.').pop()?.split('?')[0] || 'jpg';
  const imagePath = path.join(OUTPUT_DIR, `${baseName}.${imageExt}`);
  
  console.log(`  Downloading image for ${wheel.brand} ${wheel.style_name}...`);
  try {
    await downloadImage(wheel.image_url, imagePath);
  } catch (err) {
    console.error(`  Failed to download image: ${err.message}`);
    return null;
  }
  
  // Generate product URL and caption
  const productUrl = `${SITE_URL}/wheels/${wheel.sku}`;
  const caption = generateCaption(wheel, vehicle, wheel.sku);
  
  // Create content bundle
  const content = {
    id: baseName,
    createdAt: new Date().toISOString(),
    wheel: {
      sku: wheel.sku,
      brand: wheel.brand,
      styleName: wheel.style_name,
      finish: wheel.finish,
      size: `${wheel.diameter}x${wheel.width}`,
      boltPattern: wheel.bolt_pattern,
      price: wheel.sellPrice,
    },
    vehicle,
    imagePath,
    caption,
    productUrl,
    platforms: {
      facebook: {
        caption,
        imagePath,
      },
      tiktok: {
        caption: caption.substring(0, 150) + '...', // TikTok has shorter limits
        imagePath,
      },
      instagram: {
        caption,
        imagePath,
      },
    },
  };
  
  // Save content metadata
  const metaPath = path.join(OUTPUT_DIR, `${baseName}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(content, null, 2));
  
  return content;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const countArg = args.find(a => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1]) : 3;
  
  console.log(`\n🎨 Social Content Generator\n`);
  console.log(`Generating ${count} wheel posts...\n`);
  
  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Get showcase wheels
  console.log('Fetching wheels from inventory...');
  const wheels = await getShowcaseWheels(count);
  console.log(`Found ${wheels.length} candidate wheels\n`);
  
  if (wheels.length === 0) {
    console.error('No wheels found! Check database connection.');
    process.exit(1);
  }
  
  // Generate content for each wheel
  const generated = [];
  for (let i = 0; i < Math.min(count, wheels.length); i++) {
    const wheel = wheels[i];
    console.log(`[${i + 1}/${count}] ${wheel.brand} ${wheel.style_name}`);
    
    const content = await generateWheelContent(wheel, i);
    if (content) {
      generated.push(content);
      console.log(`  ✅ Generated: ${content.id}`);
      console.log(`  📝 Caption preview: ${content.caption.substring(0, 80)}...`);
      console.log('');
    }
  }
  
  // Summary
  console.log(`\n✨ Generated ${generated.length} posts`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
  
  // List generated files
  console.log('Files:');
  generated.forEach(c => {
    console.log(`  - ${path.basename(c.imagePath)}`);
    console.log(`  - ${c.id}.json`);
  });
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
