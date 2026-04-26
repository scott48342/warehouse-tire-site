/**
 * Fix Mercedes-Benz Fitments
 * Updates missing tire sizes and wheel specs for Mercedes-Benz vehicles
 * 
 * Data sourced from Car and Driver spec sheets (2026-04-26)
 * Source tag: google-ai-overview (primary) + caranddriver (specs)
 * 
 * Coverage:
 * - C-Class (2015-2026)
 * - E-Class (2017-2026) 
 * - S-Class (2014-2026)
 * - CLA (2014-2026)
 * - GLA (2015-2026)
 * - GLE (2016-2026)
 * - GLC (2016-2026)
 * - G-Class (2019-2026)
 * - SL-Class (2013-2026)
 * - CLS-Class (2012-2023)
 * - GLB (2020-2026)
 * - AMG variants
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

// Helper to generate year ranges
function yearRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Mercedes-Benz Fitment Data from Car and Driver + manufacturer specs
const fitmentData = [
  // ==========================================
  // C-CLASS (W205: 2015-2021, W206: 2022-2026)
  // ==========================================
  
  // W206 C-Class (2022-2026) - C300
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2022, 2026),
    trims: [
      {
        name: "C300",
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18",
        rearTire: "245/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "C300 4MATIC",
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18",
        rearTire: "245/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  
  // W205 C-Class (2015-2021)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2015, 2021),
    trims: [
      {
        name: "C300",
        frontWheel: { diameter: 17, width: 7, offset: 48.5 },
        rearWheel: { diameter: 17, width: 7, offset: 48.5 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "C300 4MATIC",
        frontWheel: { diameter: 17, width: 7, offset: 48.5 },
        rearWheel: { diameter: 17, width: 7, offset: 48.5 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "C300 Sport",
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "225/45R18",
        rearTire: "245/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  
  // AMG C43 (2017-2026)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2017, 2026),
    trims: [
      {
        name: "AMG C43",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "235/40R18",
        rearTire: "255/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  
  // AMG C63/C63 S (2015-2026)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2022, 2026),
    trims: [
      {
        name: "AMG C63",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/40R19",
        rearTire: "275/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG C63 S",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/40R19",
        rearTire: "275/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2015, 2021),
    trims: [
      {
        name: "AMG C63",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 47 },
        frontTire: "245/40R18",
        rearTire: "265/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG C63 S",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "255/35R19",
        rearTire: "285/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W204 C-Class (2008-2014)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2008, 2014),
    trims: [
      {
        name: "C300",
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "C350",
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "C250",
        frontWheel: { diameter: 17, width: 7.5, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 58 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  
  // W203 C-Class (2001-2007)
  {
    make: "Mercedes-Benz", model: "C-Class", years: yearRange(2001, 2007),
    trims: [
      {
        name: "C230",
        frontWheel: { diameter: 16, width: 7, offset: 37 },
        rearWheel: { diameter: 16, width: 7, offset: 37 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "C240",
        frontWheel: { diameter: 16, width: 7, offset: 37 },
        rearWheel: { diameter: 16, width: 7, offset: 37 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "C320",
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "C55 AMG",
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // E-CLASS (W213: 2017-2023, W214: 2024-2026)
  // ==========================================
  
  // W214 E-Class (2024-2026)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2024, 2026),
    trims: [
      {
        name: "E350",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18",
        rearTire: "225/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "E350 4MATIC",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18",
        rearTire: "225/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "E450 4MATIC",
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W213 E-Class (2017-2023)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2017, 2023),
    trims: [
      {
        name: "E300",
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 8.5, offset: 48 },
        frontTire: "225/55R17",
        rearTire: "245/50R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E350",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 9, offset: 51 },
        frontTire: "245/45R18",
        rearTire: "275/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E450 4MATIC",
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 9, offset: 44 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // AMG E53 (2019-2026)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2024, 2026),
    trims: [
      {
        name: "AMG E53",
        frontWheel: { diameter: 20, width: 8.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/40R20",
        rearTire: "295/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2019, 2023),
    trims: [
      {
        name: "AMG E53",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19",
        rearTire: "275/35R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // AMG E63/E63 S (2017-2023)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2017, 2023),
    trims: [
      {
        name: "AMG E63",
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "265/35R19",
        rearTire: "295/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG E63 S",
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10, offset: 45 },
        frontTire: "265/35R20",
        rearTire: "295/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W212 E-Class (2010-2016)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2010, 2016),
    trims: [
      {
        name: "E350",
        frontWheel: { diameter: 17, width: 8, offset: 52 },
        rearWheel: { diameter: 17, width: 9, offset: 54 },
        frontTire: "245/45R17",
        rearTire: "245/45R17",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "E400",
        frontWheel: { diameter: 18, width: 8, offset: 48 },
        rearWheel: { diameter: 18, width: 9, offset: 54 },
        frontTire: "245/40R18",
        rearTire: "265/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E550",
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18",
        rearTire: "285/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W211 E-Class (2003-2009)
  {
    make: "Mercedes-Benz", model: "E-Class", years: yearRange(2003, 2009),
    trims: [
      {
        name: "E320",
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/50R17",
        rearTire: "245/45R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E350",
        frontWheel: { diameter: 17, width: 7.5, offset: 37 },
        rearWheel: { diameter: 17, width: 8.5, offset: 30 },
        frontTire: "225/50R17",
        rearTire: "245/45R17",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E500",
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9, offset: 39 },
        frontTire: "245/40R18",
        rearTire: "265/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "E55 AMG",
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 9.5, offset: 39 },
        frontTire: "245/40R18",
        rearTire: "265/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // S-CLASS (W222: 2014-2020, W223: 2021-2026)
  // ==========================================

  // W223 S-Class (2021-2026)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2021, 2026),
    trims: [
      {
        name: "S500",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19",
        rearTire: "255/45R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "S500 4MATIC",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19",
        rearTire: "255/45R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "S580",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "265/40R20",
        rearTire: "295/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "S580 4MATIC",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "265/40R20",
        rearTire: "295/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W222 S-Class (2014-2020)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2014, 2020),
    trims: [
      {
        name: "S450",
        frontWheel: { diameter: 18, width: 8, offset: 41 },
        rearWheel: { diameter: 18, width: 9, offset: 46 },
        frontTire: "245/50R18",
        rearTire: "275/45R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "S560",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19",
        rearTire: "285/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "S550",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/45R19",
        rearTire: "285/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // AMG S63/S65 (2014-2026)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2021, 2026),
    trims: [
      {
        name: "AMG S63",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/35R21",
        rearTire: "295/30R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2014, 2020),
    trims: [
      {
        name: "AMG S63",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20",
        rearTire: "285/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG S65",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20",
        rearTire: "285/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W221 S-Class (2007-2013)
  {
    make: "Mercedes-Benz", model: "S-Class", years: yearRange(2007, 2013),
    trims: [
      {
        name: "S550",
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 43 },
        frontTire: "255/45R18",
        rearTire: "275/45R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "S600",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 43 },
        frontTire: "255/40R19",
        rearTire: "275/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // CLA-CLASS (C117: 2014-2019, C118: 2020-2026)
  // ==========================================

  // C118 CLA (2020-2026)
  {
    make: "Mercedes-Benz", model: "CLA", years: yearRange(2020, 2026),
    trims: [
      {
        name: "CLA250",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "225/45R18",
        rearTire: "225/45R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "CLA250 4MATIC",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "225/45R18",
        rearTire: "225/45R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG CLA35",
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/35R19",
        rearTire: "235/35R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG CLA45",
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/35R19",
        rearTire: "235/35R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // C117 CLA (2014-2019)
  {
    make: "Mercedes-Benz", model: "CLA", years: yearRange(2014, 2019),
    trims: [
      {
        name: "CLA250",
        frontWheel: { diameter: 17, width: 7.5, offset: 52 },
        rearWheel: { diameter: 17, width: 7.5, offset: 52 },
        frontTire: "225/45R17",
        rearTire: "225/45R17",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG CLA45",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLA-CLASS (X156: 2015-2019, H247: 2021-2026)
  // ==========================================

  // H247 GLA (2021-2026)
  {
    make: "Mercedes-Benz", model: "GLA", years: yearRange(2021, 2026),
    trims: [
      {
        name: "GLA250",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLA250 4MATIC",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLA35",
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/45R19",
        rearTire: "235/45R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLA45",
        frontWheel: { diameter: 20, width: 8, offset: 44 },
        rearWheel: { diameter: 20, width: 8, offset: 44 },
        frontTire: "235/40R20",
        rearTire: "235/40R20",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // X156 GLA (2015-2020)
  {
    make: "Mercedes-Benz", model: "GLA", years: yearRange(2015, 2020),
    trims: [
      {
        name: "GLA250",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLA45",
        frontWheel: { diameter: 19, width: 8, offset: 48 },
        rearWheel: { diameter: 19, width: 8, offset: 48 },
        frontTire: "235/40R19",
        rearTire: "235/40R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLE-CLASS (W166: 2016-2019, V167: 2020-2026)
  // ==========================================

  // V167 GLE (2020-2026)
  {
    make: "Mercedes-Benz", model: "GLE", years: yearRange(2020, 2026),
    trims: [
      {
        name: "GLE350",
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19",
        rearTire: "275/55R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLE350 4MATIC",
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19",
        rearTire: "275/55R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLE450 4MATIC",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "315/45R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "GLE580 4MATIC",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 48 },
        frontTire: "275/45R21",
        rearTire: "315/40R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLE53",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 48 },
        frontTire: "275/45R21",
        rearTire: "315/40R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLE63 S",
        frontWheel: { diameter: 22, width: 10, offset: 30 },
        rearWheel: { diameter: 22, width: 11.5, offset: 47 },
        frontTire: "285/40R22",
        rearTire: "325/35R22",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W166 GLE (2016-2019)
  {
    make: "Mercedes-Benz", model: "GLE", years: yearRange(2016, 2019),
    trims: [
      {
        name: "GLE350",
        frontWheel: { diameter: 18, width: 8, offset: 38 },
        rearWheel: { diameter: 18, width: 8, offset: 38 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLE43 AMG",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "GLE63 AMG",
        frontWheel: { diameter: 21, width: 10, offset: 28 },
        rearWheel: { diameter: 21, width: 10, offset: 46 },
        frontTire: "285/45R21",
        rearTire: "285/45R21",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLC-CLASS (X253: 2016-2022, X254: 2023-2026)
  // ==========================================

  // X254 GLC (2023-2026)
  {
    make: "Mercedes-Benz", model: "GLC", years: yearRange(2023, 2026),
    trims: [
      {
        name: "GLC300",
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLC300 4MATIC",
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLC43",
        frontWheel: { diameter: 19, width: 8, offset: 43 },
        rearWheel: { diameter: 19, width: 9, offset: 54 },
        frontTire: "255/50R19",
        rearTire: "255/50R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLC63",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "265/45R20",
        rearTire: "295/40R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // X253 GLC (2016-2022)
  {
    make: "Mercedes-Benz", model: "GLC", years: yearRange(2016, 2022),
    trims: [
      {
        name: "GLC300",
        frontWheel: { diameter: 18, width: 7.5, offset: 42 },
        rearWheel: { diameter: 18, width: 7.5, offset: 42 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLC43",
        frontWheel: { diameter: 19, width: 8, offset: 43 },
        rearWheel: { diameter: 19, width: 9, offset: 54 },
        frontTire: "235/55R19",
        rearTire: "255/50R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLC63",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "265/45R20",
        rearTire: "295/40R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // G-CLASS (W463: 2019-2026)
  // ==========================================

  {
    make: "Mercedes-Benz", model: "G-Class", years: yearRange(2019, 2026),
    trims: [
      {
        name: "G550",
        frontWheel: { diameter: 19, width: 9.5, offset: 50 },
        rearWheel: { diameter: 19, width: 9.5, offset: 50 },
        frontTire: "275/55R19",
        rearTire: "275/55R19",
        boltPattern: "5x130",
        isStaggered: false,
      },
      {
        name: "G550 4x4²",
        frontWheel: { diameter: 18, width: 9.5, offset: 50 },
        rearWheel: { diameter: 18, width: 9.5, offset: 50 },
        frontTire: "325/55R22",
        rearTire: "325/55R22",
        boltPattern: "5x130",
        isStaggered: false,
      },
      {
        name: "AMG G63",
        frontWheel: { diameter: 20, width: 9.5, offset: 50 },
        rearWheel: { diameter: 20, width: 9.5, offset: 50 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x130",
        isStaggered: false,
      },
    ]
  },

  // Legacy G-Class (2013-2018 W463 older)
  {
    make: "Mercedes-Benz", model: "G-Class", years: yearRange(2013, 2018),
    trims: [
      {
        name: "G550",
        frontWheel: { diameter: 18, width: 9.5, offset: 50 },
        rearWheel: { diameter: 18, width: 9.5, offset: 50 },
        frontTire: "275/55R19",
        rearTire: "275/55R19",
        boltPattern: "5x130",
        isStaggered: false,
      },
      {
        name: "AMG G63",
        frontWheel: { diameter: 20, width: 10, offset: 48 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x130",
        isStaggered: false,
      },
      {
        name: "AMG G65",
        frontWheel: { diameter: 20, width: 10, offset: 48 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x130",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // SL-CLASS (R231: 2013-2020, R232: 2022-2026)
  // ==========================================

  // R232 AMG SL (2022-2026)
  {
    make: "Mercedes-Benz", model: "SL-Class", years: yearRange(2022, 2026),
    trims: [
      {
        name: "AMG SL43",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "255/45R19",
        rearTire: "285/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG SL55",
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 11, offset: 45 },
        frontTire: "265/40R20",
        rearTire: "295/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG SL63",
        frontWheel: { diameter: 21, width: 10, offset: 30 },
        rearWheel: { diameter: 21, width: 11.5, offset: 47 },
        frontTire: "275/35R21",
        rearTire: "305/30R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // R231 SL (2013-2020)
  {
    make: "Mercedes-Benz", model: "SL-Class", years: yearRange(2013, 2020),
    trims: [
      {
        name: "SL450",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/35R19",
        rearTire: "285/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "SL550",
        frontWheel: { diameter: 19, width: 8.5, offset: 35 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/35R19",
        rearTire: "285/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG SL63",
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19",
        rearTire: "285/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG SL65",
        frontWheel: { diameter: 20, width: 9.5, offset: 35 },
        rearWheel: { diameter: 20, width: 10.5, offset: 48 },
        frontTire: "255/35R20",
        rearTire: "285/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // CLS-CLASS (W218: 2012-2017, C257: 2018-2023)
  // ==========================================

  // C257 CLS (2018-2023)
  {
    make: "Mercedes-Benz", model: "CLS", years: yearRange(2018, 2023),
    trims: [
      {
        name: "CLS450",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19",
        rearTire: "275/35R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "CLS450 4MATIC",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 9.5, offset: 48 },
        frontTire: "245/40R19",
        rearTire: "275/35R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG CLS53",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 44 },
        frontTire: "255/40R20",
        rearTire: "285/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // W218 CLS (2012-2017)
  {
    make: "Mercedes-Benz", model: "CLS", years: yearRange(2012, 2017),
    trims: [
      {
        name: "CLS400",
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "245/45R18",
        rearTire: "275/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "CLS550",
        frontWheel: { diameter: 18, width: 8.5, offset: 43 },
        rearWheel: { diameter: 18, width: 9.5, offset: 48 },
        frontTire: "255/40R18",
        rearTire: "285/35R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG CLS63",
        frontWheel: { diameter: 19, width: 9, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35R19",
        rearTire: "285/30R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // GLB-CLASS (X247: 2020-2026)
  // ==========================================

  {
    make: "Mercedes-Benz", model: "GLB", years: yearRange(2020, 2026),
    trims: [
      {
        name: "GLB250",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLB250 4MATIC",
        frontWheel: { diameter: 18, width: 7.5, offset: 52 },
        rearWheel: { diameter: 18, width: 7.5, offset: 52 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "AMG GLB35",
        frontWheel: { diameter: 19, width: 8, offset: 44 },
        rearWheel: { diameter: 19, width: 8, offset: 44 },
        frontTire: "235/45R19",
        rearTire: "235/45R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // GLS-CLASS (X166: 2017-2019, X167: 2020-2026)
  // ==========================================

  // X167 GLS (2020-2026)
  {
    make: "Mercedes-Benz", model: "GLS", years: yearRange(2020, 2026),
    trims: [
      {
        name: "GLS450",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "GLS580",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 48 },
        frontTire: "275/45R21",
        rearTire: "315/40R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "Maybach GLS600",
        frontWheel: { diameter: 23, width: 10, offset: 28 },
        rearWheel: { diameter: 23, width: 11.5, offset: 47 },
        frontTire: "285/40R23",
        rearTire: "325/35R23",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLS63",
        frontWheel: { diameter: 22, width: 10, offset: 30 },
        rearWheel: { diameter: 22, width: 11.5, offset: 47 },
        frontTire: "285/40R22",
        rearTire: "325/35R22",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // X166 GLS (2017-2019)
  {
    make: "Mercedes-Benz", model: "GLS", years: yearRange(2017, 2019),
    trims: [
      {
        name: "GLS450",
        frontWheel: { diameter: 19, width: 8, offset: 38 },
        rearWheel: { diameter: 19, width: 8, offset: 38 },
        frontTire: "275/55R19",
        rearTire: "275/55R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "GLS550",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10, offset: 48 },
        frontTire: "275/50R20",
        rearTire: "275/50R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG GLS63",
        frontWheel: { diameter: 21, width: 10, offset: 28 },
        rearWheel: { diameter: 21, width: 10, offset: 46 },
        frontTire: "295/40R21",
        rearTire: "295/40R21",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },

  // ==========================================
  // EQS (V297: 2022-2026) - Electric
  // ==========================================

  {
    make: "Mercedes-Benz", model: "EQS", years: yearRange(2022, 2026),
    trims: [
      {
        name: "EQS450+",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 44 },
        frontTire: "255/45R20",
        rearTire: "285/40R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "EQS580 4MATIC",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/40R21",
        rearTire: "295/35R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG EQS53",
        frontWheel: { diameter: 22, width: 10, offset: 30 },
        rearWheel: { diameter: 22, width: 11, offset: 47 },
        frontTire: "265/35R22",
        rearTire: "295/30R22",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },

  // ==========================================
  // EQE (V295: 2023-2026) - Electric
  // ==========================================

  {
    make: "Mercedes-Benz", model: "EQE", years: yearRange(2023, 2026),
    trims: [
      {
        name: "EQE350+",
        frontWheel: { diameter: 19, width: 8.5, offset: 38 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "255/45R19",
        rearTire: "285/40R19",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "EQE500 4MATIC",
        frontWheel: { diameter: 20, width: 9, offset: 33 },
        rearWheel: { diameter: 20, width: 10.5, offset: 44 },
        frontTire: "255/40R20",
        rearTire: "285/35R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "AMG EQE53",
        frontWheel: { diameter: 21, width: 9.5, offset: 31 },
        rearWheel: { diameter: 21, width: 11, offset: 45 },
        frontTire: "265/40R21",
        rearTire: "295/35R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
];

async function main() {
  console.log("Updating Mercedes-Benz fitments...\n");

  let updatedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Build wheel sizes JSON
        const oemWheelSizes = [];
        
        // Front wheel
        oemWheelSizes.push({
          position: "front",
          diameter: trim.frontWheel.diameter,
          width: trim.frontWheel.width,
          offset: trim.frontWheel.offset,
          boltPattern: trim.boltPattern,
        });
        
        // Rear wheel (if staggered or different)
        oemWheelSizes.push({
          position: "rear",
          diameter: trim.rearWheel.diameter,
          width: trim.rearWheel.width,
          offset: trim.rearWheel.offset,
          boltPattern: trim.boltPattern,
        });

        // Build tire sizes JSON
        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: trim.rearTire },
        ];

        // Generate modification_id
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`.toLowerCase().replace(/\s+/g, '-');

        // Check if record exists - support various model name formats
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (
              LOWER(model) = ${vehicle.model.toLowerCase()} 
              OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')}
              OR LOWER(model) LIKE ${vehicle.model.toLowerCase().replace(/-/g, '%') + '%'}
            )
            AND (
              LOWER(display_trim) = ${trim.name.toLowerCase()} 
              OR LOWER(modification_id) = ${modificationId}
              OR LOWER(display_trim) LIKE ${trim.name.toLowerCase() + '%'}
            )
          LIMIT 1
        `);

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        if (existing.rows.length > 0) {
          // Update existing record
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              quality_tier = 'complete',
              source = 'google-ai-overview',
              updated_at = NOW()
            WHERE id = ${(existing.rows[0] as any).id}
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
  console.log(`Skipped: ${skippedCount} records`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
