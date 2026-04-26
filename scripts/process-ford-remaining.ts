/**
 * Process Ford Remaining Incomplete Records (206 total)
 * Models: Crown Victoria, Ranger, F-250, F-350, E-150, E-250, E-350, Bronco,
 *         Thunderbird, F-100, Galaxie, LTD, Bronco II, Fairlane, Maverick,
 *         Torino, Aerostar, Falcon, Escape, Flex, Taurus, Mustang (older)
 * 
 * Sources: Google AI Overviews from tiresize.com, rbptires.com, etc.
 * Date: 2026-04-26
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface ModelSpec {
  models: string[];  // lowercase model matches
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
  boltPattern: string;
  centerBore: number;
  trims?: string[];  // if specified, only match these trims
}

// ============================================================
// FORD CROWN VICTORIA (1980-2011)
// Bolt: 5x114.3, Center Bore: 70.6mm
// ============================================================
const crownVicSpecs: ModelSpec[] = [
  // 1998-2011 (2nd Gen)
  { models: ['crown victoria'], yearStart: 1998, yearEnd: 2011, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16', boltPattern: '5x114.3', centerBore: 70.6, trims: ['Base', 'LX', 'S', 'Standard'] },
  { models: ['crown victoria'], yearStart: 1998, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'P235/55R17', boltPattern: '5x114.3', centerBore: 70.6, trims: ['LX Sport', 'Police Interceptor', 'Police', 'PI', 'Sport'] },
  { models: ['crown victoria'], yearStart: 1998, yearEnd: 2011, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16', boltPattern: '5x114.3', centerBore: 70.6 },
  // 1992-1997 (1st Gen)
  { models: ['crown victoria'], yearStart: 1992, yearEnd: 1997, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P215/70R15', boltPattern: '5x114.3', centerBore: 70.6 },
  // 1980-1991 (LTD Crown Victoria - 15")
  { models: ['crown victoria'], yearStart: 1980, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/75R15', boltPattern: '5x114.3', centerBore: 70.6 },
];

// ============================================================
// FORD RANGER (Modern 2019-2026)
// Bolt: 6x139.7, Center Bore: 93.1mm
// ============================================================
const rangerModernSpecs: ModelSpec[] = [
  // XL - 16" steel
  { models: ['ranger'], yearStart: 2019, yearEnd: 2023, wheelDiameter: 16, wheelWidth: 7, tireSize: '255/70R16', boltPattern: '6x139.7', centerBore: 93.1, trims: ['XL', 'Base'] },
  // XLT - 17"
  { models: ['ranger'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: '265/65R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['XLT', 'STX'] },
  // Lariat - 18"
  { models: ['ranger'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Lariat'] },
  // Tremor - 17" w/ LT tires
  { models: ['ranger'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: 'LT265/70R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Tremor', 'FX4'] },
  // Raptor - 17" w/ 33" tires
  { models: ['ranger'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: 'LT285/70R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Raptor'] },
  // Fallback 2024+
  { models: ['ranger'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/70R17', boltPattern: '6x139.7', centerBore: 93.1 },
  // Fallback 2019-2023
  { models: ['ranger'], yearStart: 2019, yearEnd: 2023, wheelDiameter: 17, wheelWidth: 8, tireSize: '265/65R17', boltPattern: '6x139.7', centerBore: 93.1 },
];

// Classic Ranger (1983-2011) - 5x114.3
const rangerClassicSpecs: ModelSpec[] = [
  { models: ['ranger'], yearStart: 1998, yearEnd: 2011, wheelDiameter: 15, wheelWidth: 7, tireSize: '225/70R15', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['ranger'], yearStart: 1983, yearEnd: 1997, wheelDiameter: 14, wheelWidth: 6, tireSize: '205/75R14', boltPattern: '5x114.3', centerBore: 70.5 },
];

// ============================================================
// FORD F-250/F-350 SUPER DUTY (1999-2026)
// Bolt: 8x170, Center Bore: 124.9mm
// ============================================================
const superDutySpecs: ModelSpec[] = [
  // 2017-2026 (5th Gen)
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT245/75R17', boltPattern: '8x170', centerBore: 124.9, trims: ['XL', 'Base'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: 'LT275/70R18', boltPattern: '8x170', centerBore: 124.9, trims: ['XLT'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8, tireSize: 'LT275/65R20', boltPattern: '8x170', centerBore: 124.9, trims: ['Lariat', 'King Ranch', 'Platinum', 'Limited'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: 'LT275/70R18', boltPattern: '8x170', centerBore: 124.9 },
  
  // 2011-2016 (4th Gen)
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2011, yearEnd: 2016, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT245/75R17', boltPattern: '8x170', centerBore: 124.9, trims: ['XL', 'Base'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2011, yearEnd: 2016, wheelDiameter: 18, wheelWidth: 8, tireSize: 'LT275/65R18', boltPattern: '8x170', centerBore: 124.9, trims: ['XLT', 'Lariat'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2011, yearEnd: 2016, wheelDiameter: 20, wheelWidth: 8, tireSize: 'LT275/65R20', boltPattern: '8x170', centerBore: 124.9, trims: ['King Ranch', 'Platinum'] },
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 2011, yearEnd: 2016, wheelDiameter: 18, wheelWidth: 8, tireSize: 'LT275/65R18', boltPattern: '8x170', centerBore: 124.9 },
  
  // 1999-2010 (Early Super Duty)
  { models: ['f-250', 'f250', 'f-350', 'f350'], yearStart: 1999, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT245/75R17', boltPattern: '8x170', centerBore: 124.9 },
  
  // 1980-1998 (Pre-Super Duty F-250 - 8x165.1)
  { models: ['f-250', 'f250'], yearStart: 1980, yearEnd: 1998, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 1980-1998 (Pre-Super Duty F-350 - 8x165.1)
  { models: ['f-350', 'f350'], yearStart: 1980, yearEnd: 1998, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 1967-1979 (F-250 - 8x165.1)
  { models: ['f-250', 'f250'], yearStart: 1967, yearEnd: 1979, wheelDiameter: 16, wheelWidth: 6, tireSize: '7.50-16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 1967-1979 (F-350 - 8x165.1)
  { models: ['f-350', 'f350'], yearStart: 1967, yearEnd: 1979, wheelDiameter: 16, wheelWidth: 6, tireSize: '7.50-16', boltPattern: '8x165.1', centerBore: 116.1 },
];

// ============================================================
// FORD E-SERIES VANS (E-150, E-250, E-350)
// ============================================================
const eSeriesSpecs: ModelSpec[] = [
  // 2008-2014 (8x165.1 bolt pattern)
  { models: ['e-150', 'e150', 'e-150 econoline'], yearStart: 2008, yearEnd: 2014, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT225/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  { models: ['e-250', 'e250', 'e-250 econoline'], yearStart: 2008, yearEnd: 2014, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  { models: ['e-350', 'e350', 'e-350 econoline'], yearStart: 2008, yearEnd: 2014, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 2004-2007 (Transitional)
  { models: ['e-150', 'e150', 'e-150 econoline'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P235/70R16', boltPattern: '5x139.7', centerBore: 87.1 },
  { models: ['e-250', 'e250', 'e-250 econoline'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT225/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  { models: ['e-350', 'e350', 'e-350 econoline'], yearStart: 2004, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 1992-2003 (5x139.7 bolt pattern for E-150)
  { models: ['e-150', 'e150', 'e-150 econoline'], yearStart: 1992, yearEnd: 2003, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  { models: ['e-250', 'e250', 'e-250 econoline'], yearStart: 1992, yearEnd: 2003, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT225/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  { models: ['e-350', 'e350', 'e-350 econoline'], yearStart: 1992, yearEnd: 2003, wheelDiameter: 16, wheelWidth: 7, tireSize: 'LT245/75R16', boltPattern: '8x165.1', centerBore: 116.1 },
  
  // 1975-1991 (Early E-Series - 5x139.7 for E-150)
  { models: ['e-150', 'e150'], yearStart: 1975, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 6.5, tireSize: 'P225/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  { models: ['e-250', 'e250'], yearStart: 1975, yearEnd: 1991, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '7.50-16', boltPattern: '8x165.1', centerBore: 116.1 },
  { models: ['e-350', 'e350'], yearStart: 1975, yearEnd: 1991, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '8.00-16.5', boltPattern: '8x165.1', centerBore: 116.1 },
];

// ============================================================
// FORD BRONCO (2021-2026)
// Bolt: 6x139.7, Center Bore: 93.1mm
// ============================================================
const broncoModernSpecs: ModelSpec[] = [
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 16, wheelWidth: 7, tireSize: '255/70R16', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Base'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/75R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Big Bend'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT265/70R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Black Diamond'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '255/70R18', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Outer Banks'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: 'LT285/70R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Badlands'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: 'LT315/70R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Wildtrak', 'Everglades', 'Heritage', 'Sasquatch'] },
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '37x12.50R17', boltPattern: '6x139.7', centerBore: 93.1, trims: ['Raptor'] },
  // Fallback
  { models: ['bronco'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT265/70R17', boltPattern: '6x139.7', centerBore: 93.1 },
];

// ============================================================
// FORD BRONCO CLASSIC (1966-1996)
// ============================================================
const broncoClassicSpecs: ModelSpec[] = [
  // 1980-1996 (Full-size, 5x139.7)
  { models: ['bronco'], yearStart: 1980, yearEnd: 1996, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P235/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  // 1966-1977 (Early, 5x139.7)
  { models: ['bronco'], yearStart: 1966, yearEnd: 1977, wheelDiameter: 15, wheelWidth: 6, tireSize: '215/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
];

// ============================================================
// FORD BRONCO II (1984-1990)
// ============================================================
const broncoIISpecs: ModelSpec[] = [
  { models: ['bronco ii'], yearStart: 1984, yearEnd: 1990, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/75R15', boltPattern: '5x114.3', centerBore: 70.5 },
];

// ============================================================
// FORD THUNDERBIRD
// ============================================================
const thunderbirdSpecs: ModelSpec[] = [
  // Retro Thunderbird (2002-2005) - 5x108
  { models: ['thunderbird'], yearStart: 2002, yearEnd: 2005, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'P235/50R17', boltPattern: '5x108', centerBore: 63.4 },
  // 10th Gen (1989-1997) - 16" wheels common
  { models: ['thunderbird'], yearStart: 1989, yearEnd: 1997, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16', boltPattern: '5x114.3', centerBore: 70.5 },
  // 9th Gen (1983-1988) - 15" wheels
  { models: ['thunderbird'], yearStart: 1983, yearEnd: 1988, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/65R15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 8th Gen (1980-1982)
  { models: ['thunderbird'], yearStart: 1980, yearEnd: 1982, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 7th Gen (1977-1979)
  { models: ['thunderbird'], yearStart: 1977, yearEnd: 1979, wheelDiameter: 15, wheelWidth: 6, tireSize: 'GR78-15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 6th Gen (1972-1976)
  { models: ['thunderbird'], yearStart: 1972, yearEnd: 1976, wheelDiameter: 15, wheelWidth: 6, tireSize: 'JR78-15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 5th Gen (1967-1971)
  { models: ['thunderbird'], yearStart: 1967, yearEnd: 1971, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '8.15-15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 4th Gen (1964-1966)
  { models: ['thunderbird'], yearStart: 1964, yearEnd: 1966, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '8.15-15', boltPattern: '5x114.3', centerBore: 70.5 },
  // 3rd Gen (1961-1963)
  { models: ['thunderbird'], yearStart: 1961, yearEnd: 1963, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '8.00-14', boltPattern: '5x114.3', centerBore: 70.5 },
  // 2nd Gen (1958-1960)
  { models: ['thunderbird'], yearStart: 1958, yearEnd: 1960, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '8.00-14', boltPattern: '5x114.3', centerBore: 70.5 },
  // 1st Gen (1955-1957)
  { models: ['thunderbird'], yearStart: 1955, yearEnd: 1957, wheelDiameter: 15, wheelWidth: 5, tireSize: '6.70-15', boltPattern: '5x114.3', centerBore: 70.5 },
];

// ============================================================
// FORD TAURUS (1986-2019)
// ============================================================
const taurusSpecs: ModelSpec[] = [
  // 2010-2019 (6th Gen)
  { models: ['taurus'], yearStart: 2010, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: 'P245/55R18', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['taurus'], yearStart: 2010, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 8, tireSize: 'P255/45R19', boltPattern: '5x114.3', centerBore: 70.5, trims: ['SHO', 'Limited'] },
  // 2000-2009
  { models: ['taurus'], yearStart: 2000, yearEnd: 2009, wheelDiameter: 16, wheelWidth: 6.5, tireSize: 'P215/60R16', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['taurus'], yearStart: 2000, yearEnd: 2009, wheelDiameter: 17, wheelWidth: 7, tireSize: 'P225/55R17', boltPattern: '5x114.3', centerBore: 70.5, trims: ['SHO', 'Limited', 'SEL'] },
  // 1986-1999
  { models: ['taurus'], yearStart: 1986, yearEnd: 1999, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/65R15', boltPattern: '5x108', centerBore: 63.4 },
];

// ============================================================
// FORD ESCAPE (2001-2026)
// ============================================================
const escapeSpecs: ModelSpec[] = [
  // 2020-2026 (4th Gen)
  { models: ['escape'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x108', centerBore: 63.4, trims: ['S', 'SE', 'Base'] },
  { models: ['escape'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/60R18', boltPattern: '5x108', centerBore: 63.4, trims: ['SEL', 'Titanium'] },
  { models: ['escape'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '225/55R19', boltPattern: '5x108', centerBore: 63.4, trims: ['ST-Line', 'Platinum'] },
  // 2013-2019 (3rd Gen)
  { models: ['escape'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '235/55R17', boltPattern: '5x108', centerBore: 63.4 },
  // 2008-2012 (2nd Gen)
  { models: ['escape'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 16, wheelWidth: 6.5, tireSize: 'P235/70R16', boltPattern: '5x114.3', centerBore: 70.5 },
  // 2001-2007 (1st Gen)
  { models: ['escape'], yearStart: 2001, yearEnd: 2007, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/70R16', boltPattern: '5x114.3', centerBore: 70.5 },
];

// ============================================================
// FORD FLEX (2009-2019)
// ============================================================
const flexSpecs: ModelSpec[] = [
  { models: ['flex'], yearStart: 2009, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/60R18', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['flex'], yearStart: 2009, yearEnd: 2019, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/50R20', boltPattern: '5x114.3', centerBore: 70.5, trims: ['Limited', 'Titanium'] },
];

// ============================================================
// FORD MAVERICK (2022-2026)
// ============================================================
const maverickSpecs: ModelSpec[] = [
  { models: ['maverick'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x108', centerBore: 63.4, trims: ['XL', 'XLT', 'Base'] },
  { models: ['maverick'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/60R18', boltPattern: '5x108', centerBore: 63.4, trims: ['Lariat', 'Tremor'] },
];

// ============================================================
// FORD MUSTANG (1964-2004) - older records
// Bolt: 5x114.3, Center Bore: 70.5mm
// ============================================================
const mustangOldSpecs: ModelSpec[] = [
  // 1999-2004 (SN95 New Edge)
  { models: ['mustang'], yearStart: 1999, yearEnd: 2004, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P205/65R15', boltPattern: '5x114.3', centerBore: 70.5, trims: ['V6', 'Base', 'Base/V6'] },
  { models: ['mustang'], yearStart: 1999, yearEnd: 2004, wheelDiameter: 17, wheelWidth: 8, tireSize: 'P245/45R17', boltPattern: '5x114.3', centerBore: 70.5, trims: ['GT'] },
  { models: ['mustang'], yearStart: 2003, yearEnd: 2004, wheelDiameter: 17, wheelWidth: 9, tireSize: 'P275/40R17', boltPattern: '5x114.3', centerBore: 70.5, trims: ['Cobra', 'Mach 1', 'SVT Cobra'] },
  
  // 1994-1998 (SN95)
  { models: ['mustang'], yearStart: 1994, yearEnd: 1998, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P205/65R15', boltPattern: '5x114.3', centerBore: 70.5, trims: ['V6', 'Base'] },
  { models: ['mustang'], yearStart: 1994, yearEnd: 1998, wheelDiameter: 17, wheelWidth: 8, tireSize: 'P245/45R17', boltPattern: '5x114.3', centerBore: 70.5, trims: ['GT', 'Cobra'] },
  { models: ['mustang'], yearStart: 1994, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/55R16', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // 1979-1993 (Fox Body)
  { models: ['mustang'], yearStart: 1987, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P225/60R15', boltPattern: '5x114.3', centerBore: 70.5, trims: ['GT', 'LX 5.0', 'Cobra'] },
  { models: ['mustang'], yearStart: 1979, yearEnd: 1993, wheelDiameter: 14, wheelWidth: 6, tireSize: 'P195/75R14', boltPattern: '5x114.3', centerBore: 70.5, trims: ['Base', 'L', 'GL', 'LX'] },
  { models: ['mustang'], yearStart: 1979, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // 1974-1978 (Mustang II)
  { models: ['mustang'], yearStart: 1974, yearEnd: 1978, wheelDiameter: 13, wheelWidth: 5, tireSize: 'BR70-13', boltPattern: '4x108', centerBore: 63.4 },
  
  // 1971-1973 (Mach 1 Era)
  { models: ['mustang'], yearStart: 1971, yearEnd: 1973, wheelDiameter: 14, wheelWidth: 7, tireSize: 'F70-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // 1969-1970 (Boss/Shelby Era)
  { models: ['mustang'], yearStart: 1969, yearEnd: 1970, wheelDiameter: 15, wheelWidth: 7, tireSize: 'F60-15', boltPattern: '5x114.3', centerBore: 70.5, trims: ['Boss 302', 'Boss 429', 'Mach 1', 'Shelby GT500'] },
  { models: ['mustang'], yearStart: 1969, yearEnd: 1970, wheelDiameter: 14, wheelWidth: 6, tireSize: 'E70-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // 1967-1968 (First Gen facelift)
  { models: ['mustang'], yearStart: 1967, yearEnd: 1968, wheelDiameter: 15, wheelWidth: 7, tireSize: 'E70-15', boltPattern: '5x114.3', centerBore: 70.5, trims: ['Shelby GT350', 'Shelby GT500'] },
  { models: ['mustang'], yearStart: 1967, yearEnd: 1968, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '7.35-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // 1964.5-1966 (First Gen)
  { models: ['mustang'], yearStart: 1964, yearEnd: 1966, wheelDiameter: 14, wheelWidth: 5, tireSize: '6.95-14', boltPattern: '5x114.3', centerBore: 70.5 },
];

// ============================================================
// FORD F-150 (for lowercase 'f-150' records)
// Bolt: 6x135, Center Bore: 87.1mm
// ============================================================
const f150Specs: ModelSpec[] = [
  // 2021-2026 (14th Gen)
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['XL', 'Base'] },
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18', boltPattern: '6x135', centerBore: 87.1, trims: ['XLT', 'STX'] },
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/60R20', boltPattern: '6x135', centerBore: 87.1, trims: ['Lariat', 'King Ranch', 'Platinum'] },
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22', boltPattern: '6x135', centerBore: 87.1, trims: ['Limited'] },
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['Raptor'] },
  { models: ['f-150'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18', boltPattern: '6x135', centerBore: 87.1 },
  
  // 2015-2020 (13th Gen)
  { models: ['f-150'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['XL', 'Base'] },
  { models: ['f-150'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18', boltPattern: '6x135', centerBore: 87.1, trims: ['XLT', 'STX'] },
  { models: ['f-150'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20', boltPattern: '6x135', centerBore: 87.1, trims: ['Lariat', 'King Ranch', 'Platinum'] },
  { models: ['f-150'], yearStart: 2017, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['Raptor'] },
  { models: ['f-150'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18', boltPattern: '6x135', centerBore: 87.1 },
  
  // 2009-2014 (12th Gen)
  { models: ['f-150'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['XL', 'Base'] },
  { models: ['f-150'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '275/65R18', boltPattern: '6x135', centerBore: 87.1, trims: ['XLT', 'FX4'] },
  { models: ['f-150'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20', boltPattern: '6x135', centerBore: 87.1, trims: ['Lariat', 'King Ranch', 'Platinum'] },
  { models: ['f-150'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17', boltPattern: '6x135', centerBore: 87.1, trims: ['SVT Raptor', 'Raptor'] },
  { models: ['f-150'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17', boltPattern: '6x135', centerBore: 87.1 },
  
  // 2004-2008 (11th Gen)
  { models: ['f-150'], yearStart: 2004, yearEnd: 2008, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17', boltPattern: '6x135', centerBore: 87.1 },
  
  // 1997-2003 (10th Gen)
  { models: ['f-150'], yearStart: 1997, yearEnd: 2003, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/65R17', boltPattern: '5x135', centerBore: 87.1 },
  
  // 1987-1996 (9th Gen) - 5x139.7
  { models: ['f-150'], yearStart: 1987, yearEnd: 1996, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P235/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  
  // 1980-1986 (8th Gen) - 5x139.7
  { models: ['f-150'], yearStart: 1980, yearEnd: 1986, wheelDiameter: 15, wheelWidth: 6.5, tireSize: 'P235/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  
  // 1975-1979 (7th Gen) - 5x139.7
  { models: ['f-150'], yearStart: 1975, yearEnd: 1979, wheelDiameter: 15, wheelWidth: 6, tireSize: 'L78-15', boltPattern: '5x139.7', centerBore: 87.1 },
];

// ============================================================
// FORD CLASSICS (F-100, Galaxie, LTD, Fairlane, Torino, Falcon)
// Most use 5x114.3 or 5x139.7
// ============================================================
const classicSpecs: ModelSpec[] = [
  // F-100 (1953-1983)
  { models: ['f-100'], yearStart: 1967, yearEnd: 1983, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/75R15', boltPattern: '5x139.7', centerBore: 87.1 },
  { models: ['f-100'], yearStart: 1953, yearEnd: 1966, wheelDiameter: 15, wheelWidth: 5.5, tireSize: '7.50-16', boltPattern: '5x139.7', centerBore: 87.1 },
  
  // Galaxie (1959-1974)
  { models: ['galaxie'], yearStart: 1965, yearEnd: 1974, wheelDiameter: 15, wheelWidth: 6, tireSize: 'F70-15', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['galaxie'], yearStart: 1959, yearEnd: 1964, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '8.00-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // LTD (1965-1986)
  { models: ['ltd'], yearStart: 1979, yearEnd: 1986, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'P195/75R14', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['ltd'], yearStart: 1965, yearEnd: 1978, wheelDiameter: 15, wheelWidth: 6, tireSize: 'F78-15', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Fairlane (1955-1970)
  { models: ['fairlane'], yearStart: 1966, yearEnd: 1970, wheelDiameter: 14, wheelWidth: 6, tireSize: 'E70-14', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['fairlane'], yearStart: 1955, yearEnd: 1965, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '7.35-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Torino (1968-1976)
  { models: ['torino'], yearStart: 1968, yearEnd: 1976, wheelDiameter: 14, wheelWidth: 6, tireSize: 'F70-14', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Falcon (1960-1970)
  { models: ['falcon'], yearStart: 1960, yearEnd: 1970, wheelDiameter: 13, wheelWidth: 5, tireSize: '6.50-13', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Aerostar (1986-1997)
  { models: ['aerostar'], yearStart: 1986, yearEnd: 1997, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Excursion (2000-2005)
  { models: ['excursion'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'LT265/70R17', boltPattern: '8x170', centerBore: 124.9 },
  
  // Transit (2015-2025)
  { models: ['transit'], yearStart: 2015, yearEnd: 2025, wheelDiameter: 16, wheelWidth: 6.5, tireSize: 'LT235/65R16', boltPattern: '5x160', centerBore: 65.1 },
  
  // GT (supercar)
  { models: ['gt'], yearStart: 2005, yearEnd: 2006, wheelDiameter: 18, wheelWidth: 9, tireSize: '235/45R18', boltPattern: '5x114.3', centerBore: 70.5 },
  { models: ['gt'], yearStart: 2017, yearEnd: 2022, wheelDiameter: 20, wheelWidth: 9.5, tireSize: '245/35R20', boltPattern: '5x114.3', centerBore: 70.5 },
  
  // Classic Maverick (1970-1977)
  { models: ['maverick'], yearStart: 1970, yearEnd: 1977, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'E78-14', boltPattern: '5x114.3', centerBore: 70.5 },
];

// Combine all specs
const allSpecs: ModelSpec[] = [
  ...crownVicSpecs,
  ...rangerModernSpecs,
  ...rangerClassicSpecs,
  ...superDutySpecs,
  ...eSeriesSpecs,
  ...broncoModernSpecs,
  ...broncoClassicSpecs,
  ...broncoIISpecs,
  ...thunderbirdSpecs,
  ...taurusSpecs,
  ...escapeSpecs,
  ...flexSpecs,
  ...maverickSpecs,
  ...mustangOldSpecs,
  ...f150Specs,
  ...classicSpecs,
];

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchRecordToSpec(year: number, model: string, displayTrim: string): ModelSpec | null {
  const normalizedModel = model.toLowerCase();
  const normalizedTrim = normalizeTrim(displayTrim);
  
  // Find specs that match the model and year
  const candidates = allSpecs.filter(spec => {
    const modelMatch = spec.models.some(m => normalizedModel.includes(m) || m.includes(normalizedModel));
    const yearMatch = year >= spec.yearStart && year <= spec.yearEnd;
    return modelMatch && yearMatch;
  });
  
  if (candidates.length === 0) return null;
  
  // First, try to match specific trims
  for (const spec of candidates) {
    if (spec.trims) {
      for (const trim of spec.trims) {
        if (normalizedTrim.includes(trim.toLowerCase())) {
          return spec;
        }
      }
    }
  }
  
  // Return the first spec without specific trim requirements (fallback)
  const fallback = candidates.find(s => !s.trims);
  if (fallback) return fallback;
  
  // Otherwise return first match
  return candidates[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN (add --apply to save)' : 'APPLYING CHANGES'}\n`);
  
  // Get all incomplete Ford records
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' 
      AND (quality_tier != 'complete' OR quality_tier IS NULL)
    ORDER BY model, year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} incomplete Ford records\n`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  const modelStats: Map<string, { updated: number, skipped: number }> = new Map();
  
  for (const record of records.rows) {
    const spec = matchRecordToSpec(record.year, record.model, record.display_trim || '');
    
    // Track stats by model
    const modelKey = record.model;
    if (!modelStats.has(modelKey)) {
      modelStats.set(modelKey, { updated: 0, skipped: 0 });
    }
    
    if (!spec) {
      flagged.push(`${record.year} ${record.model} ${record.display_trim || ''}`);
      skipped++;
      modelStats.get(modelKey)!.skipped++;
      continue;
    }
    
    const oemWheelSizes = [{ 
      diameter: spec.wheelDiameter, 
      width: spec.wheelWidth, 
      offset: null, 
      axle: 'square', 
      isStock: true 
    }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.model} ${record.display_trim || ''} → ${spec.wheelDiameter}", ${spec.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = $3, 
            center_bore_mm = $4, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $5
      `, [
        JSON.stringify(oemWheelSizes), 
        JSON.stringify([spec.tireSize]), 
        spec.boltPattern, 
        spec.centerBore, 
        record.id
      ]);
    }
    updated++;
    modelStats.get(modelKey)!.updated++;
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)\n`);
  
  console.log(`--- By Model ---`);
  for (const [model, stats] of [...modelStats.entries()].sort((a, b) => (b[1].updated + b[1].skipped) - (a[1].updated + a[1].skipped))) {
    const total = stats.updated + stats.skipped;
    if (total > 0) {
      console.log(`  ${model}: ${stats.updated}/${total} updated (${stats.skipped} skipped)`);
    }
  }
  
  if (flagged.length > 0) {
    console.log(`\n--- Flagged (no match) ---`);
    flagged.slice(0, 20).forEach(f => console.log(`  ${f}`));
    if (flagged.length > 20) console.log(`  ...and ${flagged.length - 20} more`);
  }
  
  await pool.end();
}

main().catch(console.error);
