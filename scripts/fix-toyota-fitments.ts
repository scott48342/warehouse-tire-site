/**
 * Fix Toyota Vehicle Fitments
 * Updates missing tire sizes and wheel specs for Toyota models
 * 
 * Data source: Google AI Overview (aggregated from multiple OEM sources)
 * Research date: 2026-04-26
 * 
 * Vehicles covered:
 * - Toyota Sequoia (2001-2026)
 * - Toyota Tacoma (2016-2026)
 * - Toyota Sienna (2011-2026)
 * - Toyota RAV4 (2019-2026)
 * - Toyota Highlander (2001-2026)
 * - Toyota Land Cruiser (2000-2026)
 * - Toyota Supra A90/A91 (2020-2026)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

// Helper to extract wheel diameter from tire size (e.g., "265/70R18" -> 18)
function extractDiameter(tireSize: string): number {
  const match = tireSize.match(/R(\d+\.?\d*)/i);
  return match ? parseFloat(match[1]) : 17;
}

// Helper to estimate wheel width from tire width (rough OEM estimate)
function estimateWheelWidth(tireSize: string): number {
  const match = tireSize.match(/^(\d+)/);
  if (!match) return 7;
  const tireWidth = parseInt(match[1]);
  // OEM wheels are typically tire width / 25.4 - 0.5 to -1 inch
  if (tireWidth >= 285) return 9;
  if (tireWidth >= 275) return 8.5;
  if (tireWidth >= 265) return 8;
  if (tireWidth >= 255) return 8;
  if (tireWidth >= 245) return 7.5;
  if (tireWidth >= 235) return 7.5;
  if (tireWidth >= 225) return 7;
  return 6.5;
}

// Type definitions
interface TrimSpec {
  name: string;
  frontTire: string;
  rearTire?: string;
  boltPattern: string;
  frontWheelWidth?: number;
  rearWheelWidth?: number;
  frontOffset?: number;
  rearOffset?: number;
}

interface VehicleSpec {
  make: string;
  model: string;
  years: number[];
  trims: TrimSpec[];
}

// Fitment data from tiresize.com research
const fitmentData: VehicleSpec[] = [
  // =========================================
  // TOYOTA SEQUOIA (2001-2026)
  // =========================================
  
  // 1st Gen Sequoia (2001-2007)
  {
    make: "Toyota", model: "Sequoia", years: [2001, 2002],
    trims: [
      { name: "SR5", frontTire: "265/70R16", boltPattern: "5x150", frontWheelWidth: 7, frontOffset: 30 },
      { name: "Limited", frontTire: "265/70R16", boltPattern: "5x150", frontWheelWidth: 7, frontOffset: 30 },
    ]
  },
  {
    make: "Toyota", model: "Sequoia", years: [2003, 2004, 2005, 2006, 2007],
    trims: [
      { name: "SR5", frontTire: "265/65R17", boltPattern: "5x150", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "Limited", frontTire: "265/65R17", boltPattern: "5x150", frontWheelWidth: 7.5, frontOffset: 30 },
    ]
  },
  
  // 2nd Gen Sequoia (2008-2022)
  {
    make: "Toyota", model: "Sequoia", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017],
    trims: [
      { name: "SR5", frontTire: "275/65R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Limited", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Platinum", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  {
    make: "Toyota", model: "Sequoia", years: [2018, 2019],
    trims: [
      { name: "SR5", frontTire: "275/65R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Limited", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Platinum", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "TRD Sport", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  {
    make: "Toyota", model: "Sequoia", years: [2020, 2021, 2022],
    trims: [
      { name: "SR5", frontTire: "275/65R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Limited", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Platinum", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "TRD Pro", frontTire: "275/65R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "TRD Sport", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Nightshade Edition", frontTire: "275/55R20", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  
  // 3rd Gen Sequoia (2023-2026) - New platform
  {
    make: "Toyota", model: "Sequoia", years: [2023, 2024, 2025, 2026],
    trims: [
      { name: "SR5", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "Limited", frontTire: "265/60R20", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "Platinum", frontTire: "265/60R20", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "TRD Pro", frontTire: "285/65R18", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "TRD Off-Road Package", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "TRD Sport Package", frontTire: "265/60R20", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
      { name: "Capstone", frontTire: "265/50R22", boltPattern: "6x139.7", frontWheelWidth: 8.5, frontOffset: 55 },
      { name: "1794 Edition", frontTire: "265/60R20", boltPattern: "6x139.7", frontWheelWidth: 8, frontOffset: 55 },
    ]
  },

  // =========================================
  // TOYOTA TACOMA (2016-2026)
  // =========================================
  
  // 3rd Gen Tacoma (2016-2023)
  {
    make: "Toyota", model: "Tacoma", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    trims: [
      { name: "SR", frontTire: "245/75R16", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "SR5", frontTire: "245/75R16", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "TRD Sport", frontTire: "265/65R17", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "TRD Off-Road", frontTire: "265/70R16", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "TRD Pro", frontTire: "265/70R16", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "Limited", frontTire: "265/60R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
    ]
  },
  
  // 4th Gen Tacoma (2024-2026)
  {
    make: "Toyota", model: "Tacoma", years: [2024, 2025, 2026],
    trims: [
      { name: "SR", frontTire: "245/70R17", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "SR5", frontTire: "245/70R17", boltPattern: "6x139.7", frontWheelWidth: 7, frontOffset: 30 },
      { name: "TRD Sport", frontTire: "265/65R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "TRD Off-Road", frontTire: "265/70R17", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "TRD PreRunner", frontTire: "265/70R17", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "TRD Pro", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "Trailhunter", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
      { name: "Limited", frontTire: "265/65R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 30 },
    ]
  },

  // =========================================
  // TOYOTA SIENNA (2011-2026)
  // =========================================
  
  // 3rd Gen Sienna (2011-2020)
  {
    make: "Toyota", model: "Sienna", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020],
    trims: [
      { name: "L", frontTire: "235/60R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 42 },
      { name: "LE", frontTire: "235/60R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 42 },
      { name: "XLE", frontTire: "235/60R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 42 },
      { name: "LE AWD", frontTire: "235/55R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "XLE AWD", frontTire: "235/55R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "Limited", frontTire: "235/55R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "Limited AWD", frontTire: "235/55R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "SE", frontTire: "235/50R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
    ]
  },
  
  // 4th Gen Sienna (2021-2026) - Hybrid only
  {
    make: "Toyota", model: "Sienna", years: [2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      { name: "LE", frontTire: "235/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 42 },
      { name: "XLE", frontTire: "235/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 42 },
      { name: "Limited", frontTire: "235/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "XSE AWD", frontTire: "235/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "XSE FWD", frontTire: "235/50R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 42 },
      { name: "Platinum AWD", frontTire: "235/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "Platinum FWD", frontTire: "235/50R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 42 },
      { name: "Woodlands Edition", frontTire: "235/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
      { name: "25th Anniversary Edition", frontTire: "235/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 42 },
    ]
  },

  // =========================================
  // TOYOTA RAV4 (2019-2026)
  // =========================================
  
  // 5th Gen RAV4 (2019-2026)
  {
    make: "Toyota", model: "RAV4", years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      { name: "LE", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 45 },
      { name: "LE Hybrid", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 45 },
      { name: "XLE", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 45 },
      { name: "XLE Hybrid", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 45 },
      { name: "XLE Premium", frontTire: "235/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "XLE Premium Hybrid", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "XSE Hybrid", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "SE Hybrid", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Adventure", frontTire: "235/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "TRD Off-Road", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Limited", frontTire: "235/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Limited Hybrid", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Prime SE", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Prime XSE", frontTire: "235/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
      { name: "Woodland Edition Hybrid", frontTire: "225/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 45 },
    ]
  },

  // =========================================
  // TOYOTA HIGHLANDER (2001-2026)
  // =========================================
  
  // 1st Gen Highlander (2001-2007)
  {
    make: "Toyota", model: "Highlander", years: [2001, 2002, 2003],
    trims: [
      { name: "Base", frontTire: "225/70R16", boltPattern: "5x114.3", frontWheelWidth: 6.5, frontOffset: 40 },
      { name: "Limited", frontTire: "225/70R16", boltPattern: "5x114.3", frontWheelWidth: 6.5, frontOffset: 40 },
    ]
  },
  {
    make: "Toyota", model: "Highlander", years: [2004, 2005, 2006, 2007],
    trims: [
      { name: "Base", frontTire: "225/70R16", boltPattern: "5x114.3", frontWheelWidth: 6.5, frontOffset: 40 },
      { name: "Limited", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
      { name: "Hybrid", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
      { name: "Sport", frontTire: "225/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
    ]
  },
  
  // 2nd Gen Highlander (2008-2013)
  {
    make: "Toyota", model: "Highlander", years: [2008, 2009, 2010, 2011, 2012, 2013],
    trims: [
      { name: "Base", frontTire: "245/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
      { name: "SE", frontTire: "245/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
      { name: "Hybrid", frontTire: "245/65R17", boltPattern: "5x114.3", frontWheelWidth: 7, frontOffset: 40 },
      { name: "Sport", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Limited", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid Limited", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
    ]
  },
  
  // 3rd Gen Highlander (2014-2019)
  {
    make: "Toyota", model: "Highlander", years: [2014, 2015, 2016, 2017, 2018, 2019],
    trims: [
      { name: "LE", frontTire: "245/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "LE Plus", frontTire: "245/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "XLE", frontTire: "245/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid LE", frontTire: "245/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid XLE", frontTire: "245/60R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "SE", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Limited", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid Limited", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Limited Platinum", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid Platinum", frontTire: "245/55R19", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
    ]
  },
  
  // 4th Gen Highlander (2020-2026)
  {
    make: "Toyota", model: "Highlander", years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      { name: "L", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "LE", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "XLE", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid LE", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid XLE", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid Bronze Edition", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "XSE", frontTire: "235/55R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 40 },
      { name: "Limited", frontTire: "235/55R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 40 },
      { name: "Platinum", frontTire: "235/55R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 40 },
      { name: "Hybrid Limited", frontTire: "235/55R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 40 },
      { name: "Hybrid Platinum", frontTire: "235/55R20", boltPattern: "5x114.3", frontWheelWidth: 8, frontOffset: 40 },
      { name: "Hybrid XLE Nightshade", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
      { name: "Hybrid LE Nightshade", frontTire: "235/65R18", boltPattern: "5x114.3", frontWheelWidth: 7.5, frontOffset: 40 },
    ]
  },

  // =========================================
  // TOYOTA LAND CRUISER (2000-2026)
  // =========================================
  
  // 100 Series (1998-2007)
  {
    make: "Toyota", model: "Land Cruiser", years: [2000, 2001, 2002],
    trims: [
      { name: "Base", frontTire: "275/70R16", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  {
    make: "Toyota", model: "Land Cruiser", years: [2003, 2004, 2005, 2006, 2007],
    trims: [
      { name: "Base", frontTire: "275/60R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  
  // 200 Series (2008-2021)
  {
    make: "Toyota", model: "Land Cruiser", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    trims: [
      { name: "Base", frontTire: "285/60R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
      { name: "Heritage Edition", frontTire: "285/60R18", boltPattern: "5x150", frontWheelWidth: 8, frontOffset: 60 },
    ]
  },
  
  // 300 Series (2024+) - New smaller platform
  {
    make: "Toyota", model: "Land Cruiser", years: [2024, 2025, 2026],
    trims: [
      { name: "Base", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 25 },
      { name: "1958 Edition", frontTire: "245/70R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 25 },
      { name: "First Edition", frontTire: "265/70R18", boltPattern: "6x139.7", frontWheelWidth: 7.5, frontOffset: 25 },
    ]
  },

  // =========================================
  // TOYOTA SUPRA A90/A91 (2020-2026) - STAGGERED
  // =========================================
  
  {
    make: "Toyota", model: "Supra", years: [2020],
    trims: [
      { 
        name: "3.0", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "3.0 Premium", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "Launch Edition", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
    ]
  },
  {
    make: "Toyota", model: "Supra", years: [2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      { 
        name: "2.0", 
        frontTire: "255/40ZR18", rearTire: "275/40ZR18",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "3.0", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "3.0 Premium", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "A91 Edition", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "45th Anniversary", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "MkV Final Edition", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
    ]
  },

  // =========================================
  // TOYOTA GR SUPRA (alias)
  // =========================================
  {
    make: "Toyota", model: "GR Supra", years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      { 
        name: "3.0", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
      { 
        name: "3.0 Premium", 
        frontTire: "255/35ZR19", rearTire: "275/35ZR19",
        boltPattern: "5x112",
        frontWheelWidth: 9, rearWheelWidth: 10,
        frontOffset: 32, rearOffset: 40,
      },
    ]
  },
];

async function main() {
  console.log("Updating Toyota vehicle fitments...\n");
  console.log(`Processing ${fitmentData.length} vehicle configurations...`);

  let updatedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Determine if staggered (different front/rear tires)
        const isStaggered = trim.rearTire && trim.frontTire !== trim.rearTire;
        const rearTire = trim.rearTire || trim.frontTire;
        
        // Extract diameters
        const frontDiameter = extractDiameter(trim.frontTire);
        const rearDiameter = extractDiameter(rearTire);
        
        // Determine wheel widths
        const frontWidth = trim.frontWheelWidth || estimateWheelWidth(trim.frontTire);
        const rearWidth = trim.rearWheelWidth || estimateWheelWidth(rearTire);
        
        // Determine offsets
        const frontOffset = trim.frontOffset || null;
        const rearOffset = trim.rearOffset || frontOffset;

        // Build wheel sizes JSON
        const oemWheelSizes = [
          {
            position: "front",
            diameter: frontDiameter,
            width: frontWidth,
            offset: frontOffset,
            boltPattern: trim.boltPattern,
          },
          {
            position: "rear",
            diameter: rearDiameter,
            width: rearWidth,
            offset: rearOffset,
            boltPattern: trim.boltPattern,
          },
        ];

        // Build tire sizes JSON
        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: rearTire },
        ];

        // Generate modification_id
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        // Check if record exists
        const existing = await db.execute(sql`
          SELECT id, oem_tire_sizes FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (LOWER(model) = ${vehicle.model.toLowerCase()} 
                 OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')})
            AND (LOWER(display_trim) = ${trim.name.toLowerCase()} 
                 OR LOWER(modification_id) LIKE ${'%' + trim.name.toLowerCase().replace(/\s+/g, '-') + '%'})
          LIMIT 1
        `);

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        if (existing.rows.length > 0) {
          const row = existing.rows[0] as any;
          
          // Skip if already has complete tire sizes
          if (row.oem_tire_sizes && row.oem_tire_sizes.length >= 2) {
            skippedCount++;
            continue;
          }
          
          // Update existing record
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              quality_tier = 'complete',
              source = 'google-ai-overview',
              updated_at = NOW()
            WHERE id = ${row.id}
          `);
          console.log(`  Updated: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          updatedCount++;
        } else {
          // Insert new record
          await db.execute(sql`
            INSERT INTO vehicle_fitments (
              year, make, model, modification_id, display_trim,
              oem_wheel_sizes, oem_tire_sizes, quality_tier, source,
              created_at, updated_at
            ) VALUES (
              ${year}, ${vehicle.make}, ${vehicle.model}, ${modificationId}, ${trim.name},
              ${wheelSizesJson}::jsonb, ${tireSizesJson}::jsonb, 'complete', 'google-ai-overview',
              NOW(), NOW()
            )
          `);
          console.log(`  Inserted: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          insertedCount++;
        }
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Updated: ${updatedCount} records`);
  console.log(`Inserted: ${insertedCount} records`);
  console.log(`Skipped (already complete): ${skippedCount} records`);
  console.log(`Total processed: ${updatedCount + insertedCount + skippedCount}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
