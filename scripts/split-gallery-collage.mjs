/**
 * Split truck gallery collage into individual images
 * 
 * The collage is 3 columns × 6 rows with text labels below each image.
 * We crop only the image portions, excluding text labels.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const INPUT_PATH = 'C:/Users/Scott-Pc/clawd/truck gallery images.png';
const OUTPUT_DIR = './public/gallery';

// Metadata extracted from the collage labels
const METADATA = [
  // Row 1
  { year: 2023, make: 'Chevrolet', model: 'Silverado Trail Boss', lift: '6"', wheels: '20x10', offset: -18, tires: '35x12.50R20', style: 'offroad', scene: 'desert' },
  { year: 2022, make: 'RAM', model: '1500 Rebel', lift: 'Leveled', wheels: '20x10', offset: -18, tires: null, style: 'daily', scene: 'suburban' },
  { year: 2023, make: 'Ford', model: 'F-150 Raptor', lift: '4"', wheels: '17x10', offset: null, tires: '33x12.50R17', style: 'offroad', scene: 'forest' },
  // Row 2
  { year: 2021, make: 'Toyota', model: 'Tacoma TRD Pro', lift: '2"', wheels: '17x9', offset: null, tires: '33x12.50R17', style: 'offroad', scene: 'trail' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD ZR2', lift: '6"', wheels: '20x10', offset: -18, tires: '37x13.50R17', style: 'aggressive', scene: 'dirt' },
  { year: 2023, make: 'RAM', model: '1500 Laramie', lift: 'Leveled', wheels: '20x12', offset: -1, tires: '35x12.50R20', style: 'daily', scene: 'city' },
  // Row 3
  { year: 2023, make: 'Ford', model: 'F-150 Stock', lift: 'Stock', wheels: '20"', offset: null, tires: '275/50R20', style: 'daily', scene: 'gas station' },
  { year: 2023, make: 'RAM', model: '2500', lift: 'Leveled', wheels: '20x10', offset: null, tires: '275/50R20', style: 'aggressive', scene: 'desert' },
  { year: 2023, make: 'RAM', model: '1500 Laramie', lift: 'Leveled', wheels: '20x9', offset: -1, tires: '33x12.50R20', style: 'daily', scene: 'city' },
  // Row 4
  { year: 2023, make: 'Ford', model: 'F-150 Stock', lift: 'Stock', wheels: '20"', offset: null, tires: '285/50R20', style: 'daily', scene: 'gas station' },
  { year: 2022, make: 'RAM', model: '2500', lift: '6"', wheels: '20x10', offset: -18, tires: '35x12.50R20', style: 'aggressive', scene: 'desert' },
  { year: 2023, make: 'RAM', model: '1500', lift: 'Leveled', wheels: '20x9', offset: -1, tires: '33x12.50R20', style: 'daily', scene: 'city' },
  // Row 5 (partial visible)
  { year: 2023, make: 'Ford', model: 'F-150', lift: 'Stock', wheels: '20"', offset: null, tires: null, style: 'daily', scene: 'parking' },
  { year: 2023, make: 'RAM', model: '1500', lift: 'Leveled', wheels: '20x9', offset: null, tires: null, style: 'daily', scene: 'driveway' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado', lift: 'Leveled', wheels: '20x9', offset: null, tires: null, style: 'daily', scene: 'parking' },
  // Row 6 (if present)
  { year: 2023, make: 'RAM', model: '1500', lift: 'Stock', wheels: '20"', offset: null, tires: null, style: 'daily', scene: 'street' },
  { year: 2023, make: 'Ford', model: 'F-150', lift: 'Stock', wheels: '20"', offset: null, tires: null, style: 'daily', scene: 'street' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado', lift: 'Stock', wheels: '20"', offset: null, tires: null, style: 'daily', scene: 'street' },
];

async function splitCollage() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get image dimensions
  const image = sharp(INPUT_PATH);
  const metadata = await image.metadata();
  
  console.log(`Collage dimensions: ${metadata.width} x ${metadata.height}`);
  
  const COLS = 3;
  
  // Final positions - collage has very irregular spacing
  const ROW_STARTS = [
    42,    // Row 0 (1-3) ✓
    355,   // Row 1 (4-6) ✓  
    668,   // Row 2 (7-9) ✓
    975,   // Row 3 (10-12) ✓
    1280,  // Row 4 (13-15) - pushed much higher
    1440,  // Row 5 (16-18)
  ];
  
  const cellWidth = Math.floor(metadata.width / COLS);
  const imageHeight = 85; // Smallest safe height
  
  console.log(`Cell width: ${cellWidth}, Image height: ${imageHeight}`);
  
  const results = [];
  let index = 1;
  
  for (let row = 0; row < ROW_STARTS.length; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * cellWidth;
      const y = ROW_STARTS[row];
      
      // Small padding to avoid borders
      const padding = 4;
      
      const cropRegion = {
        left: x + padding,
        top: y + padding,
        width: cellWidth - (padding * 2),
        height: imageHeight,
      };
      
      const filename = `gallery-${String(index).padStart(3, '0')}.jpg`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      
      try {
        await sharp(INPUT_PATH)
          .extract(cropRegion)
          .jpeg({ quality: 90 })
          .toFile(outputPath);
        
        const meta = METADATA[index - 1] || {};
        
        results.push({
          filename,
          index,
          ...meta,
          cropRegion,
        });
        
        console.log(`✓ Created ${filename} (${cropRegion.width}x${cropRegion.height})`);
      } catch (err) {
        console.error(`✗ Failed to create ${filename}:`, err.message);
      }
      
      index++;
    }
  }
  
  // Write metadata JSON
  const jsonPath = path.join(OUTPUT_DIR, 'gallery-metadata.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Metadata written to ${jsonPath}`);
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total images created: ${results.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  return results;
}

splitCollage().catch(console.error);
