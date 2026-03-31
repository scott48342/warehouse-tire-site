/**
 * Backfill Tire Images from TireLibrary
 * 
 * Uses the existing Tirewire client to fetch pattern data and cache images.
 * 
 * Run: npx tsx scripts/backfill-tire-images.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { searchTiresTirewire, type TirewireSearchResult } from '../src/lib/tirewire/client';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Common tire sizes to query (gets us pattern images across brands)
const COMMON_SIZES = [
  '265/70R17', '275/55R20', '275/60R20', '265/60R20', '285/65R18',
  '275/65R18', '265/65R17', '275/70R18', '285/70R17', '265/75R16',
  '225/65R17', '235/65R17', '245/65R17', '255/65R17', '245/70R17',
  '255/70R18', '265/60R18', '275/60R18', '245/60R18', '255/60R18',
  '235/55R19', '245/55R19', '255/55R19', '235/50R18', '245/50R18',
  '225/45R17', '235/45R17', '245/45R17', '225/40R18', '235/40R18',
  '305/55R20', '295/55R20', '285/55R20', '325/50R22', '305/45R22',
  '275/65R20', '285/60R20', '295/60R20', '305/50R20', '275/45R22',
  '265/50R20', '275/50R20', '285/50R20', '295/50R20', '305/45R20',
];

interface PatternData {
  brand: string;
  pattern: string;
  patternId: number | null;
  imageUrl: string;
}

/**
 * Extract pattern data from Tirewire results and cache
 */
async function cachePatterns(patterns: PatternData[]): Promise<{ inserted: number }> {
  let inserted = 0;
  
  for (const p of patterns) {
    if (!p.imageUrl) continue;
    
    try {
      const result = await pool.query(`
        INSERT INTO tire_library_patterns (brand, pattern, pattern_id, image_url, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (brand, pattern) DO UPDATE SET
          pattern_id = COALESCE(EXCLUDED.pattern_id, tire_library_patterns.pattern_id),
          image_url = COALESCE(EXCLUDED.image_url, tire_library_patterns.image_url),
          updated_at = NOW()
        RETURNING id
      `, [p.brand, p.pattern, p.patternId, p.imageUrl]);
      
      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      }
    } catch {
      // Likely duplicate, ignore
    }
  }
  
  return { inserted };
}

/**
 * Main backfill process
 */
async function main(): Promise<void> {
  console.log('=== Tire Image Backfill ===\n');
  
  let totalPatterns = 0;
  let totalTires = 0;
  const seenPatterns = new Set<string>();
  
  for (const size of COMMON_SIZES) {
    process.stdout.write(`  ${size}...`);
    
    try {
      const results = await searchTiresTirewire(size);
      
      if (!results || results.length === 0) {
        console.log(' no results');
        continue;
      }
      
      // Extract unique patterns with images
      const patterns: PatternData[] = [];
      for (const result of results) {
        for (const tire of result.tires) {
          const key = `${tire.make}:${tire.pattern}`;
          if (seenPatterns.has(key)) continue;
          seenPatterns.add(key);
          
          // Build image URL from pattern ID if not provided
          const imageUrl = tire.imageUrl || 
            (tire.patternId ? `https://tireweb.tirelibrary.com/images/Products/${tire.patternId}.jpg` : null);
          
          if (imageUrl) {
            patterns.push({
              brand: tire.make,
              pattern: tire.pattern,
              patternId: tire.patternId,
              imageUrl,
            });
          }
          totalTires++;
        }
      }
      
      const { inserted } = await cachePatterns(patterns);
      totalPatterns += inserted;
      
      console.log(` ${totalTires} tires, +${inserted} patterns`);
      
    } catch (err: any) {
      console.log(` ERROR: ${err.message}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n✓ Cached ${totalPatterns} new patterns from ${totalTires} tires`);
  
  // Show stats
  const { rows } = await pool.query(`
    SELECT 
      COUNT(*) AS total_patterns,
      COUNT(DISTINCT brand) AS unique_brands,
      COUNT(*) FILTER (WHERE image_url IS NOT NULL) AS with_images
    FROM tire_library_patterns
  `);
  console.log('\nDatabase stats:', rows[0]);
  
  // Show sample patterns
  const { rows: sample } = await pool.query(`
    SELECT brand, pattern, image_url 
    FROM tire_library_patterns 
    ORDER BY brand 
    LIMIT 10
  `);
  console.log('\nSample patterns:');
  for (const p of sample) {
    const url = (p.image_url as string)?.slice(0, 50) || '';
    console.log(`  ${p.brand} - ${p.pattern}: ${url}...`);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
