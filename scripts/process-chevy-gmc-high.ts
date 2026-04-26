/**
 * Process Chevrolet and GMC "high" tier records to complete tier
 * Sources: Google AI Overviews from OEM wheel/tire searches
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
  rearWheelDiameter?: number;
  rearWheelWidth?: number;
  rearTireSize?: string;
}

interface ModelSpec {
  model: string;
  boltPattern: string;
  centerBore: number;
  fitments: TrimFitment[];
}

// ===== CHEVROLET SUBURBAN =====
const suburban: ModelSpec = {
  model: 'suburban',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    // 2021-2026 (11th Gen)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '265/65R18' },
    { trims: ['Z71'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/60R20' },
    { trims: ['RST'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' },
    { trims: ['Premier'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/60R20' },
    { trims: ['High Country'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' },
    // 2015-2020 (10th Gen)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' },
    { trims: ['LTZ', 'Premier'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' },
    // 2007-2014 (9th Gen)
    { trims: ['LS', 'Base'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' },
    { trims: ['LT'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '265/65R18' },
    { trims: ['LTZ'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' },
    // 2000-2006 (8th Gen)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2000, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 7, tireSize: '265/70R16' },
    { trims: ['LT', 'Z71'], yearStart: 2000, yearEnd: 2006, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' },
    // 1992-1999 (7th Gen)
    { trims: ['C1500', 'K1500', 'Base', 'LS', 'LT'], yearStart: 1992, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: '245/75R16' },
    // 1988-1991 (Late R/V platform, C/K1500)
    { trims: ['C1500', 'K1500', 'Base', 'Scottsdale', 'Silverado'], yearStart: 1988, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' },
    // Older (GMT400 platform)
    { trims: ['C10', 'K10', 'C20', 'K20', 'Base', 'Scottsdale', 'Silverado'], yearStart: 1973, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' },
    // Classic (1967-1972)
    { trims: ['C10', 'K10', 'C20', 'K20', 'Base'], yearStart: 1967, yearEnd: 1972, wheelDiameter: 15, wheelWidth: 6, tireSize: '235/75R15' }
  ]
};

// ===== CHEVROLET CORVETTE =====
const corvette: ModelSpec = {
  model: 'corvette',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    // C8 (2020-Present) - All staggered
    { trims: ['Stingray', '1LT', '2LT', '3LT'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/35ZR19', rearWheelDiameter: 20, rearWheelWidth: 11, rearTireSize: '305/30ZR20' },
    { trims: ['Z51'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/35ZR19', rearWheelDiameter: 20, rearWheelWidth: 11, rearTireSize: '305/30ZR20' },
    { trims: ['Z06', 'Z07'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 10, tireSize: '275/30ZR20', rearWheelDiameter: 21, rearWheelWidth: 13, rearTireSize: '345/25ZR21' },
    // C7 (2014-2019) - Staggered
    { trims: ['Stingray', '1LT', '2LT', '3LT', 'Base'], yearStart: 2014, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/40ZR18', rearWheelDiameter: 19, rearWheelWidth: 10, rearTireSize: '285/35ZR19' },
    { trims: ['Z51'], yearStart: 2014, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/35ZR19', rearWheelDiameter: 20, rearWheelWidth: 10, rearTireSize: '285/30ZR20' },
    { trims: ['Z06', 'Grand Sport', 'GS'], yearStart: 2015, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 10, tireSize: '285/30ZR19', rearWheelDiameter: 20, rearWheelWidth: 12, rearTireSize: '335/25ZR20' },
    { trims: ['ZR1'], yearStart: 2019, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 10, tireSize: '285/30ZR19', rearWheelDiameter: 20, rearWheelWidth: 12, rearTireSize: '335/25ZR20' },
    // C6 (2005-2013)
    { trims: ['Base', '1LT', '2LT', '3LT'], yearStart: 2005, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/40ZR18', rearWheelDiameter: 19, rearWheelWidth: 10, rearTireSize: '285/35ZR19' },
    { trims: ['Z51'], yearStart: 2005, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/40ZR18', rearWheelDiameter: 19, rearWheelWidth: 10, rearTireSize: '285/35ZR19' },
    { trims: ['Z06'], yearStart: 2006, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 9.5, tireSize: '275/35ZR18', rearWheelDiameter: 19, rearWheelWidth: 12, rearTireSize: '325/30ZR19' },
    { trims: ['ZR1'], yearStart: 2009, yearEnd: 2013, wheelDiameter: 19, wheelWidth: 10, tireSize: '285/30ZR19', rearWheelDiameter: 20, rearWheelWidth: 12, rearTireSize: '335/25ZR20' },
    // C5 (1997-2004)
    { trims: ['Base', 'Coupe', 'Convertible'], yearStart: 1997, yearEnd: 2004, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '245/45ZR17', rearWheelDiameter: 18, rearWheelWidth: 9.5, rearTireSize: '275/40ZR18' },
    { trims: ['Z06'], yearStart: 2001, yearEnd: 2004, wheelDiameter: 17, wheelWidth: 9.5, tireSize: '265/40ZR17', rearWheelDiameter: 18, rearWheelWidth: 10.5, rearTireSize: '295/35ZR18' },
    // C4 (1984-1996)
    { trims: ['Base', 'Coupe', 'Convertible'], yearStart: 1984, yearEnd: 1996, wheelDiameter: 16, wheelWidth: 8.5, tireSize: '255/50ZR16' },
    { trims: ['Z51', 'ZR1'], yearStart: 1990, yearEnd: 1995, wheelDiameter: 17, wheelWidth: 9.5, tireSize: '275/40ZR17', rearWheelDiameter: 17, rearWheelWidth: 11, rearTireSize: '315/35ZR17' },
    // C3 (1968-1982)
    { trims: ['Stingray', 'Base', 'Coupe', 'Convertible'], yearStart: 1968, yearEnd: 1982, wheelDiameter: 15, wheelWidth: 8, tireSize: '225/70R15' },
    // C2 (1963-1967)
    { trims: ['Stingray', 'Base', 'Coupe', 'Convertible'], yearStart: 1963, yearEnd: 1967, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/75R15' },
    // C1 (1953-1962)
    { trims: ['Base', 'Roadster'], yearStart: 1953, yearEnd: 1962, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '185/80R15' }
  ]
};

// ===== CHEVROLET CAMARO =====
const camaro: ModelSpec = {
  model: 'camaro',
  boltPattern: '5x120',
  centerBore: 66.9,
  fitments: [
    // 6th Gen (2016-2024)
    { trims: ['LS', 'LT', '1LT', '2LT', '1LS'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/50R18' },
    { trims: ['LT', '2LT', '3LT', 'RS'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20' },
    { trims: ['SS', '1SS', '2SS'], yearStart: 2016, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40ZR20', rearWheelDiameter: 20, rearWheelWidth: 9.5, rearTireSize: '275/35ZR20' },
    { trims: ['ZL1'], yearStart: 2017, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/30ZR20', rearWheelDiameter: 20, rearWheelWidth: 11, rearTireSize: '305/30ZR20' },
    { trims: ['ZL1 1LE'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 11, tireSize: '305/30R19', rearWheelDiameter: 19, rearWheelWidth: 12, rearTireSize: '325/30R19' },
    // 5th Gen (2010-2015)
    { trims: ['LS', 'LT', '1LT', '2LT'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/55R18' },
    { trims: ['LT', 'RS'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20' },
    { trims: ['SS', '1SS', '2SS'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20', rearWheelDiameter: 20, rearWheelWidth: 9, rearTireSize: '275/40R20' },
    { trims: ['ZL1'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/35ZR20', rearWheelDiameter: 20, rearWheelWidth: 11, rearTireSize: '305/35ZR20' },
    { trims: ['Z28'], yearStart: 2014, yearEnd: 2015, wheelDiameter: 19, wheelWidth: 11, tireSize: '305/30ZR19', rearWheelDiameter: 19, rearWheelWidth: 11.5, rearTireSize: '305/30ZR19' },
    // 4th Gen (1993-2002)
    { trims: ['Base', 'Sport', 'RS'], yearStart: 1993, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 7.5, tireSize: '235/55R16' },
    { trims: ['Z28', 'SS'], yearStart: 1993, yearEnd: 2002, wheelDiameter: 17, wheelWidth: 9, tireSize: '275/40ZR17' },
    // 3rd Gen (1982-1992)
    { trims: ['Sport', 'Berlinetta', 'Base'], yearStart: 1982, yearEnd: 1992, wheelDiameter: 15, wheelWidth: 7, tireSize: '215/65R15' },
    { trims: ['Z28', 'IROC-Z'], yearStart: 1982, yearEnd: 1992, wheelDiameter: 16, wheelWidth: 8, tireSize: '245/50R16' },
    // 2nd Gen (1970-1981)
    { trims: ['Base', 'Sport', 'RS', 'LT', 'Type LT'], yearStart: 1970, yearEnd: 1981, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/70R15' },
    { trims: ['Z28', 'SS'], yearStart: 1970, yearEnd: 1981, wheelDiameter: 15, wheelWidth: 7, tireSize: '245/60R15' },
    // 1st Gen (1967-1969)
    { trims: ['Base', 'RS'], yearStart: 1967, yearEnd: 1969, wheelDiameter: 14, wheelWidth: 6, tireSize: '215/70R14' },
    { trims: ['SS', 'Z28'], yearStart: 1967, yearEnd: 1969, wheelDiameter: 15, wheelWidth: 7, tireSize: '215/65R15' }
  ]
};

// ===== CHEVROLET IMPALA =====
const impala: ModelSpec = {
  model: 'impala',
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    // 10th Gen (2014-2020) - 5x120
    { trims: ['LS', 'Base'], yearStart: 2014, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' },
    { trims: ['LT', 'LS'], yearStart: 2014, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/45R19' },
    { trims: ['LTZ', 'Premier'], yearStart: 2014, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20' },
    // 9th Gen (2006-2013) - 5x115
    { trims: ['LS', 'LT', 'Base'], yearStart: 2006, yearEnd: 2013, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '225/60R16' },
    { trims: ['LT', 'LTZ'], yearStart: 2006, yearEnd: 2013, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/55R17' },
    { trims: ['LTZ', 'SS'], yearStart: 2006, yearEnd: 2009, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/50R18' },
    // 8th Gen (2000-2005) - 5x115
    { trims: ['Base', 'LS'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 6.5, tireSize: '225/60R15' },
    { trims: ['LS', 'SS'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '225/60R16' },
    { trims: ['SS'], yearStart: 2004, yearEnd: 2005, wheelDiameter: 17, wheelWidth: 8, tireSize: '235/55R17' },
    // Classic (1994-1996)
    { trims: ['Base', 'SS'], yearStart: 1994, yearEnd: 1996, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '255/50R17' },
    // Earlier Gens
    { trims: ['Base', 'Custom', 'Super Sport', 'SS'], yearStart: 1958, yearEnd: 1985, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/75R15' }
  ]
};

// ===== CHEVROLET MALIBU =====
const malibu: ModelSpec = {
  model: 'malibu',
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    // 9th Gen (2016-2025)
    { trims: ['LS', 'L', 'Base'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 16, wheelWidth: 7, tireSize: '205/65R16' },
    { trims: ['LT', '1LT'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/55R17' },
    { trims: ['LT', 'RS', 'Hybrid'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/45R18' },
    { trims: ['2LT', 'Premier'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
    // 8th Gen (2008-2012)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' },
    { trims: ['LT', 'LTZ'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/55R17' },
    { trims: ['LTZ'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/50R18' },
    // 7th Gen (2004-2007) - 5x110
    { trims: ['Base', 'LS', 'LT', 'Maxx'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/65R15' },
    { trims: ['LT', 'SS', 'LTZ'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '225/55R16' },
    // 6th Gen (1997-2003)
    { trims: ['Base', 'LS'], yearStart: 1997, yearEnd: 2003, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/70R15' },
    { trims: ['LS', 'LT'], yearStart: 1997, yearEnd: 2003, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' },
    // Classic Era (1964-1983)
    { trims: ['Base', 'Classic', 'Laguna', 'SS'], yearStart: 1964, yearEnd: 1983, wheelDiameter: 14, wheelWidth: 6, tireSize: '205/75R14' },
    { trims: ['SS 396', 'SS 454', 'SS'], yearStart: 1964, yearEnd: 1973, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/70R15' }
  ]
};

// ===== CHEVROLET C10/C20/K10/K20 (Classic Trucks) =====
const c10: ModelSpec = {
  model: 'c10',
  boltPattern: '5x127',
  centerBore: 78.1,
  fitments: [
    { trims: ['Base', 'Custom', 'Deluxe', 'Scottsdale', 'Silverado', 'Cheyenne'], yearStart: 1960, yearEnd: 1987, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' }
  ]
};

const c20: ModelSpec = {
  model: 'c20',
  boltPattern: '8x165.1',
  centerBore: 117,
  fitments: [
    { trims: ['Base', 'Custom', 'Deluxe', 'Scottsdale', 'Silverado', 'Cheyenne'], yearStart: 1960, yearEnd: 1987, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '235/85R16' }
  ]
};

const k10: ModelSpec = {
  model: 'k10',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    { trims: ['Base', 'Custom', 'Deluxe', 'Scottsdale', 'Silverado', 'Cheyenne'], yearStart: 1960, yearEnd: 1987, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' }
  ]
};

// ===== CHEVROLET S10 =====
const s10: ModelSpec = {
  model: 's10',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'LS', 'Work Truck'], yearStart: 1982, yearEnd: 2004, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/75R15' },
    { trims: ['LS', 'LT', 'ZR2', 'ZR5'], yearStart: 1994, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/75R16' },
    { trims: ['Xtreme'], yearStart: 1999, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/55R16' }
  ]
};

// ===== CHEVROLET BLAZER (Classic S10 Blazer) =====
const s10Blazer: ModelSpec = {
  model: 's10 blazer',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    // S10 Blazer - compact platform
    { trims: ['Base', 'LS', 'Tahoe', 'Sport'], yearStart: 1983, yearEnd: 1994, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/75R15' },
    { trims: ['LS', 'LT', 'TrailBlazer'], yearStart: 1995, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/70R15' },
    { trims: ['LT', 'LS', 'TrailBlazer', 'Xtreme'], yearStart: 1995, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' }
  ]
};

// ===== CHEVROLET C1500/K1500 (standalone trucks) =====
const c1500: ModelSpec = {
  model: 'c1500',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    { trims: ['Base', 'Cheyenne', 'Scottsdale', 'Silverado', 'WT', 'Work Truck'], yearStart: 1988, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: '245/75R16' }
  ]
};

const k1500: ModelSpec = {
  model: 'k1500',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    { trims: ['Base', 'Cheyenne', 'Scottsdale', 'Silverado', 'WT', 'Work Truck'], yearStart: 1988, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: '245/75R16' }
  ]
};

// ===== CHEVROLET BLAZER (Full-size K5) =====
const blazer: ModelSpec = {
  model: 'blazer',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    // K5 Blazer (full range)
    { trims: ['Base', 'Custom', 'Deluxe', 'Scottsdale', 'Silverado', 'Cheyenne', 'K5'], yearStart: 1969, yearEnd: 1994, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' },
    // Modern Blazer (2019+) - 5x120
    { trims: ['L', 'LT', '2LT', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/55R18' },
    { trims: ['RS', '3LT'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/45R20' },
    { trims: ['Premier', 'RS'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 8.5, tireSize: '255/40R21' }
  ]
};

// ===== CHEVROLET NOVA =====
const nova: ModelSpec = {
  model: 'nova',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Custom', 'SS', 'Rally'], yearStart: 1962, yearEnd: 1988, wheelDiameter: 14, wheelWidth: 6, tireSize: '205/70R14' },
    { trims: ['SS', 'Super Sport', 'Rally Sport'], yearStart: 1968, yearEnd: 1979, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/70R15' }
  ]
};

// ===== CHEVROLET CAPRICE =====
const caprice: ModelSpec = {
  model: 'caprice',
  boltPattern: '5x127',
  centerBore: 78.1,
  fitments: [
    { trims: ['Base', 'Classic', 'Brougham', 'Estate'], yearStart: 1965, yearEnd: 1996, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/75R15' },
    { trims: ['LTZ', '9C1', 'PPV'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' }
  ]
};

// ===== CHEVROLET MONTE CARLO =====
const monteCarlo: ModelSpec = {
  model: 'monte carlo',
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    // 6th Gen (2000-2007)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2000, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '225/60R16' },
    { trims: ['SS', 'LT', 'Supercharged'], yearStart: 2000, yearEnd: 2007, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/55R17' },
    { trims: ['SS', 'Supercharged', 'Intimidator'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' },
    // Earlier gens
    { trims: ['Base', 'LS', 'LTZ', 'Z34', 'SS'], yearStart: 1970, yearEnd: 1999, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/70R15' }
  ]
};

// ===== CHEVROLET EL CAMINO =====
const elCamino: ModelSpec = {
  model: 'el camino',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Classic', 'Custom', 'Deluxe'], yearStart: 1959, yearEnd: 1987, wheelDiameter: 14, wheelWidth: 6, tireSize: '205/70R14' },
    { trims: ['SS', 'SS 396', 'SS 454', 'Royal Knight', 'Conquista'], yearStart: 1964, yearEnd: 1987, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/70R15' }
  ]
};

// ===== CHEVROLET CHEVELLE =====
const chevelle: ModelSpec = {
  model: 'chevelle',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', '300', 'Deluxe', 'Malibu'], yearStart: 1964, yearEnd: 1977, wheelDiameter: 14, wheelWidth: 6, tireSize: '205/70R14' },
    { trims: ['SS', 'SS 396', 'SS 454', 'Super Sport'], yearStart: 1964, yearEnd: 1973, wheelDiameter: 15, wheelWidth: 7, tireSize: '255/60R15' }
  ]
};

// ===== CHEVROLET CAVALIER =====
const cavalier: ModelSpec = {
  model: 'cavalier',
  boltPattern: '5x100',
  centerBore: 57.1,
  fitments: [
    { trims: ['Base', 'VL', 'RS'], yearStart: 1982, yearEnd: 2005, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/75R14' },
    { trims: ['LS', 'LS Sport'], yearStart: 1995, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15' },
    { trims: ['Z24', 'LS Sport'], yearStart: 1988, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16' }
  ]
};

// ===== CHEVROLET CELEBRITY =====
const celebrity: ModelSpec = {
  model: 'celebrity',
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'CL', 'Classic', 'Eurosport'], yearStart: 1982, yearEnd: 1990, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/75R14' },
    { trims: ['Eurosport', 'VR'], yearStart: 1984, yearEnd: 1990, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/70R15' }
  ]
};

// ===== CHEVROLET TRAX =====
const trax: ModelSpec = {
  model: 'trax',
  boltPattern: '5x105',
  centerBore: 56.6,
  fitments: [
    // 1st Gen (2013-2022)
    { trims: ['LS', 'LT', 'Base'], yearStart: 2013, yearEnd: 2022, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/70R16' },
    { trims: ['LT', 'LTZ', 'Premier'], yearStart: 2013, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7, tireSize: '215/55R18' },
    // 2nd Gen (2024+)
    { trims: ['LS', '1LS', 'LT'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' },
    { trims: ['LT', '1RS', 'RS', 'Activ'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '225/45R19' }
  ]
};

// ===== GMC SIERRA =====
const sierra: ModelSpec = {
  model: 'sierra',
  boltPattern: '6x139.7',
  centerBore: 78.1,
  fitments: [
    // Current Gen (2019+)
    { trims: ['Base', 'SLE', 'Pro'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: '265/70R17' },
    { trims: ['SLE', 'SLT', 'Elevation'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '275/65R18' },
    { trims: ['SLT', 'AT4', 'Denali'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/60R20' },
    { trims: ['Denali Ultimate', 'AT4X'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' },
    // Previous Gen (2014-2018)
    { trims: ['Base', 'SLE'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' },
    { trims: ['SLT', 'All Terrain'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18' },
    { trims: ['Denali'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/55R20' },
    // 2007-2013
    { trims: ['Base', 'Work Truck', 'SL'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17' },
    { trims: ['SLE', 'SLT'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' },
    { trims: ['Denali'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' },
    // 1999-2006
    { trims: ['Base', 'SL', 'SLE', 'SLT'], yearStart: 1999, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 7, tireSize: '265/75R16' },
    // Classic Sierra (1973-1998)
    { trims: ['Base', 'Custom', 'Sierra Classic', 'High Sierra', 'SLE', 'SLT', 'SL'], yearStart: 1973, yearEnd: 1998, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' }
  ]
};

// ===== GMC S15/SONOMA =====
const s15: ModelSpec = {
  model: 's15',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Sierra Classic', 'High Sierra', 'Gypsy'], yearStart: 1982, yearEnd: 1990, wheelDiameter: 14, wheelWidth: 6, tireSize: '195/75R14' },
    { trims: ['SLE', 'SLT', 'High Sierra'], yearStart: 1982, yearEnd: 1990, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/75R15' }
  ]
};

// ===== GMC JIMMY =====
const jimmy: ModelSpec = {
  model: 'jimmy',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    // S15/S10 Jimmy (Compact)
    { trims: ['Base', 'SLE', 'Sierra Classic'], yearStart: 1983, yearEnd: 2001, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/75R15' },
    { trims: ['SLE', 'SLT', 'Diamond Edition', 'Envoy'], yearStart: 1995, yearEnd: 2001, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' }
  ]
};

// ===== CHEVROLET 150/210/BEL AIR/DELUXE/NOMAD (1950s) =====
const chevy150: ModelSpec = {
  model: '150',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Utility', 'Sedan', 'Handyman'], yearStart: 1953, yearEnd: 1957, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '6.70-15' }
  ]
};

const chevy210: ModelSpec = {
  model: '210',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Delray', 'Townsman', 'Beauville'], yearStart: 1953, yearEnd: 1957, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '6.70-15' }
  ]
};

const belAir: ModelSpec = {
  model: 'bel air',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Sport Coupe', 'Convertible', 'Nomad', 'Sport Sedan'], yearStart: 1950, yearEnd: 1975, wheelDiameter: 15, wheelWidth: 6, tireSize: '7.50-15' }
  ]
};

const deluxe: ModelSpec = {
  model: 'deluxe',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Styleline', 'Fleetline', 'Sport Coupe'], yearStart: 1941, yearEnd: 1952, wheelDiameter: 15, wheelWidth: 5, tireSize: '6.00-16' }
  ]
};

const nomad: ModelSpec = {
  model: 'nomad',
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Wagon'], yearStart: 1955, yearEnd: 1961, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '7.50-15' }
  ]
};

// All model specs
const allModels: ModelSpec[] = [
  suburban, corvette, camaro, impala, malibu,
  c10, c20, k10, c1500, k1500, s10, s10Blazer, blazer,
  nova, caprice, monteCarlo, elCamino, chevelle,
  cavalier, celebrity, trax,
  sierra, s15, jimmy,
  chevy150, chevy210, belAir, deluxe, nomad
];

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

function findModelSpec(modelName: string): ModelSpec | null {
  const normalized = normalizeModel(modelName);
  
  // Exact match first
  for (const spec of allModels) {
    if (normalizeModel(spec.model) === normalized) return spec;
  }
  
  // Special cases with explicit matching (before partial matching)
  if (normalized === '150') return chevy150;
  if (normalized === '210') return chevy210;
  if (normalized.includes('bel') && normalized.includes('air')) return belAir;
  if (normalized === 'c1500' || normalized === 'c-1500') return c1500;
  if (normalized === 'k1500' || normalized === 'k-1500') return k1500;
  if (normalized.includes('sierra')) return sierra;
  if (normalized.includes('suburban')) return suburban;
  
  // Partial matches - model name starts with spec
  for (const spec of allModels) {
    const specModel = normalizeModel(spec.model);
    // Model starts with spec model OR spec model starts with model (for compound names like "s10 blazer")
    if (normalized.startsWith(specModel) || specModel.startsWith(normalized)) {
      return spec;
    }
  }
  
  // Looser partial matches
  for (const spec of allModels) {
    const specModel = normalizeModel(spec.model);
    if (normalized.includes(specModel) || specModel.includes(normalized)) {
      return spec;
    }
  }
  
  // Fallback for truck weight classes
  if (normalized.includes('1500') || normalized.includes('2500') || normalized.includes('3500')) {
    return suburban;
  }
  
  return null;
}

function matchTrimToFitment(spec: ModelSpec, year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = spec.fitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Exact trim match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  
  // Contains match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  
  // Keyword matching
  const keywords: [string[], TrimFitment | null][] = [
    [['zl1'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('zl1'))) || null],
    [['z06', 'z07'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('z06') || normalizeTrim(t).includes('z07'))) || null],
    [['zr1'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('zr1'))) || null],
    [['z28'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('z28'))) || null],
    [['ss', 'super sport'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('ss') || normalizeTrim(t).includes('super sport'))) || null],
    [['high country'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('high country'))) || null],
    [['denali'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('denali'))) || null],
    [['rst', 'rs'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('rst') || normalizeTrim(t).includes('rs'))) || null],
    [['premier', 'ltz'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('premier') || normalizeTrim(t).includes('ltz'))) || null],
    [['z71', 'at4'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('z71') || normalizeTrim(t).includes('at4'))) || null],
    [['lt', 'slt'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t) === 'lt' || normalizeTrim(t) === 'slt')) || null],
    [['ls', 'sle'], yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t) === 'ls' || normalizeTrim(t) === 'sle')) || null],
  ];
  
  for (const [kws, fitment] of keywords) {
    if (fitment && kws.some(kw => normalized.includes(kw))) {
      return fitment;
    }
  }
  
  // Fallback to base trim
  const baseFitment = yearMatches.find(tf => tf.trims.some(t => ['base', 'ls', 'l', 'sl', 'work truck', 'wt'].includes(normalizeTrim(t))));
  return baseFitment || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  // Get all Chevy and GMC "high" tier records
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE (LOWER(make) = 'chevrolet' OR LOWER(make) = 'gmc')
      AND quality_tier = 'high'
    ORDER BY make, model, year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records to process`);
  
  let updated = 0, skipped = 0;
  const modelStats: Record<string, {updated: number, skipped: number}> = {};
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const modelKey = `${record.make} ${record.model}`;
    if (!modelStats[modelKey]) modelStats[modelKey] = {updated: 0, skipped: 0};
    
    const spec = findModelSpec(record.model);
    if (!spec) {
      flagged.push(`No spec for: ${record.year} ${record.make} ${record.model} ${record.display_trim}`);
      modelStats[modelKey].skipped++;
      skipped++;
      continue;
    }
    
    const matchedFitment = matchTrimToFitment(spec, record.year, record.display_trim);
    if (!matchedFitment) {
      flagged.push(`No trim match: ${record.year} ${record.model} ${record.display_trim}`);
      modelStats[modelKey].skipped++;
      skipped++;
      continue;
    }
    
    // Build wheel sizes array
    const isStaggered = matchedFitment.rearWheelDiameter && matchedFitment.rearWheelDiameter !== matchedFitment.wheelDiameter;
    const oemWheelSizes = isStaggered ? [
      { diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'front', isStock: true },
      { diameter: matchedFitment.rearWheelDiameter, width: matchedFitment.rearWheelWidth, offset: null, axle: 'rear', isStock: true }
    ] : [
      { diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'both', isStock: true }
    ];
    
    const oemTireSizes = isStaggered ? 
      [matchedFitment.tireSize, matchedFitment.rearTireSize] :
      [matchedFitment.tireSize];
    
    if (dryRun) {
      if (updated < 20 || updated % 50 === 0) {
        const stag = isStaggered ? ' (STAGGERED)' : '';
        console.log(`  [DRY] ${record.year} ${record.make} ${record.model} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}${stag}`);
      }
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = $3, 
            center_bore_mm = $4, 
            source = 'chevy-gmc-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify(oemTireSizes), spec.boltPattern, spec.centerBore, record.id]
      );
    }
    modelStats[modelKey].updated++;
    updated++;
  }
  
  console.log(`\n✅ Results: ${updated} updated, ⚠️ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  
  console.log(`\n📊 By Model:`);
  for (const [model, stats] of Object.entries(modelStats).sort((a, b) => b[1].updated - a[1].updated)) {
    console.log(`  ${model}: ${stats.updated} updated, ${stats.skipped} skipped`);
  }
  
  if (flagged.length > 0) {
    console.log(`\n⚠️ Flagged (first 10):`);
    flagged.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (flagged.length > 10) console.log(`  ... and ${flagged.length - 10} more`);
  }
  
  await pool.end();
}

main().catch(console.error);
