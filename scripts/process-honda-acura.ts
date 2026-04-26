/**
 * Process Honda/Acura vehicles with trim-level fitment data
 * Models: Civic, Accord, CR-V, Pilot, HR-V, Odyssey, Ridgeline, Passport
 *         MDX, RDX, TLX, ILX, Integra
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
}

interface ModelConfig {
  models: string[];
  boltPattern: string;
  centerBore: number;
  fitments: TrimFitment[];
}

// ================================
// HONDA CIVIC - 5x114.3 (2006+), 4x100 (older)
// ================================
const CIVIC_5LUG: ModelConfig = {
  models: ['civic', 'civic hybrid', 'civic hatchback', 'civic coupe', 'civic sedan'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // 11th Gen (2022-Present)
    { trims: ['LX', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 16, wheelWidth: 7, tireSize: '215/55R16' },
    { trims: ['Sport', 'EX'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/50R17' },
    { trims: ['EX-L', 'Touring', 'Sport Touring'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/40R18' },
    { trims: ['Si'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/40R18' },
    // 10th Gen (2016-2021)
    { trims: ['LX', 'DX', 'Base'], yearStart: 2016, yearEnd: 2021, wheelDiameter: 16, wheelWidth: 7, tireSize: '215/55R16' },
    { trims: ['Sport', 'EX', 'EX-T'], yearStart: 2016, yearEnd: 2021, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/50R17' },
    { trims: ['EX-L', 'Touring'], yearStart: 2016, yearEnd: 2021, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/50R17' },
    { trims: ['Si'], yearStart: 2017, yearEnd: 2021, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/40R18' },
    // 9th Gen (2012-2015)
    { trims: ['LX', 'DX', 'HF', 'Base'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15' },
    { trims: ['EX', 'EX-L'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16' },
    { trims: ['Si'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/45R17' },
    // 8th Gen (2006-2011)
    { trims: ['DX', 'LX', 'VP', 'Base', 'GX'], yearStart: 2006, yearEnd: 2011, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16' },
    { trims: ['EX', 'EX-L'], yearStart: 2006, yearEnd: 2011, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16' },
    { trims: ['Si'], yearStart: 2006, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/45R17' },
  ]
};

// Civic Type R - 5x120 bolt pattern (different!)
const CIVIC_TYPE_R: ModelConfig = {
  models: ['civic type r'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    { trims: ['Type R', 'FL5', 'FK8'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 9.5, tireSize: '265/30R19' },
  ]
};

// Older Civics - 4x100 (2005 and earlier except Si)
const CIVIC_4LUG: ModelConfig = {
  models: ['civic', 'civic coupe', 'civic sedan', 'civic hatchback'],
  boltPattern: '4x100',
  centerBore: 56.1,
  fitments: [
    // 7th Gen (2001-2005) - Most
    { trims: ['LX', 'DX', 'VP', 'EX', 'GX', 'HX', 'Value Package', 'Base'], yearStart: 2001, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/60R15' },
    // 6th Gen (1996-2000)
    { trims: ['CX', 'DX', 'LX', 'EX', 'HX', 'GX', 'Base'], yearStart: 1996, yearEnd: 2000, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/65R14' },
    // 5th Gen (1992-1995)
    { trims: ['CX', 'DX', 'VX', 'LX', 'EX', 'Si', 'Base'], yearStart: 1992, yearEnd: 1995, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/60R14' },
    // Earlier
    { trims: ['DX', 'LX', 'Si', 'Base', 'Standard', 'S', '1500'], yearStart: 1983, yearEnd: 1991, wheelDiameter: 13, wheelWidth: 5, tireSize: '175/70R13' },
  ]
};

// ================================
// HONDA ACCORD - 5x114.3 (all modern), 4x114.3 (older)
// ================================
const ACCORD: ModelConfig = {
  models: ['accord', 'accord hybrid', 'accord coupe', 'accord sedan'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // 11th Gen (2023-Present)
    { trims: ['LX', 'Base'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['EX', 'EX-L'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['Sport', 'Sport-L'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '235/40R19' },
    { trims: ['Touring'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '235/40R19' },
    // 10th Gen (2018-2022)
    { trims: ['LX', 'Base'], yearStart: 2018, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['Sport', 'Sport 2.0T'], yearStart: 2018, yearEnd: 2022, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '235/40R19' },
    { trims: ['EX', 'EX-L'], yearStart: 2018, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['Touring', 'Touring 2.0T'], yearStart: 2018, yearEnd: 2022, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '235/40R19' },
    // 9th Gen (2013-2017)
    { trims: ['LX', 'Base'], yearStart: 2013, yearEnd: 2017, wheelDiameter: 16, wheelWidth: 7, tireSize: '215/60R16' },
    { trims: ['Sport', 'Sport SE'], yearStart: 2013, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' },
    { trims: ['EX', 'EX-L'], yearStart: 2013, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['Touring', 'V6 Touring'], yearStart: 2013, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' },
    // 8th Gen (2008-2012)
    { trims: ['LX', 'LX-P', 'Base'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' },
    { trims: ['EX', 'EX-L', 'SE'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    { trims: ['V6', 'EX V6'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17' },
    // 7th Gen (2003-2007)
    { trims: ['DX', 'LX', 'VP', 'Value Package', 'Base'], yearStart: 2003, yearEnd: 2007, wheelDiameter: 15, wheelWidth: 6.5, tireSize: '205/65R15' },
    { trims: ['EX', 'EX-L', 'SE', 'Special Edition'], yearStart: 2003, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' },
    { trims: ['EX V6', 'V6', 'EX-L V6'], yearStart: 2003, yearEnd: 2007, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/50R17' },
    // 6th Gen (1998-2002)
    { trims: ['DX', 'LX', 'VP', 'Value Package', 'Base'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15' },
    { trims: ['EX', 'EX-L', 'SE'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16' },
    // 5th Gen and earlier
    { trims: ['DX', 'LX', 'EX', 'SE', 'Base', 'Standard'], yearStart: 1990, yearEnd: 1997, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/60R15' },
  ]
};

// ================================
// HONDA CR-V - 5x114.3
// ================================
const CRV: ModelConfig = {
  models: ['cr-v', 'crv', 'cr-v hybrid'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // 6th Gen (2023-Present)
    { trims: ['LX', 'Sport', 'Base'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
    { trims: ['EX', 'EX-L'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    { trims: ['Touring', 'Sport Touring'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/55R19' },
    // 5th Gen (2017-2022)
    { trims: ['LX', 'Base'], yearStart: 2017, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
    { trims: ['EX', 'EX-L'], yearStart: 2017, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    { trims: ['Touring'], yearStart: 2017, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    // 4th Gen (2012-2016)
    { trims: ['LX', 'Base'], yearStart: 2012, yearEnd: 2016, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/70R16' },
    { trims: ['EX', 'EX-L'], yearStart: 2012, yearEnd: 2016, wheelDiameter: 17, wheelWidth: 6.5, tireSize: '225/65R17' },
    { trims: ['Touring', 'SE'], yearStart: 2015, yearEnd: 2016, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/60R18' },
    // 3rd Gen (2007-2011)
    { trims: ['LX', 'Base'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 6.5, tireSize: '225/65R17' },
    { trims: ['EX', 'EX-L'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 6.5, tireSize: '225/65R17' },
    // 2nd Gen (2002-2006)
    { trims: ['LX', 'EX', 'SE', 'Base'], yearStart: 2002, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/65R16' },
    // 1st Gen (1997-2001)
    { trims: ['LX', 'EX', 'SE', 'Base'], yearStart: 1997, yearEnd: 2001, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/70R15' },
  ]
};

// ================================
// HONDA PILOT - 5x114.3 (Gen1), 5x120 (Gen2+)
// ================================
const PILOT_5X114: ModelConfig = {
  models: ['pilot'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 1 (2003-2008)
    { trims: ['LX', 'EX', 'EX-L', 'SE', 'VP', 'Base'], yearStart: 2003, yearEnd: 2008, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '235/70R16' },
    { trims: ['Touring'], yearStart: 2006, yearEnd: 2008, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  ]
};

const PILOT_5X120: ModelConfig = {
  models: ['pilot'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 4 (2023-Present)
    { trims: ['Sport', 'LX', 'Base'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/60R18' },
    { trims: ['EX-L', 'Elite'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8, tireSize: '255/50R20' },
    { trims: ['Touring', 'Black Edition'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8, tireSize: '255/50R20' },
    { trims: ['TrailSport'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18' },
    // Gen 3 (2016-2022)
    { trims: ['LX', 'Base'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
    { trims: ['EX', 'EX-L'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
    { trims: ['Touring', 'Elite', 'Black Edition'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/50R20' },
    // Gen 2 (2009-2015)
    { trims: ['LX', 'Base'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' },
    { trims: ['EX', 'EX-L', 'SE'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/60R18' },
    { trims: ['Touring'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/60R18' },
  ]
};

// ================================
// HONDA HR-V - 5x114.3
// ================================
const HRV: ModelConfig = {
  models: ['hr-v', 'hrv'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // 3rd Gen (2023-Present)
    { trims: ['LX', 'Sport', 'Base'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/55R17' },
    { trims: ['EX', 'EX-L'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/55R17' },
    // 2nd Gen (2019-2022)
    { trims: ['LX', 'Sport', 'Base'], yearStart: 2019, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' },
    { trims: ['EX', 'EX-L', 'Touring'], yearStart: 2019, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' },
    // 1st Gen (2016-2018)
    { trims: ['LX', 'Base'], yearStart: 2016, yearEnd: 2018, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' },
    { trims: ['EX', 'EX-L', 'Navi'], yearStart: 2016, yearEnd: 2018, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' },
  ]
};

// ================================
// HONDA ODYSSEY - 5x114.3 (Gen2), 5x120 (Gen3+)
// ================================
const ODYSSEY_5X114: ModelConfig = {
  models: ['odyssey'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 2 (1999-2004)
    { trims: ['LX', 'EX', 'EX-L', 'Base'], yearStart: 1999, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/65R16' },
    // Gen 1 (1995-1998)
    { trims: ['LX', 'EX', 'Base'], yearStart: 1995, yearEnd: 1998, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/65R15' },
  ]
};

const ODYSSEY_5X120: ModelConfig = {
  models: ['odyssey'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 5 (2018-Present)
    { trims: ['LX', 'Base'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    { trims: ['EX', 'EX-L'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    { trims: ['Touring', 'Elite'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/55R19' },
    // Gen 4 (2011-2017)
    { trims: ['LX', 'Base'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
    { trims: ['EX', 'EX-L', 'SE'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    { trims: ['Touring', 'Elite'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
    // Gen 3 (2005-2010)
    { trims: ['LX', 'Base'], yearStart: 2005, yearEnd: 2010, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/65R16' },
    { trims: ['EX', 'EX-L'], yearStart: 2005, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
    { trims: ['Touring'], yearStart: 2005, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  ]
};

// ================================
// HONDA RIDGELINE - 5x120
// ================================
const RIDGELINE: ModelConfig = {
  models: ['ridgeline'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 2 (2017-Present)
    { trims: ['Sport', 'RTL', 'Base'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
    { trims: ['RTL-T', 'RTL-E', 'Black Edition'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
    { trims: ['TrailSport'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18' },
    // Gen 1 (2006-2014)
    { trims: ['RT', 'RTS', 'RTL', 'RTX', 'Base'], yearStart: 2006, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' },
  ]
};

// ================================
// HONDA PASSPORT - 5x120
// ================================
const PASSPORT: ModelConfig = {
  models: ['passport'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 3 (2019-Present)
    { trims: ['Sport', 'EX-L', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/50R20' },
    { trims: ['Touring', 'Elite'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/50R20' },
    { trims: ['TrailSport'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18' },
  ]
};

// ================================
// ACURA MDX - 5x114.3 (Gen1), 5x120 (Gen2+)
// ================================
const MDX_5X114: ModelConfig = {
  models: ['mdx'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 1 (2001-2006)
    { trims: ['Base', 'Touring', 'Premium'], yearStart: 2001, yearEnd: 2006, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  ]
};

const MDX_5X120: ModelConfig = {
  models: ['mdx'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 4 (2022-Present)
    { trims: ['Base', 'Technology'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '255/55R19' },
    { trims: ['A-Spec', 'Advance'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '265/45R20' },
    { trims: ['Type S'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9, tireSize: '275/40R21' },
    // Gen 3 (2014-2020)
    { trims: ['Base', 'Technology'], yearStart: 2014, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
    { trims: ['A-Spec', 'Advance', 'Entertainment'], yearStart: 2017, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/50R20' },
    // Gen 2 (2007-2013)
    { trims: ['Base', 'Technology'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/55R18' },
    { trims: ['Advance', 'Elite', 'Entertainment'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 19, wheelWidth: 8, tireSize: '255/50R19' },
  ]
};

// ================================
// ACURA RDX - 5x114.3
// ================================
const RDX: ModelConfig = {
  models: ['rdx'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 3 (2019-Present)
    { trims: ['Base', 'Technology'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/55R19' },
    { trims: ['A-Spec', 'Advance', 'PMC Edition'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/45R20' },
    // Gen 2 (2013-2018)
    { trims: ['Base', 'Technology', 'Advance'], yearStart: 2013, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/55R18' },
    // Gen 1 (2007-2012)
    { trims: ['Base', 'Technology'], yearStart: 2007, yearEnd: 2012, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/55R18' },
  ]
};

// ================================
// ACURA TLX - 5x114.3 (Gen1), 5x120 (Gen2)
// ================================
const TLX_5X114: ModelConfig = {
  models: ['tlx'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 1 (2015-2020)
    { trims: ['Base', '2.4'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/55R17' },
    { trims: ['Technology', '3.5', 'V6'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/50R18' },
    { trims: ['A-Spec', 'Advance'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
  ]
};

const TLX_5X120: ModelConfig = {
  models: ['tlx'],
  boltPattern: '5x120',
  centerBore: 64.1,
  fitments: [
    // Gen 2 (2021-Present)
    { trims: ['Base', 'Technology'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' },
    { trims: ['A-Spec', 'Advance'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '255/40R19' },
    { trims: ['Type S'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '255/35R20' },
  ]
};

// ================================
// ACURA ILX - 5x114.3
// ================================
const ILX: ModelConfig = {
  models: ['ilx'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // All years (2013-2022)
    { trims: ['Base', 'Premium', '2.0'], yearStart: 2013, yearEnd: 2022, wheelDiameter: 16, wheelWidth: 7, tireSize: '205/55R16' },
    { trims: ['Technology', 'Dynamic'], yearStart: 2013, yearEnd: 2022, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/45R17' },
    { trims: ['A-Spec', 'Premium A-Spec'], yearStart: 2019, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/40R18' },
  ]
};

// ================================
// ACURA INTEGRA (new 2023+) - 5x114.3
// ================================
const INTEGRA: ModelConfig = {
  models: ['integra'],
  boltPattern: '5x114.3',
  centerBore: 64.1,
  fitments: [
    // Gen 5 (2023-Present)
    { trims: ['Base', 'A-Spec', 'A-Spec Tech'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/50R17' },
    { trims: ['Type S'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 9.5, tireSize: '265/30R19' },
    // Classic Integra (older) - 4x100
  ]
};

// Classic Integra (1986-2001) - 4x100
const INTEGRA_CLASSIC: ModelConfig = {
  models: ['integra'],
  boltPattern: '4x100',
  centerBore: 56.1,
  fitments: [
    { trims: ['LS', 'GS', 'GS-R', 'RS', 'SE', 'Base', 'Special Edition'], yearStart: 1994, yearEnd: 2001, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/55R15' },
    { trims: ['Type R'], yearStart: 1997, yearEnd: 2001, wheelDiameter: 16, wheelWidth: 7, tireSize: '215/45R16' },
    { trims: ['LS', 'RS', 'GS', 'Base'], yearStart: 1990, yearEnd: 1993, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/60R14' },
    { trims: ['LS', 'RS', 'Base'], yearStart: 1986, yearEnd: 1989, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/60R14' },
  ]
};

// All configs to process
const ALL_CONFIGS: ModelConfig[] = [
  // Honda
  CIVIC_5LUG, CIVIC_TYPE_R, CIVIC_4LUG,
  ACCORD,
  CRV,
  PILOT_5X114, PILOT_5X120,
  HRV,
  ODYSSEY_5X114, ODYSSEY_5X120,
  RIDGELINE,
  PASSPORT,
  // Acura
  MDX_5X114, MDX_5X120,
  RDX,
  TLX_5X114, TLX_5X120,
  ILX,
  INTEGRA, INTEGRA_CLASSIC,
];

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findConfigForRecord(make: string, model: string, year: number): ModelConfig | null {
  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase().replace(/-/g, '');
  
  // Check Honda
  if (makeLower === 'honda') {
    // Special case: Civic Type R
    if (modelLower.includes('type r') || modelLower.includes('typer')) {
      if (year >= 2017) return CIVIC_TYPE_R;
    }
    
    // Civic
    if (modelLower.includes('civic')) {
      if (year >= 2006) return CIVIC_5LUG;
      return CIVIC_4LUG;
    }
    
    // Accord
    if (modelLower.includes('accord')) return ACCORD;
    
    // CR-V
    if (modelLower.includes('crv') || modelLower.includes('cr v')) return CRV;
    
    // Pilot
    if (modelLower.includes('pilot')) {
      if (year <= 2008) return PILOT_5X114;
      return PILOT_5X120;
    }
    
    // HR-V
    if (modelLower.includes('hrv') || modelLower.includes('hr v')) return HRV;
    
    // Odyssey
    if (modelLower.includes('odyssey')) {
      if (year <= 2004) return ODYSSEY_5X114;
      return ODYSSEY_5X120;
    }
    
    // Ridgeline
    if (modelLower.includes('ridgeline')) return RIDGELINE;
    
    // Passport
    if (modelLower.includes('passport')) return PASSPORT;
  }
  
  // Check Acura
  if (makeLower === 'acura') {
    // MDX
    if (modelLower.includes('mdx')) {
      if (year <= 2006) return MDX_5X114;
      return MDX_5X120;
    }
    
    // RDX
    if (modelLower.includes('rdx')) return RDX;
    
    // TLX
    if (modelLower.includes('tlx')) {
      if (year <= 2020) return TLX_5X114;
      return TLX_5X120;
    }
    
    // ILX
    if (modelLower.includes('ilx')) return ILX;
    
    // Integra
    if (modelLower.includes('integra')) {
      if (year >= 2023) return INTEGRA;
      return INTEGRA_CLASSIC;
    }
  }
  
  return null;
}

function matchTrimToFitment(config: ModelConfig, year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = config.fitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Exact match
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
  
  // Keyword match
  if (normalized.includes('type s') || normalized.includes('types')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('type s'))) || null;
  }
  if (normalized.includes('type r') || normalized.includes('typer')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('type r'))) || null;
  }
  if (normalized.includes('a spec') || normalized.includes('aspec')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('spec'))) || null;
  }
  if (normalized.includes('touring')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('touring'))) || null;
  }
  if (normalized.includes('elite')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('elite'))) || null;
  }
  if (normalized.includes('trailsport')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('trailsport'))) || null;
  }
  if (normalized.includes('ex l') || normalized.includes('exl')) {
    return yearMatches.find(tf => tf.trims.some(t => ['EX-L', 'EX L'].includes(t))) || null;
  }
  if (normalized.includes('sport')) {
    return yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t).includes('sport'))) || null;
  }
  if (normalized.includes('si')) {
    return yearMatches.find(tf => tf.trims.some(t => t === 'Si')) || null;
  }
  if (normalized.includes('ex')) {
    return yearMatches.find(tf => tf.trims.some(t => t === 'EX')) || null;
  }
  
  // Fallback to base
  return yearMatches.find(tf => tf.trims.some(t => ['LX', 'Base', 'DX', 'Standard'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  // Build list of models to search
  const hondaModels = ['civic', 'civic hybrid', 'civic hatchback', 'civic coupe', 'civic sedan', 'civic type r',
                       'accord', 'accord hybrid', 'accord coupe', 'accord sedan',
                       'cr-v', 'crv', 'cr-v hybrid',
                       'pilot', 'hr-v', 'hrv', 'odyssey', 'ridgeline', 'passport'];
  const acuraModels = ['mdx', 'rdx', 'tlx', 'ilx', 'integra'];
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE (LOWER(make) = 'honda' AND LOWER(model) IN (${hondaModels.map(m => `'${m}'`).join(',')}))
       OR (LOWER(make) = 'acura' AND LOWER(model) IN (${acuraModels.map(m => `'${m}'`).join(',')}))
    ORDER BY make, model, year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  const stats: Record<string, number> = {};
  
  for (const record of records.rows) {
    const config = findConfigForRecord(record.make, record.model, record.year);
    if (!config) {
      flagged.push(`${record.year} ${record.make} ${record.model} - no config`);
      skipped++;
      continue;
    }
    
    const matchedFitment = matchTrimToFitment(config, record.year, record.display_trim);
    if (!matchedFitment) {
      flagged.push(`${record.year} ${record.make} ${record.model} ${record.display_trim}`);
      skipped++;
      continue;
    }
    
    const oemWheelSizes = [{ diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    const key = `${record.make} ${record.model}`;
    stats[key] = (stats[key] || 0) + 1;
    
    if (dryRun) {
      if (updated < 10 || updated % 100 === 0) {
        console.log(`  [DRY] ${record.year} ${record.make} ${record.model} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}, ${config.boltPattern}`);
      }
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
        WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify([matchedFitment.tireSize]), config.boltPattern, config.centerBore, record.id]);
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  console.log('\nBreakdown by model:');
  Object.entries(stats).sort((a,b) => b[1] - a[1]).forEach(([model, count]) => {
    console.log(`  ${model}: ${count}`);
  });
  
  if (flagged.length > 0) {
    console.log(`\nFlagged (${flagged.length}):`);
    flagged.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (flagged.length > 10) console.log(`  ... and ${flagged.length - 10} more`);
  }
  
  await pool.end();
}

main().catch(console.error);
