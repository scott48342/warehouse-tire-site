/**
 * Fix BMW + Buick Vehicle Fitments
 * Updates missing tire sizes and wheel specs for priority vehicles
 * 
 * BMW Vehicles (143 total):
 * - X6 (23 records) - all trims 2008-2026
 * - M4 (13 records) - Base, Competition 2014-2026 (STAGGERED!)
 * - Z4 (18 records) - all trims 2003-2026
 * - X1 (15 records) - all trims 2013-2026
 * 
 * Buick Vehicles (186 total):
 * - LaCrosse (40 records) - all trims 2005-2019
 * - Enclave (40 records) - all trims 2008-2026
 * - Envision (32 records) - all trims 2016-2026
 * - Regal (32 records) - all trims 2011-2020
 * 
 * Data Source: Google AI Overview research (2026-04-20)
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

// Fitment data from Google AI Overview research
const fitmentData = [
  // ========================================
  // BMW X6 (G06 generation 2020-2026)
  // ========================================
  {
    make: "BMW", model: "X6", years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "xDrive40i",
        frontWheel: { diameter: 20, width: 9, offset: 35 },
        rearWheel: { diameter: 20, width: 10.5, offset: 43 },
        frontTire: "275/45R20",
        rearTire: "305/40R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "M60i xDrive",
        frontWheel: { diameter: 21, width: 9.5, offset: 37 },
        rearWheel: { diameter: 21, width: 10.5, offset: 43 },
        frontTire: "275/40R21",
        rearTire: "315/35R21",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  // BMW X6 M Competition (F96)
  {
    make: "BMW", model: "X6 M", years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Competition",
        frontWheel: { diameter: 21, width: 10.5, offset: 31 },
        rearWheel: { diameter: 22, width: 11.5, offset: 43 },
        frontTire: "295/35R21",
        rearTire: "315/30R22",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  // BMW X6 older generation (E71 2008-2014)
  {
    make: "BMW", model: "X6", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014],
    trims: [
      {
        name: "xDrive35i",
        frontWheel: { diameter: 19, width: 9, offset: 48 },
        rearWheel: { diameter: 19, width: 10, offset: 53 },
        frontTire: "255/50R19",
        rearTire: "285/45R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "xDrive50i",
        frontWheel: { diameter: 20, width: 10, offset: 40 },
        rearWheel: { diameter: 20, width: 11, offset: 37 },
        frontTire: "275/40R20",
        rearTire: "315/35R20",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },
  // BMW X6 F16 generation (2015-2019)
  {
    make: "BMW", model: "X6", years: [2015, 2016, 2017, 2018, 2019],
    trims: [
      {
        name: "xDrive35i",
        frontWheel: { diameter: 19, width: 9, offset: 48 },
        rearWheel: { diameter: 19, width: 10, offset: 53 },
        frontTire: "255/50R19",
        rearTire: "285/45R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "xDrive50i",
        frontWheel: { diameter: 20, width: 10, offset: 40 },
        rearWheel: { diameter: 20, width: 11, offset: 40 },
        frontTire: "275/40R20",
        rearTire: "315/35R20",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // ========================================
  // BMW M4 (G82 generation 2021-2026) - STAGGERED!
  // ========================================
  {
    make: "BMW", model: "M4", years: [2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9.5, offset: 20 },
        rearWheel: { diameter: 20, width: 10.5, offset: 20 },
        frontTire: "275/35R19",
        rearTire: "285/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "Competition",
        frontWheel: { diameter: 19, width: 9.5, offset: 20 },
        rearWheel: { diameter: 20, width: 10.5, offset: 20 },
        frontTire: "275/35R19",
        rearTire: "285/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "Competition xDrive",
        frontWheel: { diameter: 19, width: 9.5, offset: 20 },
        rearWheel: { diameter: 20, width: 10.5, offset: 20 },
        frontTire: "275/35R19",
        rearTire: "285/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "CS",
        frontWheel: { diameter: 19, width: 9.5, offset: 20 },
        rearWheel: { diameter: 20, width: 10.5, offset: 20 },
        frontTire: "275/35R19",
        rearTire: "285/30R20",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  // BMW M4 (F82 generation 2014-2020)
  {
    make: "BMW", model: "M4", years: [2014, 2015, 2016, 2017, 2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9, offset: 29 },
        rearWheel: { diameter: 19, width: 10, offset: 40 },
        frontTire: "255/35R19",
        rearTire: "275/35R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "Competition",
        frontWheel: { diameter: 19, width: 9, offset: 29 },
        rearWheel: { diameter: 19, width: 10, offset: 40 },
        frontTire: "255/35R19",
        rearTire: "275/35R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "CS",
        frontWheel: { diameter: 19, width: 9, offset: 29 },
        rearWheel: { diameter: 19, width: 10, offset: 40 },
        frontTire: "255/35R19",
        rearTire: "275/35R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "GTS",
        frontWheel: { diameter: 19, width: 9.5, offset: 22 },
        rearWheel: { diameter: 20, width: 10.5, offset: 28 },
        frontTire: "265/35R19",
        rearTire: "285/30R20",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // ========================================
  // BMW Z4 (G29 generation 2019-2026)
  // ========================================
  {
    make: "BMW", model: "Z4", years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "sDrive30i",
        frontWheel: { diameter: 18, width: 8, offset: 29 },
        rearWheel: { diameter: 18, width: 9, offset: 32 },
        frontTire: "225/45R18",
        rearTire: "255/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
      {
        name: "M40i",
        frontWheel: { diameter: 18, width: 9, offset: 32 },
        rearWheel: { diameter: 18, width: 10, offset: 40 },
        frontTire: "255/40R18",
        rearTire: "275/40R18",
        boltPattern: "5x112",
        isStaggered: true,
      },
    ]
  },
  // BMW Z4 (E89 generation 2009-2016)
  {
    make: "BMW", model: "Z4", years: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "sDrive28i",
        frontWheel: { diameter: 17, width: 8, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 32 },
        frontTire: "225/45R17",
        rearTire: "255/40R17",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "sDrive35i",
        frontWheel: { diameter: 18, width: 8, offset: 47 },
        rearWheel: { diameter: 18, width: 8.5, offset: 32 },
        frontTire: "225/40R18",
        rearTire: "255/35R18",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "sDrive35is",
        frontWheel: { diameter: 19, width: 8, offset: 29 },
        rearWheel: { diameter: 19, width: 9, offset: 32 },
        frontTire: "225/35R19",
        rearTire: "255/30R19",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },
  // BMW Z4 (E85/E86 generation 2003-2008)
  {
    make: "BMW", model: "Z4", years: [2003, 2004, 2005, 2006, 2007, 2008],
    trims: [
      {
        name: "2.5i",
        frontWheel: { diameter: 17, width: 8, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 50 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "3.0i",
        frontWheel: { diameter: 17, width: 8, offset: 47 },
        rearWheel: { diameter: 17, width: 8.5, offset: 50 },
        frontTire: "225/45R17",
        rearTire: "245/40R17",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "3.0si",
        frontWheel: { diameter: 18, width: 8, offset: 47 },
        rearWheel: { diameter: 18, width: 8.5, offset: 50 },
        frontTire: "225/40R18",
        rearTire: "255/35R18",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "M Roadster",
        frontWheel: { diameter: 18, width: 8, offset: 47 },
        rearWheel: { diameter: 18, width: 8.5, offset: 50 },
        frontTire: "225/40R18",
        rearTire: "255/35R18",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // ========================================
  // BMW X1 (U11 generation 2023-2026)
  // ========================================
  {
    make: "BMW", model: "X1", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "xDrive28i",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18",
        rearTire: "225/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "sDrive28i",
        frontWheel: { diameter: 18, width: 8, offset: 43 },
        rearWheel: { diameter: 18, width: 8, offset: 43 },
        frontTire: "225/55R18",
        rearTire: "225/55R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "M35i xDrive",
        frontWheel: { diameter: 19, width: 8, offset: 43 },
        rearWheel: { diameter: 19, width: 8, offset: 43 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },
  // BMW X1 (F48 generation 2016-2022)
  {
    make: "BMW", model: "X1", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022],
    trims: [
      {
        name: "xDrive28i",
        frontWheel: { diameter: 18, width: 7.5, offset: 51 },
        rearWheel: { diameter: 18, width: 7.5, offset: 51 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
      {
        name: "sDrive28i",
        frontWheel: { diameter: 18, width: 7.5, offset: 51 },
        rearWheel: { diameter: 18, width: 7.5, offset: 51 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x112",
        isStaggered: false,
      },
    ]
  },
  // BMW X1 (E84 generation 2013-2015)
  {
    make: "BMW", model: "X1", years: [2013, 2014, 2015],
    trims: [
      {
        name: "xDrive28i",
        frontWheel: { diameter: 17, width: 7.5, offset: 34 },
        rearWheel: { diameter: 17, width: 7.5, offset: 34 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "xDrive35i",
        frontWheel: { diameter: 18, width: 8, offset: 30 },
        rearWheel: { diameter: 18, width: 8, offset: 30 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },

  // ========================================
  // BUICK LACROSSE (2005-2019)
  // ========================================
  // LaCrosse III (2017-2019)
  {
    make: "Buick", model: "LaCrosse", years: [2017, 2018, 2019],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 7.5, offset: 40 },
        frontTire: "235/55R17",
        rearTire: "235/55R17",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Preferred",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 19, width: 8, offset: 40 },
        rearWheel: { diameter: 19, width: 8, offset: 40 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Avenir",
        frontWheel: { diameter: 20, width: 8.5, offset: 49 },
        rearWheel: { diameter: 20, width: 8.5, offset: 49 },
        frontTire: "245/40R20",
        rearTire: "245/40R20",
        boltPattern: "5x115",
        isStaggered: false,
      },
    ]
  },
  // LaCrosse II (2010-2016)
  {
    make: "Buick", model: "LaCrosse", years: [2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "CX",
        frontWheel: { diameter: 17, width: 7, offset: 40 },
        rearWheel: { diameter: 17, width: 7, offset: 40 },
        frontTire: "235/55R17",
        rearTire: "235/55R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "CXL",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "CXS",
        frontWheel: { diameter: 19, width: 8, offset: 40 },
        rearWheel: { diameter: 19, width: 8, offset: 40 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Leather",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 19, width: 8, offset: 40 },
        rearWheel: { diameter: 19, width: 8, offset: 40 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // LaCrosse I (2005-2009)
  {
    make: "Buick", model: "LaCrosse", years: [2005, 2006, 2007, 2008, 2009],
    trims: [
      {
        name: "CX",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "225/60R16",
        rearTire: "225/60R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "CXL",
        frontWheel: { diameter: 17, width: 7, offset: 42 },
        rearWheel: { diameter: 17, width: 7, offset: 42 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "CXS",
        frontWheel: { diameter: 17, width: 7, offset: 42 },
        rearWheel: { diameter: 17, width: 7, offset: 42 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Super",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "255/45R18",
        rearTire: "255/45R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // ========================================
  // BUICK ENCLAVE (2008-2026)
  // ========================================
  // Enclave II (2018-2026)
  {
    make: "Buick", model: "Enclave", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Preferred",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "255/65R18",
        rearTire: "255/65R18",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 20, width: 8.5, offset: 50 },
        rearWheel: { diameter: 20, width: 8.5, offset: 50 },
        frontTire: "255/55R20",
        rearTire: "255/55R20",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 20, width: 8.5, offset: 50 },
        rearWheel: { diameter: 20, width: 8.5, offset: 50 },
        frontTire: "255/55R20",
        rearTire: "255/55R20",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "Avenir",
        frontWheel: { diameter: 21, width: 8.5, offset: 50 },
        rearWheel: { diameter: 21, width: 8.5, offset: 50 },
        frontTire: "265/50R21",
        rearTire: "265/50R21",
        boltPattern: "6x120",
        isStaggered: false,
      },
    ]
  },
  // Enclave I (2008-2017)
  {
    make: "Buick", model: "Enclave", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017],
    trims: [
      {
        name: "CX",
        frontWheel: { diameter: 18, width: 7.5, offset: 50 },
        rearWheel: { diameter: 18, width: 7.5, offset: 50 },
        frontTire: "255/65R18",
        rearTire: "255/65R18",
        boltPattern: "6x132",
        isStaggered: false,
      },
      {
        name: "CXL",
        frontWheel: { diameter: 19, width: 8, offset: 50 },
        rearWheel: { diameter: 19, width: 8, offset: 50 },
        frontTire: "255/60R19",
        rearTire: "255/60R19",
        boltPattern: "6x132",
        isStaggered: false,
      },
      {
        name: "Leather",
        frontWheel: { diameter: 19, width: 8, offset: 50 },
        rearWheel: { diameter: 19, width: 8, offset: 50 },
        frontTire: "255/60R19",
        rearTire: "255/60R19",
        boltPattern: "6x132",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/55R20",
        rearTire: "255/55R20",
        boltPattern: "6x132",
        isStaggered: false,
      },
    ]
  },

  // ========================================
  // BUICK ENVISION (2016-2026)
  // ========================================
  // Envision II (2021-2026)
  {
    make: "Buick", model: "Envision", years: [2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Preferred",
        frontWheel: { diameter: 18, width: 8, offset: 37 },
        rearWheel: { diameter: 18, width: 8, offset: 37 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 20, width: 8.5, offset: 37 },
        rearWheel: { diameter: 20, width: 8.5, offset: 37 },
        frontTire: "245/45R20",
        rearTire: "245/45R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Avenir",
        frontWheel: { diameter: 20, width: 8.5, offset: 37 },
        rearWheel: { diameter: 20, width: 8.5, offset: 37 },
        frontTire: "245/45R20",
        rearTire: "245/45R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // Envision I (2016-2020)
  {
    make: "Buick", model: "Envision", years: [2016, 2017, 2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 7.5, offset: 39 },
        rearWheel: { diameter: 18, width: 7.5, offset: 39 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Preferred",
        frontWheel: { diameter: 18, width: 7.5, offset: 39 },
        rearWheel: { diameter: 18, width: 7.5, offset: 39 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 19, width: 8, offset: 39 },
        rearWheel: { diameter: 19, width: 8, offset: 39 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 19, width: 8, offset: 39 },
        rearWheel: { diameter: 19, width: 8, offset: 39 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x115",
        isStaggered: false,
      },
    ]
  },

  // ========================================
  // BUICK REGAL (2011-2020)
  // ========================================
  // Regal Sportback (2018-2020)
  {
    make: "Buick", model: "Regal Sportback", years: [2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 7.5, offset: 40 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Preferred",
        frontWheel: { diameter: 17, width: 7.5, offset: 40 },
        rearWheel: { diameter: 17, width: 7.5, offset: 40 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Preferred II",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "245/45R18",
        rearTire: "245/45R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "245/45R18",
        rearTire: "245/45R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Avenir",
        frontWheel: { diameter: 19, width: 8.5, offset: 49 },
        rearWheel: { diameter: 19, width: 8.5, offset: 49 },
        frontTire: "245/40R19",
        rearTire: "245/40R19",
        boltPattern: "5x115",
        isStaggered: false,
      },
    ]
  },
  // Regal TourX (2018-2020)
  {
    make: "Buick", model: "Regal TourX", years: [2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Preferred",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
      {
        name: "Essence",
        frontWheel: { diameter: 18, width: 8, offset: 40 },
        rearWheel: { diameter: 18, width: 8, offset: 40 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
    ]
  },
  // Regal GS (2018-2020)
  {
    make: "Buick", model: "Regal GS", years: [2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8.5, offset: 49 },
        rearWheel: { diameter: 18, width: 8.5, offset: 49 },
        frontTire: "245/45R18",
        rearTire: "245/45R18",
        boltPattern: "5x115",
        isStaggered: false,
      },
    ]
  },
  // Regal II (2011-2017)
  {
    make: "Buick", model: "Regal", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 42 },
        rearWheel: { diameter: 18, width: 8, offset: 42 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 18, width: 8, offset: 42 },
        rearWheel: { diameter: 18, width: 8, offset: 42 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Turbo",
        frontWheel: { diameter: 19, width: 8.5, offset: 40 },
        rearWheel: { diameter: 19, width: 8.5, offset: 40 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "GS",
        frontWheel: { diameter: 20, width: 9, offset: 42 },
        rearWheel: { diameter: 20, width: 9, offset: 42 },
        frontTire: "245/40R20",
        rearTire: "245/40R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating BMW + Buick vehicle fitments...\n");
  console.log("Data source: Google AI Overview research (2026-04-20)\n");

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
        
        // Rear wheel
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

        // Check if record exists
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (
              LOWER(model) = ${vehicle.model.toLowerCase()} 
              OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')}
              OR LOWER(model) LIKE ${vehicle.model.toLowerCase().split(' ')[0] + '%'}
            )
            AND (
              LOWER(display_trim) = ${trim.name.toLowerCase()} 
              OR LOWER(modification_id) = ${modificationId}
              OR display_trim IS NULL
              OR display_trim = ''
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
  console.log(`\nSource: google-ai-overview`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
