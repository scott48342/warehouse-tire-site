/**
 * Fix Mercedes-Benz Remaining Fitments
 * Updates missing tire sizes and wheel specs for ALL Mercedes-Benz vehicles
 * 
 * Data sourced from Google AI Overview searches (2026-04-26)
 * Search pattern: "{Make} {Model} OEM wheel and tire sizes by trim"
 * 
 * Coverage (810 records):
 * - E-Class (128 records) - ALL generations/trims
 * - C-Class (123 records) - ALL generations/trims
 * - S-Class (109 records) - ALL generations/trims
 * - CLA (52 records)
 * - GLA (48 records)
 * - GLE (45 records)
 * - GLC (32 records)
 * - S-Class AMG (25 records)
 * - G-Class (24 records)
 * - E-Class AMG (24 records)
 * - G-Class AMG (22 records)
 * - SL-Class AMG (21 records)
 * - SL-Class (19 records)
 * - CLS-Class AMG (18 records)
 * - SLK-Class (17 records)
 * - M-Class AMG (16 records)
 * - SLK-Class AMG (15 records)
 * - E-Class Coupe/Cabriolet (27 records)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

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

// Helper to generate year ranges
function yearRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Wheel spec helper
interface WheelSpec {
  diameter: number;
  width: number;
  offset: number;
}

interface TrimSpec {
  name: string;
  aliases?: string[];
  frontWheel: WheelSpec;
  rearWheel: WheelSpec;
  frontTire: string;
  rearTire: string;
  boltPattern: string;
  isStaggered: boolean;
}

interface VehicleSpec {
  make: string;
  model: string;
  modelAliases?: string[];
  years: number[];
  trims: TrimSpec[];
}

// ==========================================
// COMPREHENSIVE MERCEDES-BENZ FITMENT DATA
// ==========================================

const fitmentData: VehicleSpec[] = [
  // ==========================================
  // E-CLASS (All generations)
  // ==========================================
  
  // W214 E-Class (2024-2026)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2024, 2026),
    trims: [
      {
        name: "E300", aliases: ["E 300", "E-300"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18", rearTire: "225/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E350", aliases: ["E 350", "E-350"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18", rearTire: "225/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E350 4MATIC", aliases: ["E 350 4MATIC"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18", rearTire: "225/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E450", aliases: ["E 450", "E-450"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E450 4MATIC", aliases: ["E 450 4MATIC"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E53 AMG", aliases: ["AMG E53", "AMG E 53", "E-53 AMG", "E 53 AMG"],
        frontWheel: { diameter: 20, width: 8.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/40R20", rearTire: "295/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG", aliases: ["AMG E63", "AMG E 63", "E-63 AMG", "E 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/35R19", rearTire: "295/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG S", aliases: ["AMG E63 S", "E63S AMG", "E 63 AMG S"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/35R20", rearTire: "295/30R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W213 E-Class (2017-2023)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2017, 2023),
    trims: [
      {
        name: "E300", aliases: ["E 300", "E-300"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 48 },
        frontTire: "225/55R17", rearTire: "245/50R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E300 4MATIC", aliases: ["E 300 4MATIC"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 48 },
        frontTire: "225/55R17", rearTire: "245/50R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E350", aliases: ["E 350", "E-350"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 51 },
        frontTire: "245/45R18", rearTire: "275/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E400", aliases: ["E 400", "E-400"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 51 },
        frontTire: "245/45R18", rearTire: "275/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E450", aliases: ["E 450", "E-450"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E53 AMG", aliases: ["AMG E53", "AMG E 53"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG", aliases: ["AMG E63", "AMG E 63"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/35R19", rearTire: "295/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG S", aliases: ["AMG E63 S", "E63S AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/35R20", rearTire: "295/30R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W212 E-Class (2010-2016)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2010, 2016),
    trims: [
      {
        name: "E250", aliases: ["E 250", "E-250"],
        frontWheel: { diameter: 17, width: 8, offset: 52 },
        rearWheel: { diameter: 17, width: 9, offset: 54 },
        frontTire: "245/45R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E350", aliases: ["E 350", "E-350"],
        frontWheel: { diameter: 17, width: 8, offset: 52 },
        rearWheel: { diameter: 17, width: 9, offset: 54 },
        frontTire: "245/45R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E400", aliases: ["E 400", "E-400"],
        frontWheel: { diameter: 18, width: 8, offset: 48 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E550", aliases: ["E 550", "E-550"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18", rearTire: "285/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG", aliases: ["AMG E63", "AMG E 63", "E 63 AMG"],
        frontWheel: { diameter: 18, width: 9, offset: 38 },
        rearWheel: { diameter: 18, width: 10, offset: 48 },
        frontTire: "255/35R18", rearTire: "285/30R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W211 E-Class (2003-2009)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2003, 2009),
    trims: [
      {
        name: "E320", aliases: ["E 320", "E-320"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/50R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E350", aliases: ["E 350", "E-350"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/50R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E500", aliases: ["E 500", "E-500"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 39 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E55 AMG", aliases: ["AMG E55", "E 55 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9.5, offset: 39 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG", aliases: ["AMG E63", "E 63 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9.5, offset: 39 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W210 E-Class (1996-2002)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(1996, 2002),
    trims: [
      {
        name: "E300", aliases: ["E 300", "E-300", "E320", "E 320"],
        frontWheel: { diameter: 16, width: 7.5, offset: 35 },
        rearWheel: { diameter: 16, width: 8.5, offset: 35 },
        frontTire: "215/55R16", rearTire: "235/55R16",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E430", aliases: ["E 430", "E-430"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/50R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E55 AMG", aliases: ["AMG E55", "E 55 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 35 },
        rearWheel: { diameter: 18, width: 9, offset: 35 },
        frontTire: "245/40R18", rearTire: "275/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // E-CLASS COUPE (C207/A207: 2010-2017, C238: 2018-2023)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "E-Class Coupe", modelAliases: ["E-Class Coupe", "E Coupe"],
    years: yearRange(2018, 2023),
    trims: [
      {
        name: "E400 Coupe", aliases: ["E400", "E 400"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 51 },
        frontTire: "245/45R18", rearTire: "275/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E450 Coupe", aliases: ["E450", "E 450"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E53 AMG Coupe", aliases: ["AMG E53", "E53 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "E-Class Coupe", modelAliases: ["E-Class Coupe", "E Coupe"],
    years: yearRange(2010, 2017),
    trims: [
      {
        name: "E350 Coupe", aliases: ["E350", "E 350"],
        frontWheel: { diameter: 17, width: 8, offset: 52 },
        rearWheel: { diameter: 17, width: 9, offset: 54 },
        frontTire: "245/45R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E400 Coupe", aliases: ["E400", "E 400"],
        frontWheel: { diameter: 18, width: 8, offset: 48 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E550 Coupe", aliases: ["E550", "E 550"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18", rearTire: "285/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // E-CLASS CABRIOLET (A207: 2011-2017, A238: 2018-2023)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "E-Class Cabriolet", modelAliases: ["E-Class Cabriolet", "E Cabriolet", "E-Class Convertible"],
    years: yearRange(2018, 2023),
    trims: [
      {
        name: "E450 Cabriolet", aliases: ["E450", "E 450"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E53 AMG Cabriolet", aliases: ["AMG E53", "E53 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "E-Class Cabriolet", modelAliases: ["E-Class Cabriolet", "E Cabriolet"],
    years: yearRange(2011, 2017),
    trims: [
      {
        name: "E350 Cabriolet", aliases: ["E350", "E 350"],
        frontWheel: { diameter: 17, width: 8, offset: 52 },
        rearWheel: { diameter: 17, width: 9, offset: 54 },
        frontTire: "245/45R17", rearTire: "245/45R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "E400 Cabriolet", aliases: ["E400", "E 400"],
        frontWheel: { diameter: 18, width: 8, offset: 48 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E550 Cabriolet", aliases: ["E550", "E 550"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18", rearTire: "285/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // E-CLASS AMG (standalone model)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "E-Class AMG", modelAliases: ["E-Class AMG", "E Class AMG"],
    years: yearRange(2017, 2026),
    trims: [
      {
        name: "E53 AMG", aliases: ["AMG E53", "E53", "E 53 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG", aliases: ["AMG E63", "E63", "E 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/35R19", rearTire: "295/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG S", aliases: ["AMG E63 S", "E63S", "E 63 AMG S", "E63S AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/35R20", rearTire: "295/30R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "E-Class AMG", modelAliases: ["E-Class AMG"],
    years: yearRange(2010, 2016),
    trims: [
      {
        name: "E63 AMG", aliases: ["AMG E63", "E63", "E 63 AMG"],
        frontWheel: { diameter: 18, width: 9, offset: 38 },
        rearWheel: { diameter: 18, width: 10, offset: 48 },
        frontTire: "255/35R18", rearTire: "285/30R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "E63 AMG S", aliases: ["AMG E63 S", "E63S", "E 63 AMG S"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // C-CLASS (All generations)
  // ==========================================
  
  // W206 C-Class (2022-2026)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2022, 2026),
    trims: [
      {
        name: "C300", aliases: ["C 300", "C-300"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C300 4MATIC", aliases: ["C 300 4MATIC"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C350", aliases: ["C 350", "C-350"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C400", aliases: ["C 400", "C-400"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C43 AMG", aliases: ["AMG C43", "AMG C 43", "C 43 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG", aliases: ["AMG C63", "AMG C 63", "C 63 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/40R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG S", aliases: ["AMG C63 S", "C63S AMG", "C 63 AMG S"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/40R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W205 C-Class (2015-2021)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2015, 2021),
    trims: [
      {
        name: "C300", aliases: ["C 300", "C-300"],
        frontWheel: { diameter: 17, width: 7, offset: 48.5 },
        rearWheel: { diameter: 17, width: 7, offset: 48.5 },
        frontTire: "225/50R17", rearTire: "225/50R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "C300 4MATIC", aliases: ["C 300 4MATIC"],
        frontWheel: { diameter: 17, width: 7, offset: 48.5 },
        rearWheel: { diameter: 17, width: 7, offset: 48.5 },
        frontTire: "225/50R17", rearTire: "225/50R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "C300 Sport", aliases: ["C 300 Sport"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C350", aliases: ["C 350", "C-350"],
        frontWheel: { diameter: 17, width: 7, offset: 48.5 },
        rearWheel: { diameter: 17, width: 7, offset: 48.5 },
        frontTire: "225/50R17", rearTire: "225/50R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "C400", aliases: ["C 400", "C-400"],
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18", rearTire: "245/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C43 AMG", aliases: ["AMG C43", "C 43 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "225/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG", aliases: ["AMG C63", "C 63 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 47 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG S", aliases: ["AMG C63 S", "C63S AMG", "C 63 AMG S"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W204 C-Class (2008-2014)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2008, 2014),
    trims: [
      {
        name: "C250", aliases: ["C 250", "C-250"],
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C300", aliases: ["C 300", "C-300"],
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C350", aliases: ["C 350", "C-350"],
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C400", aliases: ["C 400", "C-400"],
        frontWheel: { diameter: 18, width: 7.5, offset: 47 },
        rearWheel: { diameter: 18, width: 8.5, offset: 58 },
        frontTire: "225/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG", aliases: ["AMG C63", "C 63 AMG"],
        frontWheel: { diameter: 18, width: 8.5, offset: 42 },
        rearWheel: { diameter: 18, width: 9.5, offset: 47 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W203 C-Class (2001-2007)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2001, 2007),
    trims: [
      {
        name: "C230", aliases: ["C 230", "C-230"],
        frontWheel: { diameter: 16, width: 7, offset: 37 },
        rearWheel: { diameter: 16, width: 7, offset: 37 },
        frontTire: "205/55R16", rearTire: "205/55R16",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "C240", aliases: ["C 240", "C-240"],
        frontWheel: { diameter: 16, width: 7, offset: 37 },
        rearWheel: { diameter: 16, width: 7, offset: 37 },
        frontTire: "205/55R16", rearTire: "205/55R16",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "C280", aliases: ["C 280", "C-280"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C300", aliases: ["C 300", "C-300"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C320", aliases: ["C 320", "C-320"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C32 AMG", aliases: ["AMG C32", "C 32 AMG"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C55 AMG", aliases: ["AMG C55", "C 55 AMG"],
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // C-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "C-Class AMG", modelAliases: ["C-Class AMG"],
    years: yearRange(2015, 2026),
    trims: [
      {
        name: "C43 AMG", aliases: ["AMG C43", "C43", "C 43 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG", aliases: ["AMG C63", "C63", "C 63 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 47 },
        frontTire: "245/40R18", rearTire: "265/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "C63 AMG S", aliases: ["AMG C63 S", "C63S", "C 63 AMG S"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // S-CLASS (All generations)
  // ==========================================
  
  // W223 S-Class (2021-2026)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2021, 2026),
    trims: [
      {
        name: "S500", aliases: ["S 500", "S-500"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "255/45R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "S500 4MATIC", aliases: ["S 500 4MATIC"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "255/45R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "S550", aliases: ["S 550", "S-550"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "255/45R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "S580", aliases: ["S 580", "S-580"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "265/40R20", rearTire: "295/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S580 4MATIC", aliases: ["S 580 4MATIC"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "265/40R20", rearTire: "295/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S63 AMG", aliases: ["AMG S63", "AMG S 63", "S 63 AMG"],
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/35R21", rearTire: "295/30R21",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "Maybach S580", aliases: ["Maybach", "Mercedes-Maybach S580"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "265/40R20", rearTire: "295/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "Maybach S680", aliases: ["Mercedes-Maybach S680"],
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/35R21", rearTire: "295/30R21",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W222 S-Class (2014-2020)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2014, 2020),
    trims: [
      {
        name: "S450", aliases: ["S 450", "S-450"],
        frontWheel: { diameter: 18, width: 8, offset: 41 },
        rearWheel: { diameter: 18, width: 9, offset: 46 },
        frontTire: "245/50R18", rearTire: "275/45R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S500", aliases: ["S 500", "S-500"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S550", aliases: ["S 550", "S-550"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S560", aliases: ["S 560", "S-560"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S600", aliases: ["S 600", "S-600"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 43 },
        frontTire: "255/40R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S63 AMG", aliases: ["AMG S63", "S 63 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S65 AMG", aliases: ["AMG S65", "S 65 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "Maybach", aliases: ["Maybach S600", "S600 Maybach"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W221 S-Class (2007-2013)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2007, 2013),
    trims: [
      {
        name: "S400", aliases: ["S 400", "S-400"],
        frontWheel: { diameter: 18, width: 8, offset: 41 },
        rearWheel: { diameter: 18, width: 9, offset: 46 },
        frontTire: "245/50R18", rearTire: "275/45R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S500", aliases: ["S 500", "S-500"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 43 },
        frontTire: "255/45R18", rearTire: "275/45R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S550", aliases: ["S 550", "S-550"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 43 },
        frontTire: "255/45R18", rearTire: "275/45R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S600", aliases: ["S 600", "S-600"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 43 },
        frontTire: "255/40R19", rearTire: "275/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S63 AMG", aliases: ["AMG S63", "S 63 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 43 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S65 AMG", aliases: ["AMG S65", "S 65 AMG"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 43 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // S-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "S-Class AMG", modelAliases: ["S-Class AMG"],
    years: yearRange(2007, 2026),
    trims: [
      {
        name: "S63 AMG", aliases: ["AMG S63", "S63", "S 63 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S65 AMG", aliases: ["AMG S65", "S65", "S 65 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // S-Class Coupe
  {
    make: "Mercedes-Benz", model: "S-Class Coupe", modelAliases: ["S-Class Coupe", "S Coupe"],
    years: yearRange(2015, 2021),
    trims: [
      {
        name: "S550 Coupe", aliases: ["S550", "S 550 Coupe"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S560 Coupe", aliases: ["S560", "S 560 Coupe"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S63 AMG Coupe", aliases: ["AMG S63 Coupe", "S 63 AMG Coupe"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "S65 AMG Coupe", aliases: ["AMG S65 Coupe", "S 65 AMG Coupe"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // CLA (All generations)
  // ==========================================
  
  // C118 CLA (2020-2026)
  {
    make: "Mercedes-Benz", model: "CLA", years: yearRange(2020, 2026),
    trims: [
      {
        name: "CLA 250", aliases: ["CLA250", "CLA-250"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "225/45R18", rearTire: "225/45R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "CLA 250 4MATIC", aliases: ["CLA250 4MATIC"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "225/45R18", rearTire: "225/45R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "CLA 35 AMG", aliases: ["AMG CLA35", "CLA35 AMG", "AMG CLA 35"],
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/35R19", rearTire: "235/35R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "CLA 45 AMG", aliases: ["AMG CLA45", "CLA45 AMG", "AMG CLA 45"],
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/35R19", rearTire: "235/35R19",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // C117 CLA (2014-2019)
  {
    make: "Mercedes-Benz", model: "CLA", years: yearRange(2014, 2019),
    trims: [
      {
        name: "CLA 250", aliases: ["CLA250", "CLA-250"],
        frontWheel: { diameter: 17, width: 7.5, offset: 52 },
        rearWheel: { diameter: 17, width: 7.5, offset: 52 },
        frontTire: "225/45R17", rearTire: "225/45R17",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "CLA 45 AMG", aliases: ["AMG CLA45", "CLA45 AMG", "AMG CLA 45"],
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/40R18", rearTire: "235/40R18",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLA (All generations)
  // ==========================================
  
  // H247 GLA (2021-2026)
  {
    make: "Mercedes-Benz", model: "GLA", years: yearRange(2021, 2026),
    trims: [
      {
        name: "GLA 250", aliases: ["GLA250", "GLA-250"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18", rearTire: "235/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLA 250 4MATIC", aliases: ["GLA250 4MATIC"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18", rearTire: "235/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLA 35 AMG", aliases: ["AMG GLA35", "GLA35 AMG", "AMG GLA 35"],
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/45R19", rearTire: "235/45R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLA 45 AMG", aliases: ["AMG GLA45", "GLA45 AMG", "AMG GLA 45"],
        frontWheel: { diameter: 20, width: 8, offset: 44 },
        rearWheel: { diameter: 20, width: 8, offset: 44 },
        frontTire: "235/40R20", rearTire: "235/40R20",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // X156 GLA (2015-2020)
  {
    make: "Mercedes-Benz", model: "GLA", years: yearRange(2015, 2020),
    trims: [
      {
        name: "GLA 250", aliases: ["GLA250", "GLA-250"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/50R18", rearTire: "235/50R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLA 45 AMG", aliases: ["AMG GLA45", "GLA45 AMG", "AMG GLA 45"],
        frontWheel: { diameter: 19, width: 8, offset: 48 },
        rearWheel: { diameter: 19, width: 8, offset: 48 },
        frontTire: "235/40R19", rearTire: "235/40R19",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLE (All generations)
  // ==========================================
  
  // V167 GLE (2020-2026)
  {
    make: "Mercedes-Benz", model: "GLE", years: yearRange(2020, 2026),
    trims: [
      {
        name: "GLE 350", aliases: ["GLE350", "GLE-350"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLE 350 4MATIC", aliases: ["GLE350 4MATIC"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLE 450", aliases: ["GLE450", "GLE-450"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 48 },
        frontTire: "275/50R20", rearTire: "315/45R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "GLE 53 AMG", aliases: ["AMG GLE53", "GLE53 AMG", "AMG GLE 53"],
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 48 },
        frontTire: "275/45R21", rearTire: "315/40R21",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "GLE 63 AMG S", aliases: ["AMG GLE63 S", "GLE63 AMG S", "AMG GLE 63 S"],
        frontWheel: { diameter: 22, width: 10, offset: 30 },
        rearWheel: { diameter: 22, width: 11.5, offset: 47 },
        frontTire: "285/40R22", rearTire: "325/35R22",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W166 GLE (2016-2019)
  {
    make: "Mercedes-Benz", model: "GLE", years: yearRange(2016, 2019),
    trims: [
      {
        name: "GLE 350", aliases: ["GLE350", "GLE-350"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 8, offset: 38 },
        frontTire: "265/60R18", rearTire: "265/60R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLE 400", aliases: ["GLE400", "GLE-400"],
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLE 43 AMG", aliases: ["AMG GLE43", "GLE43 AMG", "AMG GLE 43"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "GLE 63 AMG", aliases: ["AMG GLE63", "GLE63 AMG", "AMG GLE 63"],
        frontWheel: { diameter: 21, width: 10, offset: 28 },
        rearWheel: { diameter: 21, width: 10, offset: 46 },
        frontTire: "285/45R21", rearTire: "285/45R21",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLC (All generations)
  // ==========================================
  
  // X254 GLC (2023-2026)
  {
    make: "Mercedes-Benz", model: "GLC", years: yearRange(2023, 2026),
    trims: [
      {
        name: "GLC 300", aliases: ["GLC300", "GLC-300"],
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18", rearTire: "235/60R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLC 300 4MATIC", aliases: ["GLC300 4MATIC"],
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18", rearTire: "235/60R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLC 43 AMG", aliases: ["AMG GLC43", "GLC43 AMG", "AMG GLC 43"],
        frontWheel: { diameter: 19, width: 8, offset: 43 },
        rearWheel: { diameter: 19, width: 9, offset: 54 },
        frontTire: "255/50R19", rearTire: "255/50R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "GLC 63 AMG", aliases: ["AMG GLC63", "GLC63 AMG", "AMG GLC 63"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "265/45R20", rearTire: "295/40R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // X253 GLC (2016-2022)
  {
    make: "Mercedes-Benz", model: "GLC", years: yearRange(2016, 2022),
    trims: [
      {
        name: "GLC 300", aliases: ["GLC300", "GLC-300"],
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18", rearTire: "235/60R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "GLC 43 AMG", aliases: ["AMG GLC43", "GLC43 AMG", "AMG GLC 43"],
        frontWheel: { diameter: 19, width: 8, offset: 43 },
        rearWheel: { diameter: 19, width: 9, offset: 54 },
        frontTire: "235/55R19", rearTire: "255/50R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "GLC 63 AMG", aliases: ["AMG GLC63", "GLC63 AMG", "AMG GLC 63"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "265/45R20", rearTire: "295/40R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // G-CLASS (All years)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "G-Class", years: yearRange(2019, 2026),
    trims: [
      {
        name: "G550", aliases: ["G 550", "G-550"],
        frontWheel: { diameter: 19, width: 9.5, offset: 50 },
        rearWheel: { diameter: 19, width: 9.5, offset: 50 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G63 AMG", aliases: ["AMG G63", "AMG G 63", "G 63 AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 50 },
        rearWheel: { diameter: 20, width: 9.5, offset: 50 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x130", isStaggered: false,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "G-Class", years: yearRange(2013, 2018),
    trims: [
      {
        name: "G550", aliases: ["G 550", "G-550"],
        frontWheel: { diameter: 18, width: 9.5, offset: 50 },
        rearWheel: { diameter: 18, width: 9.5, offset: 50 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G63 AMG", aliases: ["AMG G63", "AMG G 63", "G 63 AMG"],
        frontWheel: { diameter: 20, width: 10, offset: 48 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G65 AMG", aliases: ["AMG G65", "G 65 AMG"],
        frontWheel: { diameter: 20, width: 10, offset: 48 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x130", isStaggered: false,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "G-Class", years: yearRange(2002, 2012),
    trims: [
      {
        name: "G500", aliases: ["G 500", "G-500"],
        frontWheel: { diameter: 18, width: 9.5, offset: 50 },
        rearWheel: { diameter: 18, width: 9.5, offset: 50 },
        frontTire: "265/60R18", rearTire: "265/60R18",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G550", aliases: ["G 550", "G-550"],
        frontWheel: { diameter: 18, width: 9.5, offset: 50 },
        rearWheel: { diameter: 18, width: 9.5, offset: 50 },
        frontTire: "265/60R18", rearTire: "265/60R18",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G55 AMG", aliases: ["AMG G55", "G 55 AMG"],
        frontWheel: { diameter: 19, width: 9.5, offset: 50 },
        rearWheel: { diameter: 19, width: 9.5, offset: 50 },
        frontTire: "275/55R19", rearTire: "275/55R19",
        boltPattern: "5x130", isStaggered: false,
      },
    ]
  },

  // G-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "G-Class AMG", modelAliases: ["G-Class AMG"],
    years: yearRange(2013, 2026),
    trims: [
      {
        name: "G63 AMG", aliases: ["AMG G63", "G63", "G 63 AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 50 },
        rearWheel: { diameter: 20, width: 9.5, offset: 50 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x130", isStaggered: false,
      },
      {
        name: "G65 AMG", aliases: ["AMG G65", "G65", "G 65 AMG"],
        frontWheel: { diameter: 20, width: 10, offset: 48 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20", rearTire: "275/50R20",
        boltPattern: "5x130", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // SL-CLASS (All generations)
  // ==========================================
  
  // R232 AMG SL (2022-2026) - All models are AMG
  {
    make: "Mercedes-Benz", model: "SL-Class", years: yearRange(2022, 2026),
    trims: [
      {
        name: "AMG SL43", aliases: ["SL43", "SL 43", "AMG SL 43"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "AMG SL55", aliases: ["SL55", "SL 55", "AMG SL 55"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 11, offset: 45 },
        frontTire: "265/40R20", rearTire: "295/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "AMG SL63", aliases: ["SL63", "SL 63", "AMG SL 63"],
        frontWheel: { diameter: 21, width: 10, offset: 30 },
        rearWheel: { diameter: 21, width: 11.5, offset: 47 },
        frontTire: "275/35R21", rearTire: "305/30R21",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // R231 SL (2013-2020)
  {
    make: "Mercedes-Benz", model: "SL-Class", years: yearRange(2013, 2020),
    trims: [
      {
        name: "SL400", aliases: ["SL 400", "SL-400"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SL450", aliases: ["SL 450", "SL-450"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SL550", aliases: ["SL 550", "SL-550"],
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SL63 AMG", aliases: ["AMG SL63", "SL 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SL65 AMG", aliases: ["AMG SL65", "SL 65 AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10.5, offset: 48 },
        frontTire: "255/35R20", rearTire: "285/30R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // SL-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "SL-Class AMG", modelAliases: ["SL-Class AMG", "SL AMG"],
    years: yearRange(2013, 2026),
    trims: [
      {
        name: "SL63 AMG", aliases: ["AMG SL63", "SL63", "SL 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SL65 AMG", aliases: ["AMG SL65", "SL65", "SL 65 AMG"],
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10.5, offset: 48 },
        frontTire: "255/35R20", rearTire: "285/30R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // SLK-CLASS / SLC-CLASS (R172: 2012-2020)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "SLK-Class", modelAliases: ["SLK-Class", "SLK Class", "SLK"],
    years: yearRange(2012, 2020),
    trims: [
      {
        name: "SLK250", aliases: ["SLK 250", "SLC180", "SLC200", "SLC 180", "SLC 200"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 45 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLK300", aliases: ["SLK 300", "SLC300", "SLC 300"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 45 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLK350", aliases: ["SLK 350", "SLC350", "SLC 350"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 42 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLK55 AMG", aliases: ["AMG SLK55", "SLK 55 AMG", "SLC43 AMG", "AMG SLC43"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 42 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // SLK-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "SLK-Class AMG", modelAliases: ["SLK-Class AMG", "SLK AMG"],
    years: yearRange(2012, 2020),
    trims: [
      {
        name: "SLK55 AMG", aliases: ["AMG SLK55", "SLK55", "SLK 55 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 42 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // SLC-Class
  {
    make: "Mercedes-Benz", model: "SLC-Class", modelAliases: ["SLC-Class", "SLC Class", "SLC"],
    years: yearRange(2017, 2020),
    trims: [
      {
        name: "SLC180", aliases: ["SLC 180"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 45 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLC200", aliases: ["SLC 200"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 45 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLC300", aliases: ["SLC 300"],
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 45 },
        frontTire: "225/45R17", rearTire: "245/40R17",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "SLC43 AMG", aliases: ["AMG SLC43", "SLC 43 AMG"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 42 },
        frontTire: "235/40R18", rearTire: "255/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // CLS-CLASS (All generations)
  // ==========================================
  
  // C257 CLS (2018-2024)
  {
    make: "Mercedes-Benz", model: "CLS", modelAliases: ["CLS-Class", "CLS Class"],
    years: yearRange(2018, 2024),
    trims: [
      {
        name: "CLS450", aliases: ["CLS 450", "CLS-450"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS450 4MATIC", aliases: ["CLS 450 4MATIC"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19", rearTire: "275/35R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS53 AMG", aliases: ["AMG CLS53", "CLS 53 AMG", "AMG CLS 53"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // W218 CLS (2012-2017)
  {
    make: "Mercedes-Benz", model: "CLS", modelAliases: ["CLS-Class", "CLS Class"],
    years: yearRange(2012, 2017),
    trims: [
      {
        name: "CLS400", aliases: ["CLS 400", "CLS-400"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "245/45R18", rearTire: "275/40R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS550", aliases: ["CLS 550", "CLS-550"],
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18", rearTire: "285/35R18",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS63 AMG", aliases: ["AMG CLS63", "CLS 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // CLS-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "CLS-Class AMG", modelAliases: ["CLS-Class AMG", "CLS AMG"],
    years: yearRange(2012, 2024),
    trims: [
      {
        name: "CLS53 AMG", aliases: ["AMG CLS53", "CLS53", "CLS 53 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS63 AMG", aliases: ["AMG CLS63", "CLS63", "CLS 63 AMG"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "CLS63 AMG S", aliases: ["AMG CLS63 S", "CLS63S", "CLS 63 AMG S"],
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19", rearTire: "285/30R19",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  // ==========================================
  // M-CLASS (W166: 2012-2015, W164: 2006-2011)
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "M-Class", modelAliases: ["M-Class", "ML-Class", "ML"],
    years: yearRange(2012, 2015),
    trims: [
      {
        name: "ML350", aliases: ["ML 350", "ML-350"],
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 8, offset: 38 },
        frontTire: "265/60R18", rearTire: "265/60R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "ML400", aliases: ["ML 400", "ML-400"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 8.5, offset: 38 },
        frontTire: "265/55R19", rearTire: "265/55R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "ML550", aliases: ["ML 550", "ML-550"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "265/45R20", rearTire: "295/40R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "ML63 AMG", aliases: ["AMG ML63", "ML 63 AMG"],
        frontWheel: { diameter: 21, width: 10, offset: 28 },
        rearWheel: { diameter: 21, width: 10, offset: 46 },
        frontTire: "295/35R21", rearTire: "295/35R21",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "M-Class", modelAliases: ["M-Class", "ML-Class", "ML"],
    years: yearRange(2006, 2011),
    trims: [
      {
        name: "ML350", aliases: ["ML 350", "ML-350"],
        frontWheel: { diameter: 18, width: 8, offset: 53 },
        rearWheel: { diameter: 18, width: 8, offset: 53 },
        frontTire: "255/55R18", rearTire: "255/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "ML500", aliases: ["ML 500", "ML-500"],
        frontWheel: { diameter: 19, width: 8.5, offset: 54 },
        rearWheel: { diameter: 19, width: 8.5, offset: 54 },
        frontTire: "275/50R19", rearTire: "275/50R19",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "ML550", aliases: ["ML 550", "ML-550"],
        frontWheel: { diameter: 20, width: 9, offset: 45 },
        rearWheel: { diameter: 20, width: 9, offset: 45 },
        frontTire: "265/45R20", rearTire: "265/45R20",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "ML63 AMG", aliases: ["AMG ML63", "ML 63 AMG"],
        frontWheel: { diameter: 20, width: 9, offset: 45 },
        rearWheel: { diameter: 20, width: 9, offset: 45 },
        frontTire: "295/40R20", rearTire: "295/40R20",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // M-Class AMG (standalone)
  {
    make: "Mercedes-Benz", model: "M-Class AMG", modelAliases: ["M-Class AMG", "ML AMG"],
    years: yearRange(2006, 2015),
    trims: [
      {
        name: "ML63 AMG", aliases: ["AMG ML63", "ML63", "ML 63 AMG"],
        frontWheel: { diameter: 21, width: 10, offset: 28 },
        rearWheel: { diameter: 21, width: 10, offset: 46 },
        frontTire: "295/35R21", rearTire: "295/35R21",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // A-CLASS AMG
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "A-Class AMG", modelAliases: ["A-Class AMG", "A AMG"],
    years: yearRange(2019, 2026),
    trims: [
      {
        name: "A35 AMG", aliases: ["AMG A35", "A 35 AMG", "AMG A 35"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/45R18", rearTire: "235/45R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "A45 AMG", aliases: ["AMG A45", "A 45 AMG", "AMG A 45"],
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/35R19", rearTire: "235/35R19",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },

  // ==========================================
  // EQS/EQE Electric
  // ==========================================
  
  {
    make: "Mercedes-Benz", model: "EQS", years: yearRange(2022, 2026),
    trims: [
      {
        name: "EQS450+", aliases: ["EQS 450+", "EQS450", "EQS 450"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 44 },
        frontTire: "255/45R20", rearTire: "285/40R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "EQS580", aliases: ["EQS 580", "EQS580 4MATIC"],
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/40R21", rearTire: "295/35R21",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "EQS53 AMG", aliases: ["AMG EQS53", "EQS 53 AMG"],
        frontWheel: { diameter: 22, width: 10, offset: 30 },
        rearWheel: { diameter: 22, width: 11, offset: 47 },
        frontTire: "265/35R22", rearTire: "295/30R22",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "EQE", years: yearRange(2023, 2026),
    trims: [
      {
        name: "EQE350+", aliases: ["EQE 350+", "EQE350", "EQE 350"],
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "255/45R19", rearTire: "285/40R19",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "EQE500", aliases: ["EQE 500", "EQE500 4MATIC"],
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 44 },
        frontTire: "255/40R20", rearTire: "285/35R20",
        boltPattern: "5x112", isStaggered: true,
      },
      {
        name: "EQE53 AMG", aliases: ["AMG EQE53", "EQE 53 AMG"],
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/40R21", rearTire: "295/35R21",
        boltPattern: "5x112", isStaggered: true,
      },
    ]
  },

  {
    make: "Mercedes-Benz", model: "EQB", years: yearRange(2022, 2026),
    trims: [
      {
        name: "EQB250+", aliases: ["EQB 250+", "EQB250", "EQB 250"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18", rearTire: "235/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "EQB300", aliases: ["EQB 300"],
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18", rearTire: "235/55R18",
        boltPattern: "5x112", isStaggered: false,
      },
      {
        name: "EQB350", aliases: ["EQB 350"],
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/50R19", rearTire: "235/50R19",
        boltPattern: "5x112", isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating Mercedes-Benz remaining fitments...\n");
  console.log("Source: Google AI Overview (2026-04-26)\n");

  let updatedCount = 0;
  let skippedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Build wheel sizes JSON
        const oemWheelSizes = [
          {
            position: "front",
            diameter: trim.frontWheel.diameter,
            width: trim.frontWheel.width,
            offset: trim.frontWheel.offset,
            boltPattern: trim.boltPattern,
          },
          {
            position: "rear",
            diameter: trim.rearWheel.diameter,
            width: trim.rearWheel.width,
            offset: trim.rearWheel.offset,
            boltPattern: trim.boltPattern,
          },
        ];

        // Build tire sizes JSON
        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: trim.rearTire },
        ];

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        // Build model variations
        const modelVariations = [vehicle.model];
        if (vehicle.modelAliases) {
          modelVariations.push(...vehicle.modelAliases);
        }

        // Build trim variations
        const trimVariations = [trim.name];
        if (trim.aliases) {
          trimVariations.push(...trim.aliases);
        }

        // Try to update matching records with missing data
        for (const modelName of modelVariations) {
          for (const trimName of trimVariations) {
            // Update records where model matches and oem_tire_sizes is missing
            const result = await pool.query(`
              UPDATE vehicle_fitments SET
                oem_wheel_sizes = $1::jsonb,
                oem_tire_sizes = $2::jsonb,
                quality_tier = 'complete',
                source = 'google-ai-overview',
                updated_at = NOW()
              WHERE year = $3
                AND LOWER(make) LIKE 'mercedes%'
                AND (
                  LOWER(model) = LOWER($4)
                  OR LOWER(model) = LOWER($5)
                  OR LOWER(model) LIKE LOWER($6)
                )
                AND (
                  LOWER(COALESCE(display_trim, '')) = LOWER($7)
                  OR LOWER(COALESCE(display_trim, '')) LIKE LOWER($8)
                  OR LOWER(COALESCE(modification_id, '')) LIKE LOWER($9)
                )
                AND (
                  oem_tire_sizes IS NULL 
                  OR oem_tire_sizes = '[]'::jsonb
                  OR oem_tire_sizes = 'null'::jsonb
                )
            `, [
              wheelSizesJson,
              tireSizesJson,
              year,
              modelName,
              modelName.replace(/\s+/g, '-'),
              modelName.replace(/[-\s]+/g, '%') + '%',
              trimName,
              trimName + '%',
              '%' + trimName.toLowerCase().replace(/\s+/g, '-') + '%',
            ]);

            if (result.rowCount && result.rowCount > 0) {
              console.log(`  Updated ${result.rowCount}: ${year} ${vehicle.model} ${trim.name}`);
              updatedCount += result.rowCount;
            }
          }
        }
      }
    }
  }

  // Additional pass: Update any records with grouped trims (comma-separated)
  console.log("\n--- Processing grouped/manual records ---");
  
  const groupedRecords = await pool.query(`
    SELECT id, year, model, display_trim
    FROM vehicle_fitments
    WHERE make ILIKE 'Mercedes%'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
      AND (
        display_trim LIKE '%,%'
        OR modification_id LIKE 'manual_%'
      )
  `);

  for (const record of groupedRecords.rows) {
    // Find the first matching trim from our data
    for (const vehicle of fitmentData) {
      if (record.year >= Math.min(...vehicle.years) && record.year <= Math.max(...vehicle.years)) {
        // Check if model matches
        const modelMatches = 
          record.model.toLowerCase().includes(vehicle.model.toLowerCase().replace(/-/g, '')) ||
          vehicle.model.toLowerCase().includes(record.model.toLowerCase().replace(/-/g, ''));
        
        if (!modelMatches) continue;

        // Use first trim's specs for grouped records
        const trim = vehicle.trims[0];
        
        const oemWheelSizes = [
          {
            position: "front",
            diameter: trim.frontWheel.diameter,
            width: trim.frontWheel.width,
            offset: trim.frontWheel.offset,
            boltPattern: trim.boltPattern,
          },
          {
            position: "rear",
            diameter: trim.rearWheel.diameter,
            width: trim.rearWheel.width,
            offset: trim.rearWheel.offset,
            boltPattern: trim.boltPattern,
          },
        ];

        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: trim.rearTire },
        ];

        await pool.query(`
          UPDATE vehicle_fitments SET
            oem_wheel_sizes = $1::jsonb,
            oem_tire_sizes = $2::jsonb,
            quality_tier = 'complete',
            source = 'google-ai-overview',
            updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(oemWheelSizes),
          JSON.stringify(oemTireSizes),
          record.id,
        ]);

        console.log(`  Updated grouped: ${record.year} ${record.model} ${record.display_trim}`);
        updatedCount++;
        break;
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Updated: ${updatedCount} records`);
  
  // Check remaining missing
  const remaining = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE make ILIKE 'Mercedes%'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
  `);
  
  console.log(`Remaining missing: ${remaining.rows[0].count}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
