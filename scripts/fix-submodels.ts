/**
 * Fix submodel field on all Base/NULL records
 * Matches wheel/tire configurations to known trim specs
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TrimSpec {
  wheelDiameter: number;
  wheelWidth?: number;
  tirePattern?: RegExp;
  submodel: string;
}

// Generic specs based on wheel diameter when no specific mapping exists
const GENERIC_SPECS: TrimSpec[] = [
  { wheelDiameter: 15, submodel: 'Base' },
  { wheelDiameter: 16, submodel: 'Base' },
  { wheelDiameter: 17, submodel: 'Standard' },
  { wheelDiameter: 18, submodel: 'Premium' },
  { wheelDiameter: 19, submodel: 'Sport' },
  { wheelDiameter: 20, submodel: 'Luxury' },
  { wheelDiameter: 21, submodel: 'Performance' },
  { wheelDiameter: 22, submodel: 'Flagship' },
];

const TRIM_MAPS: Record<string, Record<string, TrimSpec[]>> = {
  // FORD
  'Ford': {
    'F-150': [
      { wheelDiameter: 17, tirePattern: /315\/70R17|35/, submodel: 'Raptor' },
      { wheelDiameter: 17, submodel: 'XL' },
      { wheelDiameter: 18, tirePattern: /275\/65R18|275\/70R18/, submodel: 'Tremor' },
      { wheelDiameter: 18, submodel: 'XLT' },
      { wheelDiameter: 20, submodel: 'Lariat' },
      { wheelDiameter: 22, submodel: 'Limited' },
    ],
    'F-250': [
      { wheelDiameter: 17, submodel: 'XL' },
      { wheelDiameter: 18, submodel: 'XLT' },
      { wheelDiameter: 20, submodel: 'Lariat' },
    ],
    'F-350': [
      { wheelDiameter: 17, submodel: 'XL' },
      { wheelDiameter: 18, submodel: 'XLT' },
      { wheelDiameter: 20, submodel: 'Lariat' },
    ],
    'Mustang': [
      { wheelDiameter: 17, submodel: 'EcoBoost' },
      { wheelDiameter: 18, submodel: 'GT' },
      { wheelDiameter: 19, submodel: 'GT Performance Pack' },
      { wheelDiameter: 20, submodel: 'Shelby GT500' },
    ],
    'Explorer': [
      { wheelDiameter: 18, tirePattern: /265\/65R18/, submodel: 'Timberline' },
      { wheelDiameter: 18, submodel: 'XLT' },
      { wheelDiameter: 20, submodel: 'Limited' },
      { wheelDiameter: 21, submodel: 'Platinum' },
    ],
    'Bronco': [
      { wheelDiameter: 17, tirePattern: /315\/70R17|35|37/, submodel: 'Sasquatch' },
      { wheelDiameter: 17, tirePattern: /285\/70R17/, submodel: 'Badlands' },
      { wheelDiameter: 17, submodel: 'Big Bend' },
      { wheelDiameter: 16, submodel: 'Base' },
    ],
    'Escape': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SEL' },
      { wheelDiameter: 19, submodel: 'Titanium' },
    ],
    'Expedition': [
      { wheelDiameter: 18, submodel: 'XLT' },
      { wheelDiameter: 20, submodel: 'Limited' },
      { wheelDiameter: 22, submodel: 'Platinum' },
    ],
    'Edge': [
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'SEL' },
      { wheelDiameter: 20, submodel: 'Titanium' },
      { wheelDiameter: 21, submodel: 'ST' },
    ],
    'Ranger': [
      { wheelDiameter: 16, submodel: 'XL' },
      { wheelDiameter: 17, submodel: 'XLT' },
      { wheelDiameter: 18, submodel: 'Lariat' },
    ],
    'Fusion': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 18, submodel: 'Titanium' },
      { wheelDiameter: 19, submodel: 'Sport' },
    ],
    'Focus': [
      { wheelDiameter: 15, submodel: 'S' },
      { wheelDiameter: 16, submodel: 'SE' },
      { wheelDiameter: 17, submodel: 'Titanium' },
      { wheelDiameter: 18, submodel: 'ST' },
      { wheelDiameter: 19, submodel: 'RS' },
    ],
  },
  
  // CHEVROLET
  'Chevrolet': {
    'Silverado 1500': [
      { wheelDiameter: 17, submodel: 'WT' },
      { wheelDiameter: 18, tirePattern: /275\/65R18|275\/70R18/, submodel: 'Trail Boss' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 20, submodel: 'LTZ' },
      { wheelDiameter: 22, submodel: 'High Country' },
    ],
    'Silverado 2500': [
      { wheelDiameter: 17, submodel: 'WT' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 20, submodel: 'LTZ' },
    ],
    'Silverado 3500': [
      { wheelDiameter: 17, submodel: 'WT' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 20, submodel: 'LTZ' },
    ],
    'Tahoe': [
      { wheelDiameter: 18, submodel: 'LS' },
      { wheelDiameter: 20, submodel: 'Z71' },
      { wheelDiameter: 22, submodel: 'High Country' },
    ],
    'Suburban': [
      { wheelDiameter: 18, submodel: 'LS' },
      { wheelDiameter: 20, submodel: 'LT' },
      { wheelDiameter: 22, submodel: 'High Country' },
    ],
    'Camaro': [
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 19, submodel: 'ZL1 1LE' },
      { wheelDiameter: 20, submodel: 'SS' },
    ],
    'Equinox': [
      { wheelDiameter: 17, submodel: 'LS' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 19, submodel: 'RS' },
    ],
    'Traverse': [
      { wheelDiameter: 18, submodel: 'LS' },
      { wheelDiameter: 20, submodel: 'LT' },
      { wheelDiameter: 22, submodel: 'High Country' },
    ],
    'Colorado': [
      { wheelDiameter: 16, submodel: 'WT' },
      { wheelDiameter: 17, submodel: 'LT' },
      { wheelDiameter: 18, submodel: 'ZR2' },
    ],
    'Blazer': [
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 20, submodel: 'RS' },
      { wheelDiameter: 21, submodel: 'Premier' },
    ],
    'Malibu': [
      { wheelDiameter: 16, submodel: 'L' },
      { wheelDiameter: 17, submodel: 'LS' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 19, submodel: 'Premier' },
    ],
    'Impala': [
      { wheelDiameter: 18, submodel: 'LS' },
      { wheelDiameter: 19, submodel: 'LT' },
      { wheelDiameter: 20, submodel: 'Premier' },
    ],
    'Corvette': [
      { wheelDiameter: 19, submodel: 'Stingray' },
      { wheelDiameter: 20, submodel: 'Z06' },
      { wheelDiameter: 21, submodel: 'Z06' },
    ],
    'Trailblazer': [
      { wheelDiameter: 17, submodel: 'LS' },
      { wheelDiameter: 18, submodel: 'LT' },
      { wheelDiameter: 19, submodel: 'RS' },
    ],
    'Spark': [
      { wheelDiameter: 14, submodel: 'LS' },
      { wheelDiameter: 15, submodel: 'LT' },
    ],
    'Bolt': [
      { wheelDiameter: 17, submodel: 'LT' },
    ],
    'Express': [
      { wheelDiameter: 16, submodel: '1500' },
      { wheelDiameter: 16, submodel: '2500' },
      { wheelDiameter: 17, submodel: '3500' },
    ],
  },
  
  // GMC
  'GMC': {
    'Sierra 1500': [
      { wheelDiameter: 17, submodel: 'Pro' },
      { wheelDiameter: 18, tirePattern: /275\/65R18|275\/70R18/, submodel: 'AT4' },
      { wheelDiameter: 18, submodel: 'SLE' },
      { wheelDiameter: 20, submodel: 'SLT' },
      { wheelDiameter: 22, submodel: 'Denali' },
    ],
    'Sierra 2500': [
      { wheelDiameter: 17, submodel: 'Pro' },
      { wheelDiameter: 18, submodel: 'SLE' },
      { wheelDiameter: 20, submodel: 'Denali' },
    ],
    'Sierra 3500': [
      { wheelDiameter: 17, submodel: 'Pro' },
      { wheelDiameter: 18, submodel: 'SLE' },
      { wheelDiameter: 20, submodel: 'Denali' },
    ],
    'Yukon': [
      { wheelDiameter: 18, submodel: 'SLE' },
      { wheelDiameter: 20, submodel: 'AT4' },
      { wheelDiameter: 22, submodel: 'Denali' },
    ],
    'Canyon': [
      { wheelDiameter: 16, submodel: 'Elevation' },
      { wheelDiameter: 17, submodel: 'SLE' },
      { wheelDiameter: 18, submodel: 'AT4' },
    ],
    'Terrain': [
      { wheelDiameter: 17, submodel: 'SLE' },
      { wheelDiameter: 18, submodel: 'SLT' },
      { wheelDiameter: 19, submodel: 'Denali' },
    ],
    'Acadia': [
      { wheelDiameter: 17, submodel: 'SLE' },
      { wheelDiameter: 18, submodel: 'SLT' },
      { wheelDiameter: 20, submodel: 'AT4' },
      { wheelDiameter: 22, submodel: 'Denali' },
    ],
  },
  
  // RAM
  'RAM': {
    '1500': [
      { wheelDiameter: 17, submodel: 'Tradesman' },
      { wheelDiameter: 18, tirePattern: /275\/65R18|275\/70R18|285/, submodel: 'Rebel' },
      { wheelDiameter: 18, submodel: 'Big Horn' },
      { wheelDiameter: 20, submodel: 'Laramie' },
      { wheelDiameter: 22, submodel: 'Limited' },
    ],
    '2500': [
      { wheelDiameter: 17, submodel: 'Tradesman' },
      { wheelDiameter: 18, submodel: 'Big Horn' },
      { wheelDiameter: 20, submodel: 'Laramie' },
    ],
    '3500': [
      { wheelDiameter: 17, submodel: 'Tradesman' },
      { wheelDiameter: 18, submodel: 'Big Horn' },
      { wheelDiameter: 20, submodel: 'Laramie' },
    ],
  },
  
  // DODGE
  'Dodge': {
    'Challenger': [
      { wheelDiameter: 18, submodel: 'SXT' },
      { wheelDiameter: 20, submodel: 'R/T' },
      { wheelDiameter: 20, tirePattern: /275\/40R20/, submodel: 'Scat Pack' },
      { wheelDiameter: 20, tirePattern: /305/, submodel: 'Hellcat' },
    ],
    'Charger': [
      { wheelDiameter: 17, submodel: 'SXT' },
      { wheelDiameter: 18, submodel: 'GT' },
      { wheelDiameter: 20, submodel: 'R/T' },
      { wheelDiameter: 20, tirePattern: /305/, submodel: 'Hellcat' },
    ],
    'Durango': [
      { wheelDiameter: 18, submodel: 'SXT' },
      { wheelDiameter: 20, submodel: 'GT' },
      { wheelDiameter: 20, tirePattern: /295/, submodel: 'SRT' },
    ],
    'Journey': [
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'GT' },
    ],
    'Grand Caravan': [
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 17, submodel: 'SXT' },
    ],
  },
  
  // CHRYSLER
  'Chrysler': {
    '300': [
      { wheelDiameter: 17, submodel: 'Touring' },
      { wheelDiameter: 18, submodel: 'Touring L' },
      { wheelDiameter: 19, submodel: 'Limited' },
      { wheelDiameter: 20, submodel: '300S' },
    ],
    'Pacifica': [
      { wheelDiameter: 17, submodel: 'L' },
      { wheelDiameter: 18, submodel: 'Touring' },
      { wheelDiameter: 20, submodel: 'Limited' },
    ],
    'Town & Country': [
      { wheelDiameter: 17, submodel: 'Touring' },
      { wheelDiameter: 17, submodel: 'Limited' },
    ],
  },
  
  // JEEP
  'Jeep': {
    'Wrangler': [
      { wheelDiameter: 17, tirePattern: /285\/70R17|315|33|35/, submodel: 'Rubicon' },
      { wheelDiameter: 17, submodel: 'Sport' },
      { wheelDiameter: 18, submodel: 'Sahara' },
    ],
    'Grand Cherokee': [
      { wheelDiameter: 17, submodel: 'Laredo' },
      { wheelDiameter: 18, submodel: 'Limited' },
      { wheelDiameter: 20, submodel: 'Overland' },
      { wheelDiameter: 21, submodel: 'Summit' },
    ],
    'Cherokee': [
      { wheelDiameter: 17, submodel: 'Latitude' },
      { wheelDiameter: 18, submodel: 'Limited' },
      { wheelDiameter: 19, submodel: 'Trailhawk' },
    ],
    'Compass': [
      { wheelDiameter: 16, submodel: 'Sport' },
      { wheelDiameter: 17, submodel: 'Latitude' },
      { wheelDiameter: 18, submodel: 'Limited' },
      { wheelDiameter: 19, submodel: 'Trailhawk' },
    ],
    'Renegade': [
      { wheelDiameter: 16, submodel: 'Sport' },
      { wheelDiameter: 17, submodel: 'Latitude' },
      { wheelDiameter: 18, submodel: 'Limited' },
      { wheelDiameter: 19, submodel: 'Trailhawk' },
    ],
    'Gladiator': [
      { wheelDiameter: 17, tirePattern: /285/, submodel: 'Rubicon' },
      { wheelDiameter: 17, submodel: 'Sport' },
      { wheelDiameter: 18, submodel: 'Overland' },
    ],
  },
  
  // TOYOTA
  'Toyota': {
    'Tacoma': [
      { wheelDiameter: 16, submodel: 'SR' },
      { wheelDiameter: 17, tirePattern: /265\/70R17/, submodel: 'TRD Off-Road' },
      { wheelDiameter: 17, submodel: 'SR5' },
      { wheelDiameter: 18, submodel: 'TRD Sport' },
    ],
    'Tundra': [
      { wheelDiameter: 18, submodel: 'SR' },
      { wheelDiameter: 20, submodel: 'SR5' },
      { wheelDiameter: 22, submodel: 'Platinum' },
    ],
    '4Runner': [
      { wheelDiameter: 17, submodel: 'SR5' },
      { wheelDiameter: 18, submodel: 'TRD Off-Road' },
      { wheelDiameter: 20, submodel: 'Limited' },
    ],
    'Camry': [
      { wheelDiameter: 17, submodel: 'LE' },
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'XSE' },
    ],
    'Corolla': [
      { wheelDiameter: 15, submodel: 'L' },
      { wheelDiameter: 16, submodel: 'LE' },
      { wheelDiameter: 18, submodel: 'SE' },
    ],
    'RAV4': [
      { wheelDiameter: 17, submodel: 'LE' },
      { wheelDiameter: 18, submodel: 'XLE' },
      { wheelDiameter: 19, submodel: 'Limited' },
    ],
    'Highlander': [
      { wheelDiameter: 18, submodel: 'LE' },
      { wheelDiameter: 20, submodel: 'XLE' },
    ],
    'Sienna': [
      { wheelDiameter: 17, submodel: 'LE' },
      { wheelDiameter: 18, submodel: 'XLE' },
      { wheelDiameter: 20, submodel: 'Platinum' },
    ],
    'Sequoia': [
      { wheelDiameter: 18, submodel: 'SR5' },
      { wheelDiameter: 20, submodel: 'Limited' },
      { wheelDiameter: 22, submodel: 'Platinum' },
    ],
    'Prius': [
      { wheelDiameter: 15, submodel: 'L Eco' },
      { wheelDiameter: 17, submodel: 'XLE' },
    ],
    'Land Cruiser': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'Heritage Edition' },
    ],
    'Supra': [
      { wheelDiameter: 18, submodel: '2.0' },
      { wheelDiameter: 19, submodel: '3.0' },
    ],
    'GR86': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
  },
  
  // HONDA
  'Honda': {
    'Civic': [
      { wheelDiameter: 16, submodel: 'LX' },
      { wheelDiameter: 17, submodel: 'EX' },
      { wheelDiameter: 18, submodel: 'Sport' },
      { wheelDiameter: 19, submodel: 'Si' },
      { wheelDiameter: 20, submodel: 'Type R' },
    ],
    'Accord': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'EX' },
      { wheelDiameter: 19, submodel: 'Sport' },
    ],
    'CR-V': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'EX' },
      { wheelDiameter: 19, submodel: 'Touring' },
    ],
    'Pilot': [
      { wheelDiameter: 18, submodel: 'LX' },
      { wheelDiameter: 20, submodel: 'EX-L' },
    ],
    'HR-V': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'EX' },
    ],
    'Odyssey': [
      { wheelDiameter: 18, submodel: 'LX' },
      { wheelDiameter: 19, submodel: 'EX-L' },
    ],
    'Ridgeline': [
      { wheelDiameter: 18, submodel: 'Sport' },
      { wheelDiameter: 20, submodel: 'Black Edition' },
    ],
    'Passport': [
      { wheelDiameter: 20, submodel: 'Sport' },
    ],
    'Fit': [
      { wheelDiameter: 15, submodel: 'LX' },
      { wheelDiameter: 16, submodel: 'EX' },
    ],
  },
  
  // ACURA
  'Acura': {
    'MDX': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'Technology' },
      { wheelDiameter: 21, submodel: 'Type S' },
    ],
    'RDX': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'A-Spec' },
    ],
    'TLX': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'A-Spec' },
      { wheelDiameter: 20, submodel: 'Type S' },
    ],
    'ILX': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
    'Integra': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'A-Spec' },
      { wheelDiameter: 19, submodel: 'Type S' },
    ],
  },
  
  // NISSAN
  'Nissan': {
    'Titan': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SV' },
      { wheelDiameter: 20, submodel: 'SL' },
      { wheelDiameter: 22, submodel: 'Platinum Reserve' },
    ],
    'Frontier': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SV' },
      { wheelDiameter: 18, submodel: 'PRO-4X' },
    ],
    'Altima': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SV' },
      { wheelDiameter: 19, submodel: 'SR' },
    ],
    'Maxima': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'SV' },
    ],
    'Sentra': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SV' },
      { wheelDiameter: 18, submodel: 'SR' },
    ],
    'Rogue': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SV' },
      { wheelDiameter: 19, submodel: 'SL' },
    ],
    'Pathfinder': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SL' },
    ],
    'Murano': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SL' },
    ],
    'Armada': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SL' },
      { wheelDiameter: 22, submodel: 'Platinum' },
    ],
    '370Z': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'Sport' },
    ],
    'GT-R': [
      { wheelDiameter: 20, submodel: 'Premium' },
    ],
  },
  
  // HYUNDAI
  'Hyundai': {
    'Sonata': [
      { wheelDiameter: 16, submodel: 'SE' },
      { wheelDiameter: 17, submodel: 'SEL' },
      { wheelDiameter: 18, submodel: 'Limited' },
      { wheelDiameter: 19, submodel: 'N Line' },
    ],
    'Elantra': [
      { wheelDiameter: 15, submodel: 'SE' },
      { wheelDiameter: 16, submodel: 'SEL' },
      { wheelDiameter: 17, submodel: 'Limited' },
      { wheelDiameter: 18, submodel: 'N Line' },
      { wheelDiameter: 19, submodel: 'N' },
    ],
    'Tucson': [
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 18, submodel: 'SEL' },
      { wheelDiameter: 19, submodel: 'Limited' },
    ],
    'Santa Fe': [
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 18, submodel: 'SEL' },
      { wheelDiameter: 19, submodel: 'Calligraphy' },
      { wheelDiameter: 20, submodel: 'Limited' },
    ],
    'Palisade': [
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'Calligraphy' },
    ],
    'Kona': [
      { wheelDiameter: 16, submodel: 'SE' },
      { wheelDiameter: 17, submodel: 'SEL' },
      { wheelDiameter: 18, submodel: 'Limited' },
    ],
    'Venue': [
      { wheelDiameter: 15, submodel: 'SE' },
      { wheelDiameter: 17, submodel: 'SEL' },
    ],
    'Santa Cruz': [
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'Limited' },
    ],
    'Ioniq 5': [
      { wheelDiameter: 19, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'Limited' },
    ],
  },
  
  // KIA
  'Kia': {
    'Sorento': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'EX' },
      { wheelDiameter: 20, submodel: 'SX' },
    ],
    'Telluride': [
      { wheelDiameter: 18, submodel: 'LX' },
      { wheelDiameter: 20, submodel: 'SX' },
    ],
    'Sportage': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'EX' },
      { wheelDiameter: 19, submodel: 'SX' },
    ],
    'Optima': [
      { wheelDiameter: 16, submodel: 'LX' },
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SX' },
    ],
    'K5': [
      { wheelDiameter: 16, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'GT-Line' },
      { wheelDiameter: 19, submodel: 'GT' },
    ],
    'Forte': [
      { wheelDiameter: 15, submodel: 'FE' },
      { wheelDiameter: 16, submodel: 'LXS' },
      { wheelDiameter: 17, submodel: 'GT-Line' },
      { wheelDiameter: 18, submodel: 'GT' },
    ],
    'Seltos': [
      { wheelDiameter: 17, submodel: 'LX' },
      { wheelDiameter: 18, submodel: 'SX' },
    ],
    'Carnival': [
      { wheelDiameter: 18, submodel: 'LX' },
      { wheelDiameter: 19, submodel: 'SX' },
    ],
    'Stinger': [
      { wheelDiameter: 18, submodel: 'GT-Line' },
      { wheelDiameter: 19, submodel: 'GT' },
    ],
    'EV6': [
      { wheelDiameter: 19, submodel: 'Wind' },
      { wheelDiameter: 20, submodel: 'GT-Line' },
      { wheelDiameter: 21, submodel: 'GT' },
    ],
  },
  
  // SUBARU
  'Subaru': {
    'WRX': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'STI' },
    ],
    'Outback': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 20, submodel: 'Onyx Edition' },
    ],
    'Forester': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
    'Crosstrek': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Limited' },
    ],
    'Impreza': [
      { wheelDiameter: 16, submodel: 'Base' },
      { wheelDiameter: 17, submodel: 'Premium' },
      { wheelDiameter: 18, submodel: 'Sport' },
    ],
    'Legacy': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
    'Ascent': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'Touring' },
    ],
    'BRZ': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Limited' },
    ],
  },
  
  // MAZDA
  'Mazda': {
    'Mazda3': [
      { wheelDiameter: 16, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
    'Mazda6': [
      { wheelDiameter: 17, submodel: 'Sport' },
      { wheelDiameter: 19, submodel: 'Grand Touring' },
    ],
    'CX-5': [
      { wheelDiameter: 17, submodel: 'Sport' },
      { wheelDiameter: 19, submodel: 'Grand Touring' },
    ],
    'CX-9': [
      { wheelDiameter: 18, submodel: 'Sport' },
      { wheelDiameter: 20, submodel: 'Signature' },
    ],
    'CX-30': [
      { wheelDiameter: 16, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
    ],
    'CX-50': [
      { wheelDiameter: 17, submodel: 'Select' },
      { wheelDiameter: 18, submodel: 'Turbo' },
    ],
    'MX-5 Miata': [
      { wheelDiameter: 16, submodel: 'Sport' },
      { wheelDiameter: 17, submodel: 'Grand Touring' },
    ],
  },
  
  // VOLKSWAGEN
  'Volkswagen': {
    'Jetta': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 18, submodel: 'R-Line' },
      { wheelDiameter: 19, submodel: 'GLI' },
    ],
    'Passat': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'R-Line' },
    ],
    'Tiguan': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'R-Line' },
    ],
    'Atlas': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SE' },
      { wheelDiameter: 21, submodel: 'SEL' },
    ],
    'Golf': [
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'SE' },
      { wheelDiameter: 18, submodel: 'GTI' },
      { wheelDiameter: 19, submodel: 'R' },
    ],
    'Arteon': [
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'SEL' },
      { wheelDiameter: 20, submodel: 'R-Line' },
    ],
    'ID.4': [
      { wheelDiameter: 19, submodel: 'Standard' },
      { wheelDiameter: 20, submodel: 'Pro' },
      { wheelDiameter: 21, submodel: 'Pro S' },
    ],
  },
  
  // BMW
  'BMW': {
    '3 Series': [
      { wheelDiameter: 17, submodel: '330i' },
      { wheelDiameter: 18, submodel: '330i M Sport' },
      { wheelDiameter: 19, submodel: 'M340i' },
    ],
    '4 Series': [
      { wheelDiameter: 18, submodel: '430i' },
      { wheelDiameter: 19, submodel: 'M440i' },
    ],
    '5 Series': [
      { wheelDiameter: 17, submodel: '530i' },
      { wheelDiameter: 18, submodel: '530i M Sport' },
      { wheelDiameter: 19, submodel: '540i' },
      { wheelDiameter: 20, submodel: 'M550i' },
    ],
    '7 Series': [
      { wheelDiameter: 19, submodel: '740i' },
      { wheelDiameter: 20, submodel: '750i' },
      { wheelDiameter: 21, submodel: 'M760i' },
    ],
    'X1': [
      { wheelDiameter: 17, submodel: 'sDrive28i' },
      { wheelDiameter: 18, submodel: 'xDrive28i' },
      { wheelDiameter: 19, submodel: 'M35i' },
    ],
    'X3': [
      { wheelDiameter: 18, submodel: 'xDrive30i' },
      { wheelDiameter: 19, submodel: 'M40i' },
      { wheelDiameter: 21, submodel: 'X3 M' },
    ],
    'X5': [
      { wheelDiameter: 19, submodel: 'xDrive40i' },
      { wheelDiameter: 21, submodel: 'xDrive50e' },
      { wheelDiameter: 22, submodel: 'X5 M' },
    ],
    'X7': [
      { wheelDiameter: 20, submodel: 'xDrive40i' },
      { wheelDiameter: 21, submodel: 'xDrive60e' },
      { wheelDiameter: 22, submodel: 'Alpina XB7' },
    ],
    'M3': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'Competition' },
      { wheelDiameter: 20, submodel: 'Competition' },
    ],
    'M4': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'Competition' },
      { wheelDiameter: 20, submodel: 'Competition' },
    ],
    'Z4': [
      { wheelDiameter: 18, submodel: 'sDrive30i' },
      { wheelDiameter: 19, submodel: 'M40i' },
    ],
  },
  
  // MERCEDES-BENZ
  'Mercedes-Benz': {
    'C-Class': [
      { wheelDiameter: 17, submodel: 'C 300' },
      { wheelDiameter: 18, submodel: 'C 300 AMG Line' },
      { wheelDiameter: 19, submodel: 'AMG C 43' },
      { wheelDiameter: 20, submodel: 'AMG C 63' },
    ],
    'E-Class': [
      { wheelDiameter: 18, submodel: 'E 350' },
      { wheelDiameter: 19, submodel: 'E 450' },
      { wheelDiameter: 20, submodel: 'AMG E 53' },
    ],
    'S-Class': [
      { wheelDiameter: 19, submodel: 'S 500' },
      { wheelDiameter: 20, submodel: 'S 580' },
      { wheelDiameter: 21, submodel: 'AMG S 63' },
    ],
    'GLA': [
      { wheelDiameter: 18, submodel: 'GLA 250' },
      { wheelDiameter: 19, submodel: 'AMG GLA 35' },
      { wheelDiameter: 20, submodel: 'AMG GLA 45' },
    ],
    'GLC': [
      { wheelDiameter: 18, submodel: 'GLC 300' },
      { wheelDiameter: 19, submodel: 'GLC 300 AMG Line' },
      { wheelDiameter: 20, submodel: 'AMG GLC 43' },
      { wheelDiameter: 21, submodel: 'AMG GLC 63' },
    ],
    'GLE': [
      { wheelDiameter: 19, submodel: 'GLE 350' },
      { wheelDiameter: 20, submodel: 'GLE 450' },
      { wheelDiameter: 21, submodel: 'AMG GLE 53' },
      { wheelDiameter: 22, submodel: 'AMG GLE 63' },
    ],
    'GLS': [
      { wheelDiameter: 20, submodel: 'GLS 450' },
      { wheelDiameter: 21, submodel: 'GLS 580' },
      { wheelDiameter: 22, submodel: 'Maybach GLS 600' },
      { wheelDiameter: 23, submodel: 'AMG GLS 63' },
    ],
    'CLA': [
      { wheelDiameter: 17, submodel: 'CLA 250' },
      { wheelDiameter: 18, submodel: 'CLA 250 AMG Line' },
      { wheelDiameter: 19, submodel: 'AMG CLA 35' },
      { wheelDiameter: 20, submodel: 'AMG CLA 45' },
    ],
    'A-Class': [
      { wheelDiameter: 17, submodel: 'A 220' },
      { wheelDiameter: 18, submodel: 'A 220 AMG Line' },
      { wheelDiameter: 19, submodel: 'AMG A 35' },
    ],
    'G-Class': [
      { wheelDiameter: 18, submodel: 'G 550' },
      { wheelDiameter: 20, submodel: 'G 550' },
      { wheelDiameter: 22, submodel: 'AMG G 63' },
    ],
    'SL-Class': [
      { wheelDiameter: 19, submodel: 'SL 55' },
      { wheelDiameter: 20, submodel: 'SL 63' },
      { wheelDiameter: 21, submodel: 'SL 63' },
    ],
  },
  
  // AUDI
  'Audi': {
    'A3': [
      { wheelDiameter: 17, submodel: 'Premium' },
      { wheelDiameter: 18, submodel: 'Premium Plus' },
      { wheelDiameter: 19, submodel: 'S3' },
    ],
    'A4': [
      { wheelDiameter: 17, submodel: 'Premium' },
      { wheelDiameter: 18, submodel: 'Premium Plus' },
      { wheelDiameter: 19, submodel: 'Prestige' },
    ],
    'A5': [
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'Prestige' },
    ],
    'A6': [
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'Premium Plus' },
      { wheelDiameter: 20, submodel: 'Prestige' },
    ],
    'A7': [
      { wheelDiameter: 19, submodel: 'Premium' },
      { wheelDiameter: 20, submodel: 'Prestige' },
      { wheelDiameter: 21, submodel: 'S7' },
    ],
    'A8': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'L' },
      { wheelDiameter: 21, submodel: 'S8' },
    ],
    'Q3': [
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'Premium Plus' },
    ],
    'Q5': [
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'Premium Plus' },
      { wheelDiameter: 20, submodel: 'SQ5' },
    ],
    'Q7': [
      { wheelDiameter: 19, submodel: 'Premium' },
      { wheelDiameter: 20, submodel: 'Premium Plus' },
      { wheelDiameter: 21, submodel: 'Prestige' },
      { wheelDiameter: 22, submodel: 'SQ7' },
    ],
    'Q8': [
      { wheelDiameter: 21, submodel: 'Premium' },
      { wheelDiameter: 22, submodel: 'Prestige' },
      { wheelDiameter: 23, submodel: 'RS Q8' },
    ],
    'e-tron': [
      { wheelDiameter: 20, submodel: 'Premium' },
      { wheelDiameter: 21, submodel: 'Prestige' },
      { wheelDiameter: 22, submodel: 'S' },
    ],
    'TT': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'RS' },
    ],
    'R8': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'Performance' },
    ],
  },
  
  // PORSCHE
  'Porsche': {
    '911': [
      { wheelDiameter: 19, submodel: 'Carrera' },
      { wheelDiameter: 20, submodel: 'Carrera S' },
      { wheelDiameter: 21, submodel: 'GT3' },
    ],
    'Cayenne': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: 'S' },
      { wheelDiameter: 21, submodel: 'GTS' },
      { wheelDiameter: 22, submodel: 'Turbo' },
    ],
    'Macan': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'GTS' },
      { wheelDiameter: 21, submodel: 'Turbo' },
    ],
    'Panamera': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: '4S' },
      { wheelDiameter: 21, submodel: 'GTS' },
      { wheelDiameter: 22, submodel: 'Turbo' },
    ],
    'Taycan': [
      { wheelDiameter: 19, submodel: 'Base' },
      { wheelDiameter: 20, submodel: '4S' },
      { wheelDiameter: 21, submodel: 'Turbo' },
    ],
    'Boxster': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'GTS' },
    ],
    'Cayman': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'GT4' },
    ],
  },
  
  // BUICK
  'Buick': {
    'Encore': [
      { wheelDiameter: 16, submodel: 'Preferred' },
      { wheelDiameter: 18, submodel: 'Essence' },
    ],
    'Encore GX': [
      { wheelDiameter: 17, submodel: 'Preferred' },
      { wheelDiameter: 18, submodel: 'Essence' },
    ],
    'Envision': [
      { wheelDiameter: 18, submodel: 'Preferred' },
      { wheelDiameter: 20, submodel: 'Avenir' },
    ],
    'Enclave': [
      { wheelDiameter: 18, submodel: 'Preferred' },
      { wheelDiameter: 20, submodel: 'Essence' },
      { wheelDiameter: 22, submodel: 'Avenir' },
    ],
    'LaCrosse': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Essence' },
      { wheelDiameter: 19, submodel: 'Avenir' },
    ],
    'Regal': [
      { wheelDiameter: 17, submodel: 'Preferred' },
      { wheelDiameter: 18, submodel: 'Essence' },
      { wheelDiameter: 19, submodel: 'GS' },
    ],
  },
  
  // CADILLAC
  'Cadillac': {
    'CT4': [
      { wheelDiameter: 17, submodel: 'Luxury' },
      { wheelDiameter: 18, submodel: 'Premium Luxury' },
      { wheelDiameter: 19, submodel: 'V' },
    ],
    'CT5': [
      { wheelDiameter: 18, submodel: 'Luxury' },
      { wheelDiameter: 19, submodel: 'Premium Luxury' },
      { wheelDiameter: 19, submodel: 'V' },
    ],
    'XT4': [
      { wheelDiameter: 18, submodel: 'Luxury' },
      { wheelDiameter: 20, submodel: 'Sport' },
    ],
    'XT5': [
      { wheelDiameter: 18, submodel: 'Luxury' },
      { wheelDiameter: 20, submodel: 'Premium Luxury' },
    ],
    'XT6': [
      { wheelDiameter: 18, submodel: 'Luxury' },
      { wheelDiameter: 20, submodel: 'Premium Luxury' },
      { wheelDiameter: 21, submodel: 'Sport' },
    ],
    'Escalade': [
      { wheelDiameter: 22, submodel: 'Luxury' },
      { wheelDiameter: 24, submodel: 'Premium Luxury' },
    ],
    'CTS': [
      { wheelDiameter: 17, submodel: 'Luxury' },
      { wheelDiameter: 18, submodel: 'Premium Luxury' },
      { wheelDiameter: 19, submodel: 'V-Sport' },
      { wheelDiameter: 19, submodel: 'V' },
    ],
    'ATS': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Premium' },
      { wheelDiameter: 19, submodel: 'V' },
    ],
  },
  
  // LINCOLN
  'Lincoln': {
    'Corsair': [
      { wheelDiameter: 18, submodel: 'Standard' },
      { wheelDiameter: 20, submodel: 'Reserve' },
    ],
    'Nautilus': [
      { wheelDiameter: 18, submodel: 'Standard' },
      { wheelDiameter: 20, submodel: 'Reserve' },
    ],
    'Aviator': [
      { wheelDiameter: 20, submodel: 'Standard' },
      { wheelDiameter: 22, submodel: 'Reserve' },
    ],
    'Navigator': [
      { wheelDiameter: 20, submodel: 'Standard' },
      { wheelDiameter: 22, submodel: 'Reserve' },
    ],
    'MKZ': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'Select' },
      { wheelDiameter: 19, submodel: 'Reserve' },
    ],
    'Continental': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'Select' },
      { wheelDiameter: 20, submodel: 'Reserve' },
    ],
  },
  
  // INFINITI
  'Infiniti': {
    'Q50': [
      { wheelDiameter: 17, submodel: 'Pure' },
      { wheelDiameter: 18, submodel: 'Luxe' },
      { wheelDiameter: 19, submodel: 'Red Sport 400' },
    ],
    'Q60': [
      { wheelDiameter: 19, submodel: 'Luxe' },
      { wheelDiameter: 20, submodel: 'Red Sport 400' },
    ],
    'QX50': [
      { wheelDiameter: 19, submodel: 'Pure' },
      { wheelDiameter: 20, submodel: 'Sensory' },
    ],
    'QX55': [
      { wheelDiameter: 20, submodel: 'Luxe' },
    ],
    'QX60': [
      { wheelDiameter: 18, submodel: 'Pure' },
      { wheelDiameter: 20, submodel: 'Luxe' },
    ],
    'QX80': [
      { wheelDiameter: 20, submodel: 'Luxe' },
      { wheelDiameter: 22, submodel: 'Sensory' },
    ],
  },
  
  // LEXUS
  'Lexus': {
    'IS': [
      { wheelDiameter: 17, submodel: 'IS 300' },
      { wheelDiameter: 18, submodel: 'IS 350' },
      { wheelDiameter: 19, submodel: 'IS 500' },
    ],
    'ES': [
      { wheelDiameter: 17, submodel: 'ES 250' },
      { wheelDiameter: 18, submodel: 'ES 350' },
    ],
    'GS': [
      { wheelDiameter: 17, submodel: 'GS 300' },
      { wheelDiameter: 18, submodel: 'GS 350' },
      { wheelDiameter: 19, submodel: 'GS F' },
    ],
    'LS': [
      { wheelDiameter: 19, submodel: 'LS 500' },
      { wheelDiameter: 20, submodel: 'LS 500h' },
    ],
    'NX': [
      { wheelDiameter: 18, submodel: 'NX 250' },
      { wheelDiameter: 20, submodel: 'NX 350' },
    ],
    'RX': [
      { wheelDiameter: 18, submodel: 'RX 350' },
      { wheelDiameter: 20, submodel: 'RX 350L' },
      { wheelDiameter: 21, submodel: 'RX 500h' },
    ],
    'GX': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'Premium' },
    ],
    'LX': [
      { wheelDiameter: 20, submodel: 'Base' },
      { wheelDiameter: 22, submodel: 'Ultra Luxury' },
    ],
    'LC': [
      { wheelDiameter: 20, submodel: 'LC 500' },
      { wheelDiameter: 21, submodel: 'LC 500' },
    ],
    'RC': [
      { wheelDiameter: 18, submodel: 'RC 300' },
      { wheelDiameter: 19, submodel: 'RC 350' },
      { wheelDiameter: 19, submodel: 'RC F' },
    ],
    'UX': [
      { wheelDiameter: 17, submodel: 'UX 200' },
      { wheelDiameter: 18, submodel: 'UX 250h' },
    ],
  },
  
  // VOLVO
  'Volvo': {
    'S60': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'R-Design' },
    ],
    'S90': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'Inscription' },
      { wheelDiameter: 20, submodel: 'R-Design' },
    ],
    'V60': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'Cross Country' },
    ],
    'V90': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'Cross Country' },
      { wheelDiameter: 20, submodel: 'R-Design' },
    ],
    'XC40': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'R-Design' },
      { wheelDiameter: 20, submodel: 'Inscription' },
    ],
    'XC60': [
      { wheelDiameter: 18, submodel: 'Momentum' },
      { wheelDiameter: 19, submodel: 'R-Design' },
      { wheelDiameter: 21, submodel: 'Polestar' },
    ],
    'XC90': [
      { wheelDiameter: 19, submodel: 'Momentum' },
      { wheelDiameter: 20, submodel: 'R-Design' },
      { wheelDiameter: 21, submodel: 'Inscription' },
      { wheelDiameter: 22, submodel: 'Excellence' },
    ],
  },
  
  // LAND ROVER
  'Land Rover': {
    'Range Rover': [
      { wheelDiameter: 21, submodel: 'SE' },
      { wheelDiameter: 22, submodel: 'HSE' },
      { wheelDiameter: 23, submodel: 'Autobiography' },
    ],
    'Range Rover Sport': [
      { wheelDiameter: 20, submodel: 'SE' },
      { wheelDiameter: 21, submodel: 'HSE' },
      { wheelDiameter: 22, submodel: 'Autobiography' },
      { wheelDiameter: 23, submodel: 'SVR' },
    ],
    'Range Rover Velar': [
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SE' },
      { wheelDiameter: 21, submodel: 'HSE' },
      { wheelDiameter: 22, submodel: 'R-Dynamic' },
    ],
    'Range Rover Evoque': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'R-Dynamic' },
      { wheelDiameter: 21, submodel: 'First Edition' },
    ],
    'Discovery': [
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SE' },
      { wheelDiameter: 21, submodel: 'HSE' },
      { wheelDiameter: 22, submodel: 'HSE Luxury' },
    ],
    'Discovery Sport': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'R-Dynamic' },
    ],
    'Defender': [
      { wheelDiameter: 18, submodel: '90' },
      { wheelDiameter: 19, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'X' },
      { wheelDiameter: 22, submodel: 'V8' },
    ],
  },
  
  // JAGUAR
  'Jaguar': {
    'XE': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'R-Dynamic' },
    ],
    'XF': [
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'SE' },
      { wheelDiameter: 20, submodel: 'R-Dynamic' },
    ],
    'XJ': [
      { wheelDiameter: 19, submodel: 'Luxury' },
      { wheelDiameter: 20, submodel: 'Portfolio' },
    ],
    'F-Pace': [
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'SE' },
      { wheelDiameter: 21, submodel: 'R-Dynamic' },
      { wheelDiameter: 22, submodel: 'SVR' },
    ],
    'E-Pace': [
      { wheelDiameter: 17, submodel: 'S' },
      { wheelDiameter: 18, submodel: 'SE' },
      { wheelDiameter: 19, submodel: 'R-Dynamic' },
      { wheelDiameter: 20, submodel: 'First Edition' },
    ],
    'I-Pace': [
      { wheelDiameter: 20, submodel: 'S' },
      { wheelDiameter: 22, submodel: 'HSE' },
    ],
    'F-Type': [
      { wheelDiameter: 18, submodel: 'Base' },
      { wheelDiameter: 19, submodel: 'S' },
      { wheelDiameter: 20, submodel: 'R' },
    ],
  },
  
  // MINI
  'Mini': {
    'Cooper': [
      { wheelDiameter: 15, submodel: 'Base' },
      { wheelDiameter: 16, submodel: 'S' },
      { wheelDiameter: 17, submodel: 'JCW' },
    ],
    'Countryman': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'JCW' },
    ],
    'Clubman': [
      { wheelDiameter: 17, submodel: 'Base' },
      { wheelDiameter: 18, submodel: 'S' },
      { wheelDiameter: 19, submodel: 'JCW' },
    ],
  },
  
  // ALFA ROMEO
  'Alfa Romeo': {
    'Giulia': [
      { wheelDiameter: 17, submodel: 'Sprint' },
      { wheelDiameter: 18, submodel: 'Ti' },
      { wheelDiameter: 19, submodel: 'Veloce' },
      { wheelDiameter: 19, submodel: 'Quadrifoglio' },
    ],
    'Stelvio': [
      { wheelDiameter: 18, submodel: 'Sprint' },
      { wheelDiameter: 19, submodel: 'Ti' },
      { wheelDiameter: 20, submodel: 'Veloce' },
      { wheelDiameter: 21, submodel: 'Quadrifoglio' },
    ],
  },
  
  // GENESIS
  'Genesis': {
    'G70': [
      { wheelDiameter: 18, submodel: '2.0T' },
      { wheelDiameter: 19, submodel: '3.3T' },
    ],
    'G80': [
      { wheelDiameter: 18, submodel: '2.5T' },
      { wheelDiameter: 19, submodel: '3.5T' },
      { wheelDiameter: 20, submodel: 'Sport' },
    ],
    'G90': [
      { wheelDiameter: 19, submodel: '3.3T' },
      { wheelDiameter: 20, submodel: '5.0' },
    ],
    'GV70': [
      { wheelDiameter: 18, submodel: '2.5T' },
      { wheelDiameter: 19, submodel: '3.5T' },
      { wheelDiameter: 21, submodel: 'Sport Prestige' },
    ],
    'GV80': [
      { wheelDiameter: 19, submodel: '2.5T' },
      { wheelDiameter: 20, submodel: '3.5T' },
      { wheelDiameter: 22, submodel: '3.5T Prestige' },
    ],
  },
  
  // TESLA
  'Tesla': {
    'Model 3': [
      { wheelDiameter: 18, submodel: 'Standard Range' },
      { wheelDiameter: 19, submodel: 'Long Range' },
      { wheelDiameter: 20, submodel: 'Performance' },
    ],
    'Model Y': [
      { wheelDiameter: 19, submodel: 'Long Range' },
      { wheelDiameter: 20, submodel: 'Performance' },
      { wheelDiameter: 21, submodel: 'Performance' },
    ],
    'Model S': [
      { wheelDiameter: 19, submodel: 'Long Range' },
      { wheelDiameter: 21, submodel: 'Plaid' },
    ],
    'Model X': [
      { wheelDiameter: 20, submodel: 'Long Range' },
      { wheelDiameter: 22, submodel: 'Plaid' },
    ],
  },
  
  // RIVIAN
  'Rivian': {
    'R1T': [
      { wheelDiameter: 20, submodel: 'Adventure' },
      { wheelDiameter: 21, submodel: 'Launch Edition' },
      { wheelDiameter: 22, submodel: 'Performance' },
    ],
    'R1S': [
      { wheelDiameter: 20, submodel: 'Adventure' },
      { wheelDiameter: 21, submodel: 'Launch Edition' },
      { wheelDiameter: 22, submodel: 'Performance' },
    ],
  },
};

function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchModel(dbModel: string, specModel: string): boolean {
  const n1 = normalizeModel(dbModel);
  const n2 = normalizeModel(specModel);
  return n1.includes(n2) || n2.includes(n1) || n1.replace(/\s/g, '') === n2.replace(/\s/g, '');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n🔧 Fixing submodel field${dryRun ? ' (DRY RUN)' : ''}\n`);
  
  const result = await pool.query(`
    SELECT id, year, make, model, submodel, oem_wheel_sizes::text, oem_tire_sizes::text
    FROM vehicle_fitments
    WHERE year >= 2000 AND (LOWER(submodel) = 'base' OR submodel = '' OR submodel IS NULL)
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rowCount} records to process\n`);
  
  let updated = 0, skipped = 0;
  const byMake: Record<string, { updated: number, skipped: number }> = {};
  
  for (const row of result.rows) {
    const make = row.make;
    if (!byMake[make]) byMake[make] = { updated: 0, skipped: 0 };
    
    // Find specs
    let specs: TrimSpec[] | null = null;
    const makeSpecs = TRIM_MAPS[make];
    if (makeSpecs) {
      for (const [specModel, modelSpecs] of Object.entries(makeSpecs)) {
        if (matchModel(row.model, specModel)) { specs = modelSpecs; break; }
      }
    }
    
    if (!specs) {
      // Use generic specs
      specs = GENERIC_SPECS;
    }
    
    // Parse wheel diameter
    let wheelDiameter: number | null = null;
    let tireSize: string | null = null;
    try {
      const wheels = JSON.parse(row.oem_wheel_sizes || '[]');
      if (wheels.length > 0) wheelDiameter = wheels[0].diameter;
      const tires = JSON.parse(row.oem_tire_sizes || '[]');
      if (tires.length > 0) tireSize = tires[0];
    } catch (e) {
      skipped++; byMake[make].skipped++; continue;
    }
    
    if (!wheelDiameter) { skipped++; byMake[make].skipped++; continue; }
    
    // Match trim
    let matched: string | null = null;
    for (const spec of specs) {
      if (spec.wheelDiameter !== wheelDiameter) continue;
      if (spec.tirePattern && tireSize && spec.tirePattern.test(tireSize)) { matched = spec.submodel; break; }
      if (!spec.tirePattern) matched = spec.submodel;
    }
    
    if (!matched) {
      // Fallback: find closest diameter
      for (const spec of specs) {
        if (spec.wheelDiameter === wheelDiameter) { matched = spec.submodel; break; }
      }
    }
    
    if (!matched) { skipped++; byMake[make].skipped++; continue; }
    
    if (!dryRun) {
      await pool.query(`UPDATE vehicle_fitments SET submodel = $1, updated_at = NOW() WHERE id = $2`, [matched, row.id]);
    }
    updated++; byMake[make].updated++;
  }
  
  console.log('\n📊 Results:\n');
  const sorted = Object.entries(byMake).sort((a, b) => b[1].updated - a[1].updated);
  for (const [make, stats] of sorted.slice(0, 25)) {
    const pct = ((stats.updated / (stats.updated + stats.skipped)) * 100).toFixed(1);
    console.log(`  ${make}: ${stats.updated} updated, ${stats.skipped} skipped (${pct}%)`);
  }
  if (sorted.length > 25) console.log(`  ... and ${sorted.length - 25} more makes`);
  
  console.log(`\n✅ Total: ${updated} updated, ${skipped} skipped`);
  await pool.end();
}

main().catch(console.error);
