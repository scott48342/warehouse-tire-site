/**
 * Seed: Add initial curated builds to gallery_builds
 * 
 * Run with: node scripts/seed-gallery-builds.mjs
 * 
 * This creates the initial 50-100 curated builds for the Build Gallery MVP.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("❌ POSTGRES_URL not set");
  process.exit(1);
}

const queryClient = postgres(connectionString, { max: 1 });
const db = drizzle(queryClient);

// Helper to generate slug
function generateSlug(build) {
  return [
    String(build.vehicle_year),
    build.vehicle_make,
    build.vehicle_model,
    build.wheel_brand,
    build.wheel_model,
    build.tire_brand,
    build.tire_model,
  ]
    .map(p => p.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Sample curated builds
const CURATED_BUILDS = [
  // === TRUCKS - Lifted ===
  {
    vehicle_year: 2024,
    vehicle_make: "Chevrolet",
    vehicle_model: "Silverado 1500",
    vehicle_trim: "RST",
    build_style: "lifted",
    lift_level: "6-inch",
    wheel_brand: "Fuel",
    wheel_model: "Rebel",
    wheel_size: "20x10",
    wheel_finish: "Matte Black",
    wheel_offset: "-18",
    wheel_bolt_pattern: "6x139.7",
    tire_brand: "Nitto",
    tire_model: "Ridge Grappler",
    tire_size: "35x12.50R20",
    hero_image_url: "/gallery/silverado-fuel-rebel-ridge-grappler.jpg",
    tags: ["truck", "silverado", "lifted", "aggressive"],
    is_featured: true,
    is_popular: true,
    display_order: 1,
  },
  {
    vehicle_year: 2023,
    vehicle_make: "Ford",
    vehicle_model: "F-150",
    vehicle_trim: "Lariat",
    build_style: "lifted",
    lift_level: "4-inch",
    wheel_brand: "Method",
    wheel_model: "NV305",
    wheel_size: "18x9",
    wheel_finish: "Matte Black",
    wheel_offset: "0",
    wheel_bolt_pattern: "6x135",
    tire_brand: "BFGoodrich",
    tire_model: "KO2",
    tire_size: "35x12.50R18",
    hero_image_url: "/gallery/f150-method-ko2.jpg",
    tags: ["truck", "f150", "lifted", "off-road"],
    is_featured: true,
    is_popular: true,
    display_order: 2,
  },
  {
    vehicle_year: 2024,
    vehicle_make: "Ram",
    vehicle_model: "1500",
    vehicle_trim: "Rebel",
    build_style: "lifted",
    lift_level: "6-inch",
    wheel_brand: "Fuel",
    wheel_model: "Blitz",
    wheel_size: "22x10",
    wheel_finish: "Gloss Black Milled",
    wheel_offset: "-18",
    wheel_bolt_pattern: "6x139.7",
    tire_brand: "Toyo",
    tire_model: "Open Country M/T",
    tire_size: "37x13.50R22",
    hero_image_url: "/gallery/ram-rebel-fuel-blitz-toyo.jpg",
    tags: ["truck", "ram", "lifted", "aggressive", "mud-terrain"],
    is_featured: true,
    display_order: 3,
  },
  
  // === TRUCKS - Leveled ===
  {
    vehicle_year: 2022,
    vehicle_make: "GMC",
    vehicle_model: "Sierra 1500",
    vehicle_trim: "AT4",
    build_style: "leveled",
    lift_level: "leveled",
    wheel_brand: "Fuel",
    wheel_model: "Vapor",
    wheel_size: "20x9",
    wheel_finish: "Matte Black",
    wheel_offset: "1",
    wheel_bolt_pattern: "6x139.7",
    tire_brand: "Falken",
    tire_model: "Wildpeak A/T3W",
    tire_size: "33x12.50R20",
    hero_image_url: "/gallery/sierra-at4-fuel-vapor-falken.jpg",
    tags: ["truck", "gmc", "leveled", "all-terrain"],
    is_popular: true,
    display_order: 10,
  },
  {
    vehicle_year: 2023,
    vehicle_make: "Toyota",
    vehicle_model: "Tundra",
    vehicle_trim: "TRD Pro",
    build_style: "leveled",
    lift_level: "leveled",
    wheel_brand: "Icon",
    wheel_model: "Rebound Pro",
    wheel_size: "17x8.5",
    wheel_finish: "Bronze",
    wheel_offset: "0",
    wheel_bolt_pattern: "6x139.7",
    tire_brand: "Nitto",
    tire_model: "Trail Grappler",
    tire_size: "35x12.50R17",
    hero_image_url: "/gallery/tundra-trd-icon-nitto.jpg",
    tags: ["truck", "toyota", "tundra", "trd-pro", "bronze-wheels"],
    is_featured: true,
    display_order: 11,
  },
  
  // === SUVs ===
  {
    vehicle_year: 2024,
    vehicle_make: "Chevrolet",
    vehicle_model: "Tahoe",
    vehicle_trim: "Z71",
    build_style: "leveled",
    lift_level: "leveled",
    wheel_brand: "Black Rhino",
    wheel_model: "Arsenal",
    wheel_size: "22x10",
    wheel_finish: "Matte Black",
    wheel_offset: "-12",
    wheel_bolt_pattern: "6x139.7",
    tire_brand: "Toyo",
    tire_model: "Open Country A/T III",
    tire_size: "305/45R22",
    hero_image_url: "/gallery/tahoe-z71-black-rhino-toyo.jpg",
    tags: ["suv", "tahoe", "leveled", "blackout"],
    is_featured: true,
    is_popular: true,
    display_order: 20,
  },
  {
    vehicle_year: 2023,
    vehicle_make: "Jeep",
    vehicle_model: "Wrangler",
    vehicle_trim: "Rubicon",
    build_style: "lifted",
    lift_level: "3.5-inch",
    wheel_brand: "Fuel",
    wheel_model: "Covert",
    wheel_size: "17x9",
    wheel_finish: "Matte Bronze",
    wheel_offset: "-12",
    wheel_bolt_pattern: "5x127",
    tire_brand: "BFGoodrich",
    tire_model: "KM3",
    tire_size: "37x12.50R17",
    hero_image_url: "/gallery/wrangler-rubicon-fuel-covert-bfg.jpg",
    tags: ["suv", "jeep", "wrangler", "rubicon", "off-road", "bronze-wheels"],
    is_featured: true,
    is_popular: true,
    display_order: 21,
  },
  
  // === TRUCKS - Blackout ===
  {
    vehicle_year: 2024,
    vehicle_make: "Ford",
    vehicle_model: "F-150",
    vehicle_trim: "XLT",
    build_style: "blackout",
    lift_level: "leveled",
    wheel_brand: "Fuel",
    wheel_model: "Maverick",
    wheel_size: "20x9",
    wheel_finish: "Gloss Black",
    wheel_offset: "1",
    wheel_bolt_pattern: "6x135",
    tire_brand: "Nitto",
    tire_model: "Terra Grappler G2",
    tire_size: "295/60R20",
    hero_image_url: "/gallery/f150-blackout-fuel-maverick.jpg",
    tags: ["truck", "f150", "blackout", "leveled"],
    is_popular: true,
    display_order: 30,
  },
  
  // === HD Trucks ===
  {
    vehicle_year: 2023,
    vehicle_make: "Ford",
    vehicle_model: "F-250",
    vehicle_trim: "Lariat",
    build_style: "lifted",
    lift_level: "4-inch",
    wheel_brand: "American Force",
    wheel_model: "Independence",
    wheel_size: "22x10",
    wheel_finish: "Polished",
    wheel_offset: "-25",
    wheel_bolt_pattern: "8x170",
    tire_brand: "Toyo",
    tire_model: "Open Country M/T",
    tire_size: "37x13.50R22",
    hero_image_url: "/gallery/f250-american-force-toyo.jpg",
    tags: ["truck", "f250", "super-duty", "lifted", "american-force"],
    is_featured: true,
    display_order: 40,
  },
  {
    vehicle_year: 2024,
    vehicle_make: "Chevrolet",
    vehicle_model: "Silverado 2500HD",
    vehicle_trim: "High Country",
    build_style: "lifted",
    lift_level: "6-inch",
    wheel_brand: "Fuel",
    wheel_model: "Forged FF19",
    wheel_size: "24x12",
    wheel_finish: "Polished",
    wheel_offset: "-44",
    wheel_bolt_pattern: "8x180",
    tire_brand: "Nitto",
    tire_model: "Trail Grappler",
    tire_size: "37x13.50R24",
    hero_image_url: "/gallery/silverado-2500-fuel-forged-nitto.jpg",
    tags: ["truck", "silverado", "2500hd", "lifted", "forged-wheels"],
    is_featured: true,
    display_order: 41,
  },
  
  // === Performance Cars ===
  {
    vehicle_year: 2024,
    vehicle_make: "Ford",
    vehicle_model: "Mustang",
    vehicle_trim: "GT",
    build_style: "aggressive-street",
    wheel_brand: "Niche",
    wheel_model: "Misano",
    wheel_size: "20x9/20x10.5",
    wheel_finish: "Matte Black",
    wheel_offset: "+35/+45",
    wheel_bolt_pattern: "5x114.3",
    tire_brand: "Michelin",
    tire_model: "Pilot Sport 4S",
    tire_size: "275/35R20 / 305/30R20",
    hero_image_url: "/gallery/mustang-gt-niche-misano-michelin.jpg",
    tags: ["muscle", "mustang", "staggered", "performance"],
    is_featured: true,
    is_popular: true,
    display_order: 50,
  },
  {
    vehicle_year: 2023,
    vehicle_make: "Chevrolet",
    vehicle_model: "Camaro",
    vehicle_trim: "SS",
    build_style: "aggressive-street",
    wheel_brand: "Vossen",
    wheel_model: "HF-5",
    wheel_size: "20x9/20x11",
    wheel_finish: "Gloss Graphite",
    wheel_offset: "+32/+55",
    wheel_bolt_pattern: "5x120",
    tire_brand: "Continental",
    tire_model: "ExtremeContact Sport 02",
    tire_size: "275/35R20 / 305/30R20",
    hero_image_url: "/gallery/camaro-ss-vossen-hf5-continental.jpg",
    tags: ["muscle", "camaro", "staggered", "performance"],
    is_popular: true,
    display_order: 51,
  },
  
  // === Towing Builds ===
  {
    vehicle_year: 2024,
    vehicle_make: "Ram",
    vehicle_model: "3500",
    vehicle_trim: "Laramie",
    build_style: "towing",
    wheel_brand: "Fuel",
    wheel_model: "Cleaver Dually",
    wheel_size: "20x8.25",
    wheel_finish: "Gloss Black Milled",
    wheel_bolt_pattern: "8x165.1",
    tire_brand: "Michelin",
    tire_model: "XPS Rib",
    tire_size: "LT225/70R19.5",
    hero_image_url: "/gallery/ram-3500-dually-fuel-cleaver.jpg",
    tags: ["truck", "ram", "3500", "dually", "towing"],
    is_featured: true,
    display_order: 60,
  },
];

async function seed() {
  console.log("🌱 Seeding gallery builds...\n");
  
  let inserted = 0;
  let skipped = 0;
  
  for (const build of CURATED_BUILDS) {
    const slug = generateSlug(build);
    
    try {
      // Check if exists
      const existing = await queryClient`
        SELECT id FROM gallery_builds WHERE slug = ${slug} LIMIT 1
      `;
      
      if (existing.length > 0) {
        console.log(`  ⏭️  Skipped (exists): ${slug}`);
        skipped++;
        continue;
      }
      
      // Insert
      await queryClient`
        INSERT INTO gallery_builds (
          slug, vehicle_year, vehicle_make, vehicle_model, vehicle_trim,
          build_style, lift_level,
          wheel_brand, wheel_model, wheel_size, wheel_finish, wheel_offset, wheel_bolt_pattern,
          tire_brand, tire_model, tire_size,
          hero_image_url, tags, is_featured, is_popular, display_order
        ) VALUES (
          ${slug}, ${build.vehicle_year}, ${build.vehicle_make}, ${build.vehicle_model}, ${build.vehicle_trim || null},
          ${build.build_style}, ${build.lift_level || null},
          ${build.wheel_brand}, ${build.wheel_model}, ${build.wheel_size}, ${build.wheel_finish || null}, ${build.wheel_offset || null}, ${build.wheel_bolt_pattern || null},
          ${build.tire_brand}, ${build.tire_model}, ${build.tire_size},
          ${build.hero_image_url}, ${JSON.stringify(build.tags || [])}, ${build.is_featured || false}, ${build.is_popular || false}, ${build.display_order || 1000}
        )
      `;
      
      console.log(`  ✅ Inserted: ${slug}`);
      inserted++;
      
    } catch (error) {
      console.error(`  ❌ Failed: ${slug}`, error.message);
    }
  }
  
  console.log(`\n📊 Summary: ${inserted} inserted, ${skipped} skipped`);
  console.log("✅ Seeding complete!");
  
  await queryClient.end();
}

seed().catch(console.error);
