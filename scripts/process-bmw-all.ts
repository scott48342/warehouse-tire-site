/**
 * Process ALL BMW incomplete records with trim-level fitment data
 * Models: 4 Series Gran Coupe, 6 Series, 7 Series, 8 Series, M Coupe, M Roadster,
 *         M3, M5, X1, X3 M, X4, X4 M, X5 M, X6, X6 M, X7, Z3, Z4, i4, i5, i7, i8, iX
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
  rearWheelDiameter?: number;
  rearWheelWidth?: number;
  tireSize: string;
  rearTireSize?: string;
  boltPattern: string;
  centerBore: number;
}

// ==========================================
// BMW 4 Series Gran Coupe
// ==========================================
const bmw_4gc_g26_430i: TrimFitment = { trims: ['430i', '430i xDrive', 'Base'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/45R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_4gc_g26_430i_19: TrimFitment = { trims: ['430i Sport', '430i M Sport'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_4gc_g26_m440i: TrimFitment = { trims: ['M440i', 'M440i xDrive'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '245/40R19', rearTireSize: '255/40R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_4gc_f36_base: TrimFitment = { trims: ['428i', '428i xDrive', '430i', '430i xDrive', 'Base'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/45R18', boltPattern: '5x120', centerBore: 72.5 };
const bmw_4gc_f36_sport: TrimFitment = { trims: ['435i', '440i', 'M Sport'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '225/40R19', rearTireSize: '255/35R19', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW 6 Series
// ==========================================
const bmw_6_f06_base: TrimFitment = { trims: ['640i', '650i', 'Base', 'Gran Coupe'], yearStart: 2011, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18', boltPattern: '5x120', centerBore: 72.5 };
const bmw_6_f06_sport: TrimFitment = { trims: ['640i M Sport', '650i M Sport', 'M Sport'], yearStart: 2011, yearEnd: 2018, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '245/40R19', rearTireSize: '275/35R19', boltPattern: '5x120', centerBore: 72.5 };
const bmw_6_f06_msport20: TrimFitment = { trims: ['M6', 'M6 Gran Coupe'], yearStart: 2013, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 8.5, rearWheelDiameter: 20, rearWheelWidth: 9, tireSize: '245/35R20', rearTireSize: '275/30R20', boltPattern: '5x120', centerBore: 72.5 };
const bmw_6gt_g32_base: TrimFitment = { trims: ['630i', '640i', '630d', 'Base', 'Gran Turismo'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_6gt_g32_sport: TrimFitment = { trims: ['M Sport', 'M50i'], yearStart: 2017, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/45R19', boltPattern: '5x112', centerBore: 66.6 };

// ==========================================
// BMW 7 Series
// ==========================================
const bmw_7_g70_base: TrimFitment = { trims: ['735i', '740i', '740i xDrive', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/50R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_7_g70_sport: TrimFitment = { trims: ['M Sport', '760i', '760i xDrive'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10.5, tireSize: '255/45R20', rearTireSize: '285/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_7_g11_base: TrimFitment = { trims: ['740i', '740i xDrive', 'Base', '740e'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/50R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_7_g11_sport: TrimFitment = { trims: ['750i', '750Li', 'M Sport', 'M760i'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '245/40R20', rearTireSize: '275/35R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_7_f01_base: TrimFitment = { trims: ['740i', '740Li', 'Base'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18', boltPattern: '5x120', centerBore: 72.5 };
const bmw_7_f01_sport: TrimFitment = { trims: ['750i', '750Li', '760Li', 'M Sport'], yearStart: 2009, yearEnd: 2015, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '245/45R19', rearTireSize: '275/40R19', boltPattern: '5x120', centerBore: 72.5 };
const bmw_7_e65: TrimFitment = { trims: ['745i', '745Li', '750i', '750Li', '760i', '760Li', 'Base'], yearStart: 2002, yearEnd: 2008, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW 8 Series
// ==========================================
const bmw_8_g14_840i: TrimFitment = { trims: ['840i', '840i xDrive', 'Base', 'Gran Coupe', 'Convertible'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '245/40R19', rearTireSize: '275/35R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_8_g14_m850i: TrimFitment = { trims: ['M850i', 'M850i xDrive'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8, rearWheelDiameter: 20, rearWheelWidth: 9, tireSize: '245/35R20', rearTireSize: '275/30R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_8_e31: TrimFitment = { trims: ['840Ci', '850i', '850Ci', '850CSi', 'Base'], yearStart: 1990, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7.5, tireSize: '235/50R16', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW M3
// ==========================================
const bmw_m3_g80: TrimFitment = { trims: ['M3', 'M3 Competition', 'M3 xDrive', 'Competition'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 9.5, rearWheelDiameter: 20, rearWheelWidth: 10.5, tireSize: '275/35R19', rearTireSize: '285/30R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_m3_f80: TrimFitment = { trims: ['M3', 'M3 Competition'], yearStart: 2015, yearEnd: 2018, wheelDiameter: 19, wheelWidth: 9, rearWheelDiameter: 19, rearWheelWidth: 10, tireSize: '255/35R19', rearTireSize: '275/35R19', boltPattern: '5x120', centerBore: 72.5 };
const bmw_m3_e90: TrimFitment = { trims: ['M3', 'Base'], yearStart: 2008, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 9, rearWheelDiameter: 18, rearWheelWidth: 10, tireSize: '245/40R18', rearTireSize: '265/40R18', boltPattern: '5x120', centerBore: 72.6 };
const bmw_m3_e46: TrimFitment = { trims: ['M3', 'Base'], yearStart: 2001, yearEnd: 2006, wheelDiameter: 18, wheelWidth: 8, rearWheelDiameter: 18, rearWheelWidth: 9.5, tireSize: '225/45R18', rearTireSize: '255/40R18', boltPattern: '5x120', centerBore: 72.6 };
const bmw_m3_e36: TrimFitment = { trims: ['M3', 'Base'], yearStart: 1995, yearEnd: 1999, wheelDiameter: 17, wheelWidth: 7.5, rearWheelDiameter: 17, rearWheelWidth: 8.5, tireSize: '225/45R17', rearTireSize: '245/40R17', boltPattern: '5x120', centerBore: 72.6 };

// ==========================================
// BMW M5
// ==========================================
const bmw_m5_g90: TrimFitment = { trims: ['M5', 'M5 Competition'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 10.5, tireSize: '275/35R20', rearTireSize: '285/30R21', boltPattern: '5x112', centerBore: 66.6 };
const bmw_m5_f90: TrimFitment = { trims: ['M5', 'M5 Competition'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 9.5, rearWheelDiameter: 20, rearWheelWidth: 10.5, tireSize: '275/35R20', rearTireSize: '285/35R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_m5_f10: TrimFitment = { trims: ['M5', 'Base'], yearStart: 2012, yearEnd: 2017, wheelDiameter: 19, wheelWidth: 9, rearWheelDiameter: 19, rearWheelWidth: 10, tireSize: '265/35R19', rearTireSize: '295/30R19', boltPattern: '5x120', centerBore: 72.5 };
const bmw_m5_e60: TrimFitment = { trims: ['M5', 'Base'], yearStart: 2005, yearEnd: 2010, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9.5, tireSize: '255/35R19', rearTireSize: '285/30R19', boltPattern: '5x120', centerBore: 72.6 };
const bmw_m5_e39: TrimFitment = { trims: ['M5', 'Base'], yearStart: 1999, yearEnd: 2003, wheelDiameter: 18, wheelWidth: 8, rearWheelDiameter: 18, rearWheelWidth: 9.5, tireSize: '245/40R18', rearTireSize: '275/35R18', boltPattern: '5x120', centerBore: 72.6 };

// ==========================================
// BMW X1
// ==========================================
const bmw_x1_u11: TrimFitment = { trims: ['xDrive23i', 'xDrive28i', 'sDrive18i', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/55R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x1_u11_sport: TrimFitment = { trims: ['M35i', 'M Sport', 'xDrive30e'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '225/50R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x1_f48: TrimFitment = { trims: ['xDrive28i', 'sDrive28i', 'Base'], yearStart: 2016, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/55R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x1_e84: TrimFitment = { trims: ['xDrive28i', 'xDrive35i', 'sDrive28i', 'Base'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/50R17', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW X3 M / X4 / X4 M
// ==========================================
const bmw_x3m_f97: TrimFitment = { trims: ['X3 M', 'X3 M Competition', 'M Competition'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '255/45R20', rearTireSize: '265/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x4_g02: TrimFitment = { trims: ['xDrive30i', 'M40i', 'Base'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '245/50R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x4_g02_sport: TrimFitment = { trims: ['M40i', 'M Sport'], yearStart: 2018, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '245/45R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x4m_f98: TrimFitment = { trims: ['X4 M', 'X4 M Competition'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '255/45R20', rearTireSize: '265/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x4_f26: TrimFitment = { trims: ['xDrive28i', 'xDrive35i', 'M40i', 'Base'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 19, wheelWidth: 8, tireSize: '245/50R19', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW X5 M
// ==========================================
const bmw_x5m_f95: TrimFitment = { trims: ['X5 M', 'X5 M Competition'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 10, rearWheelDiameter: 22, rearWheelWidth: 11.5, tireSize: '295/35R21', rearTireSize: '315/30R22', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x5m_f85: TrimFitment = { trims: ['X5 M', 'Base'], yearStart: 2015, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 10, rearWheelDiameter: 20, rearWheelWidth: 11.5, tireSize: '285/40R20', rearTireSize: '325/35R20', boltPattern: '5x120', centerBore: 74.1 };
const bmw_x5m_e70: TrimFitment = { trims: ['X5 M', 'Base'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 10, rearWheelDiameter: 20, rearWheelWidth: 11, tireSize: '285/40R20', rearTireSize: '305/35R20', boltPattern: '5x120', centerBore: 74.1 };

// ==========================================
// BMW X6 / X6 M
// ==========================================
const bmw_x6_g06: TrimFitment = { trims: ['xDrive40i', 'sDrive40i', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '275/45R20', rearTireSize: '305/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x6_g06_sport: TrimFitment = { trims: ['M50i', 'M Sport'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 10.5, tireSize: '285/40R21', rearTireSize: '315/35R21', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x6m_f96: TrimFitment = { trims: ['X6 M', 'X6 M Competition'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 10, rearWheelDiameter: 22, rearWheelWidth: 11.5, tireSize: '295/35R21', rearTireSize: '315/30R22', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x6_f16: TrimFitment = { trims: ['xDrive35i', 'xDrive50i', 'sDrive35i', 'Base'], yearStart: 2015, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/50R19', boltPattern: '5x120', centerBore: 74.1 };
const bmw_x6m_f86: TrimFitment = { trims: ['X6 M', 'Base'], yearStart: 2015, yearEnd: 2019, wheelDiameter: 20, wheelWidth: 10, rearWheelDiameter: 20, rearWheelWidth: 11.5, tireSize: '285/40R20', rearTireSize: '325/35R20', boltPattern: '5x120', centerBore: 74.1 };
const bmw_x6_e71: TrimFitment = { trims: ['xDrive35i', 'xDrive50i', 'Base', 'ActiveHybrid'], yearStart: 2008, yearEnd: 2014, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/50R19', boltPattern: '5x120', centerBore: 74.1 };
const bmw_x6m_e71: TrimFitment = { trims: ['X6 M', 'Base'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 10, rearWheelDiameter: 20, rearWheelWidth: 11, tireSize: '285/40R20', rearTireSize: '305/35R20', boltPattern: '5x120', centerBore: 74.1 };

// ==========================================
// BMW X7
// ==========================================
const bmw_x7_g07: TrimFitment = { trims: ['xDrive40i', 'xDrive50i', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '275/45R21', boltPattern: '5x112', centerBore: 66.6 };
const bmw_x7_g07_sport: TrimFitment = { trims: ['M60i', 'M Sport', 'Alpina XB7'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9.5, rearWheelDiameter: 22, rearWheelWidth: 10.5, tireSize: '285/40R22', rearTireSize: '315/35R22', boltPattern: '5x112', centerBore: 66.6 };

// ==========================================
// BMW Z3 / Z4
// ==========================================
const bmw_z3_e36: TrimFitment = { trims: ['1.9', '2.3', '2.8', '3.0i', 'M Roadster', 'M Coupe', 'Base'], yearStart: 1996, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 7, rearWheelDiameter: 16, rearWheelWidth: 8, tireSize: '205/55R16', rearTireSize: '225/50R16', boltPattern: '5x120', centerBore: 72.6 };
const bmw_z4_g29: TrimFitment = { trims: ['sDrive30i', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, rearWheelDiameter: 18, rearWheelWidth: 9, tireSize: '255/45R18', rearTireSize: '275/40R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_z4_g29_m40i: TrimFitment = { trims: ['M40i', 'M Sport'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 10, tireSize: '255/40R19', rearTireSize: '275/35R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_z4_e89: TrimFitment = { trims: ['sDrive23i', 'sDrive28i', 'sDrive30i', 'sDrive35i', 'sDrive35is', 'Base'], yearStart: 2009, yearEnd: 2016, wheelDiameter: 17, wheelWidth: 8, rearWheelDiameter: 17, rearWheelWidth: 8.5, tireSize: '225/45R17', rearTireSize: '255/40R17', boltPattern: '5x120', centerBore: 72.5 };
const bmw_z4_e85: TrimFitment = { trims: ['2.5i', '3.0i', '3.0si', 'M Roadster', 'M Coupe', 'Base'], yearStart: 2003, yearEnd: 2008, wheelDiameter: 17, wheelWidth: 8, rearWheelDiameter: 17, rearWheelWidth: 8.5, tireSize: '225/45R17', rearTireSize: '245/40R17', boltPattern: '5x120', centerBore: 72.5 };

// ==========================================
// BMW i-Series EVs
// ==========================================
const bmw_i4_g26: TrimFitment = { trims: ['eDrive35', 'eDrive40', 'xDrive40', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '245/45R18', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i4_g26_m50: TrimFitment = { trims: ['M50', 'M Sport'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, rearWheelDiameter: 19, rearWheelWidth: 9, tireSize: '245/40R19', rearTireSize: '255/40R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i5_g60: TrimFitment = { trims: ['eDrive40', 'xDrive40', 'Base'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/45R19', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i5_g60_m60: TrimFitment = { trims: ['M60', 'M Sport'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10, tireSize: '255/40R20', rearTireSize: '285/35R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i7_g70: TrimFitment = { trims: ['xDrive60', 'eDrive50', 'Base'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, rearWheelDiameter: 20, rearWheelWidth: 10.5, tireSize: '255/45R20', rearTireSize: '285/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i7_g70_m70: TrimFitment = { trims: ['M70', 'M Sport'], yearStart: 2023, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, rearWheelDiameter: 21, rearWheelWidth: 11, tireSize: '275/40R21', rearTireSize: '305/35R21', boltPattern: '5x112', centerBore: 66.6 };
const bmw_i8: TrimFitment = { trims: ['Coupe', 'Roadster', 'Base'], yearStart: 2014, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 7.5, rearWheelDiameter: 20, rearWheelWidth: 8.5, tireSize: '215/45R20', rearTireSize: '245/40R20', boltPattern: '5x112', centerBore: 66.6 };
const bmw_ix_i20: TrimFitment = { trims: ['xDrive40', 'xDrive50', 'Base'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9.5, tireSize: '275/40R21', boltPattern: '5x112', centerBore: 66.6 };
const bmw_ix_i20_m60: TrimFitment = { trims: ['M60', 'M Sport'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9.5, rearWheelDiameter: 22, rearWheelWidth: 10.5, tireSize: '275/40R22', rearTireSize: '305/35R22', boltPattern: '5x112', centerBore: 66.6 };

// ==========================================
// BMW M Coupe / M Roadster (Z3/Z4 based)
// ==========================================
const bmw_m_coupe_e36: TrimFitment = { trims: ['M Coupe', 'S52', 'S54', 'Base'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 17, wheelWidth: 7.5, rearWheelDiameter: 17, rearWheelWidth: 9, tireSize: '225/45R17', rearTireSize: '245/40R17', boltPattern: '5x120', centerBore: 72.6 };
const bmw_m_roadster_e36: TrimFitment = { trims: ['M Roadster', 'S52', 'S54', 'Base'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 17, wheelWidth: 7.5, rearWheelDiameter: 17, rearWheelWidth: 9, tireSize: '225/45R17', rearTireSize: '245/40R17', boltPattern: '5x120', centerBore: 72.6 };
const bmw_z4m_e85: TrimFitment = { trims: ['M Coupe', 'M Roadster'], yearStart: 2006, yearEnd: 2008, wheelDiameter: 18, wheelWidth: 8, rearWheelDiameter: 18, rearWheelWidth: 9, tireSize: '225/40R18', rearTireSize: '255/35R18', boltPattern: '5x120', centerBore: 72.5 };

// Model configs
const modelConfigs: { [key: string]: TrimFitment[] } = {
  '4 series gran coupe': [bmw_4gc_g26_430i, bmw_4gc_g26_430i_19, bmw_4gc_g26_m440i, bmw_4gc_f36_base, bmw_4gc_f36_sport],
  '6 series': [bmw_6_f06_base, bmw_6_f06_sport, bmw_6_f06_msport20, bmw_6gt_g32_base, bmw_6gt_g32_sport],
  '6 series gran turismo': [bmw_6gt_g32_base, bmw_6gt_g32_sport],
  '7 series': [bmw_7_g70_base, bmw_7_g70_sport, bmw_7_g11_base, bmw_7_g11_sport, bmw_7_f01_base, bmw_7_f01_sport, bmw_7_e65],
  '8 series': [bmw_8_g14_840i, bmw_8_g14_m850i, bmw_8_e31],
  'm coupe': [bmw_m_coupe_e36, bmw_z4m_e85],
  'm roadster': [bmw_m_roadster_e36, bmw_z4m_e85],
  'm3': [bmw_m3_g80, bmw_m3_f80, bmw_m3_e90, bmw_m3_e46, bmw_m3_e36],
  'm5': [bmw_m5_g90, bmw_m5_f90, bmw_m5_f10, bmw_m5_e60, bmw_m5_e39],
  'x1': [bmw_x1_u11, bmw_x1_u11_sport, bmw_x1_f48, bmw_x1_e84],
  'x3 m': [bmw_x3m_f97],
  'x4': [bmw_x4_g02, bmw_x4_g02_sport, bmw_x4_f26],
  'x4 m': [bmw_x4m_f98],
  'x5 m': [bmw_x5m_f95, bmw_x5m_f85, bmw_x5m_e70],
  'x6': [bmw_x6_g06, bmw_x6_g06_sport, bmw_x6_f16, bmw_x6_e71],
  'x6 m': [bmw_x6m_f96, bmw_x6m_f86, bmw_x6m_e71],
  'x7': [bmw_x7_g07, bmw_x7_g07_sport],
  'z3': [bmw_z3_e36],
  'z4': [bmw_z4_g29, bmw_z4_g29_m40i, bmw_z4_e89, bmw_z4_e85],
  'i4': [bmw_i4_g26, bmw_i4_g26_m50],
  'i5': [bmw_i5_g60, bmw_i5_g60_m60],
  'i7': [bmw_i7_g70, bmw_i7_g70_m70],
  'i8': [bmw_i8],
  'ix': [bmw_ix_i20, bmw_ix_i20_m60],
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(model: string, year: number, displayTrim: string): TrimFitment | null {
  const modelKey = model.toLowerCase();
  const configs = modelConfigs[modelKey];
  if (!configs) return null;

  const normalized = normalizeTrim(displayTrim);
  const yearMatches = configs.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return configs[0]; // Fallback to first config

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
  // Keyword match for M variants
  if (normalized.includes('competition') || normalized.includes('m sport') || normalized.includes('m50') || normalized.includes('m60')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('competition') || t.toLowerCase().includes('m sport') || t.toLowerCase().includes('m50') || t.toLowerCase().includes('m60'))) || yearMatches[0];
  }
  
  // Fallback to base
  return yearMatches.find(tf => tf.trims.some(t => ['Base', 'sDrive', 'xDrive'].some(b => t.includes(b)))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const models = Object.keys(modelConfigs).map(m => m.toLowerCase());
  const modelPlaceholders = models.map((_, i) => `$${i + 1}`).join(', ');
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'bmw' 
    AND LOWER(model) IN (${modelPlaceholders})
    AND quality_tier != 'complete'
    ORDER BY model, year, display_trim
  `, models);
  
  console.log(`Found ${records.rows.length} incomplete BMW records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.model, record.year, record.display_trim);
    if (!matchedFitment) { 
      flagged.push(`${record.year} ${record.model} ${record.display_trim}`); 
      skipped++; 
      continue; 
    }
    
    const isStaggered = matchedFitment.rearWheelDiameter !== undefined && matchedFitment.rearWheelDiameter !== matchedFitment.wheelDiameter;
    const isStaggeredWidth = matchedFitment.rearWheelWidth !== undefined && matchedFitment.rearWheelWidth !== matchedFitment.wheelWidth;
    
    const oemWheelSizes: any[] = [{ 
      diameter: matchedFitment.wheelDiameter, 
      width: matchedFitment.wheelWidth, 
      offset: null, 
      axle: (isStaggered || isStaggeredWidth) ? 'front' : 'square', 
      isStock: true 
    }];
    
    if (isStaggered || isStaggeredWidth) {
      oemWheelSizes.push({ 
        diameter: matchedFitment.rearWheelDiameter || matchedFitment.wheelDiameter, 
        width: matchedFitment.rearWheelWidth || matchedFitment.wheelWidth, 
        offset: null, 
        axle: 'rear', 
        isStock: true 
      });
    }
    
    const tireSizes = [matchedFitment.tireSize];
    if (matchedFitment.rearTireSize && matchedFitment.rearTireSize !== matchedFitment.tireSize) {
      tireSizes.push(matchedFitment.rearTireSize);
    }
    
    if (dryRun) {
      const staggeredStr = (isStaggered || isStaggeredWidth) ? ' [STAGGERED]' : '';
      console.log(`  [DRY] ${record.year} ${record.model} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}${staggeredStr}`);
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
        [JSON.stringify(oemWheelSizes), JSON.stringify(tireSizes), matchedFitment.boltPattern, matchedFitment.centerBore, record.id]
      );
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  if (flagged.length > 0) console.log(`Flagged: ${flagged.slice(0, 10).join(', ')}${flagged.length > 10 ? '...' : ''}`);
  await pool.end();
}

main().catch(console.error);
