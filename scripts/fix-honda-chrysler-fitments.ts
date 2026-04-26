/**
 * Fix Honda, Chrysler, Jeep, Acura, and Mazda Fitments
 * Updates missing tire sizes and wheel specs from Google AI Overview research
 * 
 * Vehicles covered:
 * - Honda Insight (2000-2006, 2010-2014, 2019-2022)
 * - Chrysler Town & Country (2001-2016)
 * - Jeep Liberty (2002-2012)
 * - Jeep Grand Cherokee (2000-2026)
 * - Mazda6 (2003-2021)
 * - Acura (various models)
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
  // === HONDA ACCORD ===
  // 9th Generation (2013-2017)
  {
    make: "Honda", model: "Accord", years: [2013, 2014, 2015, 2016, 2017],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 7, offset: 45 },
        rearWheel: { diameter: 16, width: 7, offset: 45 },
        frontTire: "205/65R16",
        rearTire: "205/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7.5, offset: 45 },
        rearWheel: { diameter: 17, width: 7.5, offset: 45 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 17, width: 7.5, offset: 45 },
        rearWheel: { diameter: 17, width: 7.5, offset: 45 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/45R18",
        rearTire: "235/45R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/45R18",
        rearTire: "235/45R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 10th Generation (2018-2022)
  {
    make: "Honda", model: "Accord", years: [2018, 2019, 2020, 2021, 2022],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 19, width: 8.5, offset: 45 },
        frontTire: "235/40R19",
        rearTire: "235/40R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 19, width: 8.5, offset: 45 },
        frontTire: "235/40R19",
        rearTire: "235/40R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 11th Generation (2023-2026)
  {
    make: "Honda", model: "Accord", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/45R18",
        rearTire: "235/45R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 19, width: 8.5, offset: 45 },
        frontTire: "235/40R19",
        rearTire: "235/40R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 19, width: 8.5, offset: 45 },
        frontTire: "235/40R19",
        rearTire: "235/40R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === HONDA CIVIC ===
  // 8th Generation (2006-2011)
  {
    make: "Honda", model: "Civic", years: [2006, 2007, 2008, 2009, 2010, 2011],
    trims: [
      {
        name: "DX",
        frontWheel: { diameter: 15, width: 6, offset: 45 },
        rearWheel: { diameter: 15, width: 6, offset: 45 },
        frontTire: "195/65R15",
        rearTire: "195/65R15",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Si",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/45R17",
        rearTire: "215/45R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 9th Generation (2012-2015)
  {
    make: "Honda", model: "Civic", years: [2012, 2013, 2014, 2015],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 15, width: 6, offset: 45 },
        rearWheel: { diameter: 15, width: 6, offset: 45 },
        frontTire: "195/65R15",
        rearTire: "195/65R15",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Si",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/45R17",
        rearTire: "215/45R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 10th Generation (2016-2021)
  {
    make: "Honda", model: "Civic", years: [2016, 2017, 2018, 2019, 2020, 2021],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 7, offset: 45 },
        rearWheel: { diameter: 16, width: 7, offset: 45 },
        frontTire: "215/55R16",
        rearTire: "215/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Si",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Type R",
        frontWheel: { diameter: 20, width: 8.5, offset: 60 },
        rearWheel: { diameter: 20, width: 8.5, offset: 60 },
        frontTire: "245/30R20",
        rearTire: "245/30R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // 11th Generation (2022-2026)
  {
    make: "Honda", model: "Civic", years: [2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 7, offset: 45 },
        rearWheel: { diameter: 16, width: 7, offset: 45 },
        frontTire: "215/55R16",
        rearTire: "215/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Si",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "235/40R18",
        rearTire: "235/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Type R",
        frontWheel: { diameter: 19, width: 9.5, offset: 45 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "265/30R19",
        rearTire: "265/30R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },

  // === HONDA CR-V ===
  // 4th Generation (2012-2016)
  {
    make: "Honda", model: "CR-V", years: [2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 6.5, offset: 45 },
        rearWheel: { diameter: 16, width: 6.5, offset: 45 },
        frontTire: "215/70R16",
        rearTire: "215/70R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 6.5, offset: 45 },
        rearWheel: { diameter: 17, width: 6.5, offset: 45 },
        frontTire: "225/65R17",
        rearTire: "225/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 17, width: 6.5, offset: 45 },
        rearWheel: { diameter: 17, width: 6.5, offset: 45 },
        frontTire: "225/65R17",
        rearTire: "225/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "225/60R18",
        rearTire: "225/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 5th Generation (2017-2022)
  {
    make: "Honda", model: "CR-V", years: [2017, 2018, 2019, 2020, 2021, 2022],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 6th Generation (2023-2026)
  {
    make: "Honda", model: "CR-V", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 19, width: 8, offset: 45 },
        rearWheel: { diameter: 19, width: 8, offset: 45 },
        frontTire: "235/55R19",
        rearTire: "235/55R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 19, width: 8, offset: 45 },
        rearWheel: { diameter: 19, width: 8, offset: 45 },
        frontTire: "235/55R19",
        rearTire: "235/55R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === HONDA PILOT ===
  // 2nd Generation (2009-2015)
  {
    make: "Honda", model: "Pilot", years: [2009, 2010, 2011, 2012, 2013, 2014, 2015],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 17, width: 7.5, offset: 45 },
        rearWheel: { diameter: 17, width: 7.5, offset: 45 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 17, width: 7.5, offset: 45 },
        rearWheel: { diameter: 17, width: 7.5, offset: 45 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // 3rd Generation (2016-2022)
  {
    make: "Honda", model: "Pilot", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Elite",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // 4th Generation (2023-2026)
  {
    make: "Honda", model: "Pilot", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Sport",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "EX-L",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Elite",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "TrailSport",
        frontWheel: { diameter: 18, width: 7.5, offset: 45 },
        rearWheel: { diameter: 18, width: 7.5, offset: 45 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },

  // === HONDA INSIGHT ===
  // 1st Generation (2000-2006) - ZE1
  {
    make: "Honda", model: "Insight", years: [2000, 2001, 2002, 2003, 2004, 2005, 2006],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 14, width: 5.5, offset: 45 },
        rearWheel: { diameter: 14, width: 5.5, offset: 45 },
        frontTire: "165/65R14",
        rearTire: "165/65R14",
        boltPattern: "4x100",
        isStaggered: false,
      },
    ]
  },
  // 2nd Generation (2010-2014) - ZE2
  {
    make: "Honda", model: "Insight", years: [2010, 2011, 2012, 2013, 2014],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 15, width: 6, offset: 50 },
        rearWheel: { diameter: 15, width: 6, offset: 50 },
        frontTire: "175/65R15",
        rearTire: "175/65R15",
        boltPattern: "4x100",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 15, width: 6, offset: 50 },
        rearWheel: { diameter: 15, width: 6, offset: 50 },
        frontTire: "185/60R15",
        rearTire: "185/60R15",
        boltPattern: "4x100",
        isStaggered: false,
      },
    ]
  },
  // 3rd Generation (2019-2022) - ZE4
  {
    make: "Honda", model: "Insight", years: [2019, 2020, 2021, 2022],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 7, offset: 45 },
        rearWheel: { diameter: 16, width: 7, offset: 45 },
        frontTire: "215/55R16",
        rearTire: "215/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "EX",
        frontWheel: { diameter: 16, width: 7, offset: 45 },
        rearWheel: { diameter: 16, width: 7, offset: 45 },
        frontTire: "215/55R16",
        rearTire: "215/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === CHRYSLER TOWN & COUNTRY ===
  // 3rd Generation (2001-2004)
  {
    make: "Chrysler", model: "Town & Country", years: [2001, 2002, 2003, 2004],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 15, width: 6.5, offset: 40 },
        rearWheel: { diameter: 15, width: 6.5, offset: 40 },
        frontTire: "215/70R15",
        rearTire: "215/70R15",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "LXi",
        frontWheel: { diameter: 16, width: 6.5, offset: 40 },
        rearWheel: { diameter: 16, width: 6.5, offset: 40 },
        frontTire: "215/65R16",
        rearTire: "215/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 16, width: 6.5, offset: 40 },
        rearWheel: { diameter: 16, width: 6.5, offset: 40 },
        frontTire: "225/60R16",
        rearTire: "225/60R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 4th Generation (2005-2007)
  {
    make: "Chrysler", model: "Town & Country", years: [2005, 2006, 2007],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 15, width: 6.5, offset: 40 },
        rearWheel: { diameter: 15, width: 6.5, offset: 40 },
        frontTire: "215/70R15",
        rearTire: "215/70R15",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 16, width: 6.5, offset: 40 },
        rearWheel: { diameter: 16, width: 6.5, offset: 40 },
        frontTire: "215/65R16",
        rearTire: "215/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 17, width: 6.5, offset: 40 },
        rearWheel: { diameter: 17, width: 6.5, offset: 40 },
        frontTire: "215/60R17",
        rearTire: "215/60R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 5th Generation (2008-2016)
  {
    make: "Chrysler", model: "Town & Country", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "LX",
        frontWheel: { diameter: 16, width: 6.5, offset: 40 },
        rearWheel: { diameter: 16, width: 6.5, offset: 40 },
        frontTire: "225/65R16",
        rearTire: "225/65R16",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 17, width: 6.5, offset: 40 },
        rearWheel: { diameter: 17, width: 6.5, offset: 40 },
        frontTire: "225/65R17",
        rearTire: "225/65R17",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 17, width: 6.5, offset: 40 },
        rearWheel: { diameter: 17, width: 6.5, offset: 40 },
        frontTire: "225/65R17",
        rearTire: "225/65R17",
        boltPattern: "5x127",
        isStaggered: false,
      },
    ]
  },

  // === JEEP LIBERTY ===
  // 1st Generation KJ (2002-2007)
  {
    make: "Jeep", model: "Liberty", years: [2002, 2003, 2004, 2005, 2006, 2007],
    trims: [
      {
        name: "Sport",
        frontWheel: { diameter: 16, width: 7, offset: 44 },
        rearWheel: { diameter: 16, width: 7, offset: 44 },
        frontTire: "225/75R16",
        rearTire: "225/75R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 16, width: 7, offset: 44 },
        rearWheel: { diameter: 16, width: 7, offset: 44 },
        frontTire: "235/70R16",
        rearTire: "235/70R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Renegade",
        frontWheel: { diameter: 16, width: 7, offset: 44 },
        rearWheel: { diameter: 16, width: 7, offset: 44 },
        frontTire: "235/70R16",
        rearTire: "235/70R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 2nd Generation KK (2008-2012)
  {
    make: "Jeep", model: "Liberty", years: [2008, 2009, 2010, 2011, 2012],
    trims: [
      {
        name: "Sport",
        frontWheel: { diameter: 16, width: 6.5, offset: 44 },
        rearWheel: { diameter: 16, width: 6.5, offset: 44 },
        frontTire: "225/75R16",
        rearTire: "225/75R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 17, width: 7.5, offset: 33 },
        rearWheel: { diameter: 17, width: 7.5, offset: 33 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Jet",
        frontWheel: { diameter: 17, width: 7.5, offset: 33 },
        rearWheel: { diameter: 17, width: 7.5, offset: 33 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === JEEP GRAND CHEROKEE ===
  // WJ (1999-2004)
  {
    make: "Jeep", model: "Grand Cherokee", years: [2000, 2001, 2002, 2003, 2004],
    trims: [
      {
        name: "Laredo",
        frontWheel: { diameter: 16, width: 7, offset: 40 },
        rearWheel: { diameter: 16, width: 7, offset: 40 },
        frontTire: "225/75R16",
        rearTire: "225/75R16",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 16, width: 7, offset: 40 },
        rearWheel: { diameter: 16, width: 7, offset: 40 },
        frontTire: "245/70R16",
        rearTire: "245/70R16",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Overland",
        frontWheel: { diameter: 17, width: 7.5, offset: 44 },
        rearWheel: { diameter: 17, width: 7.5, offset: 44 },
        frontTire: "245/65R17",
        rearTire: "245/65R17",
        boltPattern: "5x127",
        isStaggered: false,
      },
    ]
  },
  // WK (2005-2010)
  {
    make: "Jeep", model: "Grand Cherokee", years: [2005, 2006, 2007, 2008, 2009, 2010],
    trims: [
      {
        name: "Laredo",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "245/70R17",
        rearTire: "245/70R17",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 18, width: 7, offset: 50 },
        rearWheel: { diameter: 18, width: 7, offset: 50 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Overland",
        frontWheel: { diameter: 18, width: 7.5, offset: 44 },
        rearWheel: { diameter: 18, width: 7.5, offset: 44 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x127",
        isStaggered: false,
      },
    ]
  },
  // WK2 (2011-2021)
  {
    make: "Jeep", model: "Grand Cherokee", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    trims: [
      {
        name: "Laredo",
        frontWheel: { diameter: 17, width: 8, offset: 56.4 },
        rearWheel: { diameter: 17, width: 8, offset: 56.4 },
        frontTire: "245/70R17",
        rearTire: "245/70R17",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 18, width: 8, offset: 56.4 },
        rearWheel: { diameter: 18, width: 8, offset: 56.4 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Overland",
        frontWheel: { diameter: 20, width: 8, offset: 56.4 },
        rearWheel: { diameter: 20, width: 8, offset: 56.4 },
        frontTire: "265/50R20",
        rearTire: "265/50R20",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Summit",
        frontWheel: { diameter: 20, width: 8, offset: 56.4 },
        rearWheel: { diameter: 20, width: 8, offset: 56.4 },
        frontTire: "265/50R20",
        rearTire: "265/50R20",
        boltPattern: "5x127",
        isStaggered: false,
      },
    ]
  },
  // WL (2022-2026)
  {
    make: "Jeep", model: "Grand Cherokee", years: [2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Laredo",
        frontWheel: { diameter: 18, width: 8, offset: 52 },
        rearWheel: { diameter: 18, width: 8, offset: 52 },
        frontTire: "265/60R18",
        rearTire: "265/60R18",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 20, width: 8, offset: 52 },
        rearWheel: { diameter: 20, width: 8, offset: 52 },
        frontTire: "265/50R20",
        rearTire: "265/50R20",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Overland",
        frontWheel: { diameter: 20, width: 8, offset: 52 },
        rearWheel: { diameter: 20, width: 8, offset: 52 },
        frontTire: "265/50R20",
        rearTire: "265/50R20",
        boltPattern: "5x127",
        isStaggered: false,
      },
      {
        name: "Summit",
        frontWheel: { diameter: 21, width: 8.5, offset: 48 },
        rearWheel: { diameter: 21, width: 8.5, offset: 48 },
        frontTire: "275/45R21",
        rearTire: "275/45R21",
        boltPattern: "5x127",
        isStaggered: false,
      },
    ]
  },

  // === MAZDA6 ===
  // 1st Generation (2003-2008)
  {
    make: "Mazda", model: "Mazda6", years: [2003, 2004, 2005, 2006, 2007, 2008],
    trims: [
      {
        name: "i",
        frontWheel: { diameter: 16, width: 6.5, offset: 55 },
        rearWheel: { diameter: 16, width: 6.5, offset: 55 },
        frontTire: "205/65R16",
        rearTire: "205/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "s",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "s Grand Touring",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 2nd Generation (2009-2013)
  {
    make: "Mazda", model: "Mazda6", years: [2009, 2010, 2011, 2012, 2013],
    trims: [
      {
        name: "i Sport",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/55R17",
        rearTire: "215/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "i Touring",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/55R17",
        rearTire: "215/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "i Grand Touring",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/55R17",
        rearTire: "215/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "s Grand Touring",
        frontWheel: { diameter: 18, width: 7.5, offset: 50 },
        rearWheel: { diameter: 18, width: 7.5, offset: 50 },
        frontTire: "225/45R18",
        rearTire: "225/45R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 3rd Generation (2014-2021)
  {
    make: "Mazda", model: "Mazda6", years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    trims: [
      {
        name: "Sport",
        frontWheel: { diameter: 17, width: 7.5, offset: 50 },
        rearWheel: { diameter: 17, width: 7.5, offset: 50 },
        frontTire: "225/55R17",
        rearTire: "225/55R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 19, width: 7.5, offset: 45 },
        rearWheel: { diameter: 19, width: 7.5, offset: 45 },
        frontTire: "225/45R19",
        rearTire: "225/45R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Grand Touring",
        frontWheel: { diameter: 19, width: 7.5, offset: 45 },
        rearWheel: { diameter: 19, width: 7.5, offset: 45 },
        frontTire: "225/45R19",
        rearTire: "225/45R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Signature",
        frontWheel: { diameter: 19, width: 7.5, offset: 45 },
        rearWheel: { diameter: 19, width: 7.5, offset: 45 },
        frontTire: "225/45R19",
        rearTire: "225/45R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === ACURA (Common Models) ===
  // TL (2004-2014)
  {
    make: "Acura", model: "TL", years: [2004, 2005, 2006, 2007, 2008],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 8, offset: 45 },
        rearWheel: { diameter: 17, width: 8, offset: 45 },
        frontTire: "235/45R17",
        rearTire: "235/45R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Type-S",
        frontWheel: { diameter: 17, width: 8, offset: 45 },
        rearWheel: { diameter: 17, width: 8, offset: 45 },
        frontTire: "235/45R17",
        rearTire: "235/45R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "TL", years: [2009, 2010, 2011, 2012, 2013, 2014],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 8, offset: 55 },
        rearWheel: { diameter: 17, width: 8, offset: 55 },
        frontTire: "245/50R17",
        rearTire: "245/50R17",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "SH-AWD",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "245/45R18",
        rearTire: "245/45R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // MDX (2001-2020)
  {
    make: "Acura", model: "MDX", years: [2001, 2002, 2003, 2004, 2005, 2006],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7, offset: 50 },
        rearWheel: { diameter: 17, width: 7, offset: 50 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Touring",
        frontWheel: { diameter: 17, width: 7, offset: 50 },
        rearWheel: { diameter: 17, width: 7, offset: 50 },
        frontTire: "235/65R17",
        rearTire: "235/65R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "MDX", years: [2007, 2008, 2009, 2010, 2011, 2012, 2013],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "255/55R18",
        rearTire: "255/55R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Technology",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "255/55R18",
        rearTire: "255/55R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "MDX", years: [2014, 2015, 2016, 2017, 2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "245/60R18",
        rearTire: "245/60R18",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Technology",
        frontWheel: { diameter: 19, width: 8, offset: 50 },
        rearWheel: { diameter: 19, width: 8, offset: 50 },
        frontTire: "245/55R19",
        rearTire: "245/55R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "A-Spec",
        frontWheel: { diameter: 20, width: 9, offset: 50 },
        rearWheel: { diameter: 20, width: 9, offset: 50 },
        frontTire: "265/45R20",
        rearTire: "265/45R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // RDX (2007-2022)
  {
    make: "Acura", model: "RDX", years: [2007, 2008, 2009, 2010, 2011, 2012],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 7.5, offset: 55 },
        rearWheel: { diameter: 18, width: 7.5, offset: 55 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Technology",
        frontWheel: { diameter: 18, width: 7.5, offset: 55 },
        rearWheel: { diameter: 18, width: 7.5, offset: 55 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "RDX", years: [2013, 2014, 2015, 2016, 2017, 2018],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 7.5, offset: 55 },
        rearWheel: { diameter: 18, width: 7.5, offset: 55 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Technology",
        frontWheel: { diameter: 18, width: 7.5, offset: 55 },
        rearWheel: { diameter: 18, width: 7.5, offset: 55 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Advance",
        frontWheel: { diameter: 18, width: 7.5, offset: 55 },
        rearWheel: { diameter: 18, width: 7.5, offset: 55 },
        frontTire: "235/60R18",
        rearTire: "235/60R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "RDX", years: [2019, 2020, 2021, 2022],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 55 },
        rearWheel: { diameter: 19, width: 8, offset: 55 },
        frontTire: "255/50R19",
        rearTire: "255/50R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Technology",
        frontWheel: { diameter: 19, width: 8, offset: 55 },
        rearWheel: { diameter: 19, width: 8, offset: 55 },
        frontTire: "255/50R19",
        rearTire: "255/50R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "A-Spec",
        frontWheel: { diameter: 20, width: 9, offset: 50 },
        rearWheel: { diameter: 20, width: 9, offset: 50 },
        frontTire: "255/45R20",
        rearTire: "255/45R20",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // ILX (2013-2022)
  {
    make: "Acura", model: "ILX", years: [2013, 2014, 2015],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 55 },
        rearWheel: { diameter: 16, width: 6.5, offset: 55 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/45R17",
        rearTire: "215/45R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  {
    make: "Acura", model: "ILX", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/45R17",
        rearTire: "215/45R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Premium",
        frontWheel: { diameter: 17, width: 7, offset: 55 },
        rearWheel: { diameter: 17, width: 7, offset: 55 },
        frontTire: "215/45R17",
        rearTire: "215/45R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "A-Spec",
        frontWheel: { diameter: 18, width: 8, offset: 55 },
        rearWheel: { diameter: 18, width: 8, offset: 55 },
        frontTire: "225/40R18",
        rearTire: "225/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating Honda, Chrysler, Jeep, Acura, and Mazda fitments...\n");

  let updatedCount = 0;
  let insertedCount = 0;

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
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');

        // Check if record exists (flexible matching)
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (
              LOWER(model) = ${vehicle.model.toLowerCase()} 
              OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')}
              OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/&/g, 'and')}
            )
            AND (
              LOWER(display_trim) = ${trim.name.toLowerCase()} 
              OR LOWER(modification_id) LIKE ${`%${trim.name.toLowerCase().replace(/\s+/g, '-')}%`}
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
  console.log(`Total processed: ${updatedCount + insertedCount} records`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
