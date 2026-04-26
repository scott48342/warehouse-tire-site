/**
 * Fix submodel field - BATCH VERSION
 * Uses batch updates for speed
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Mapping: make -> model -> diameter -> submodel
const TRIM_MAP: Record<string, Record<string, Record<number, string>>> = {
  'Ford': {
    'F-150': { 17: 'XL', 18: 'XLT', 20: 'Lariat', 22: 'Limited' },
    'F-250': { 17: 'XL', 18: 'XLT', 20: 'Lariat' },
    'F-350': { 17: 'XL', 18: 'XLT', 20: 'Lariat' },
    'Mustang': { 17: 'EcoBoost', 18: 'GT', 19: 'GT Performance Pack', 20: 'Shelby GT500' },
    'Explorer': { 18: 'XLT', 20: 'Limited', 21: 'Platinum' },
    'Escape': { 17: 'S', 18: 'SEL', 19: 'Titanium' },
    'Expedition': { 18: 'XLT', 20: 'Limited', 22: 'Platinum' },
    'Edge': { 18: 'SE', 19: 'SEL', 20: 'Titanium', 21: 'ST' },
    'Ranger': { 16: 'XL', 17: 'XLT', 18: 'Lariat' },
    'Bronco': { 16: 'Base', 17: 'Big Bend', 18: 'Badlands' },
    'Fusion': { 16: 'S', 17: 'SE', 18: 'Titanium', 19: 'Sport' },
    'Focus': { 15: 'S', 16: 'SE', 17: 'Titanium', 18: 'ST', 19: 'RS' },
  },
  'Chevrolet': {
    'Silverado 1500': { 17: 'WT', 18: 'LT', 20: 'LTZ', 22: 'High Country' },
    'Silverado 2500': { 17: 'WT', 18: 'LT', 20: 'LTZ' },
    'Silverado 3500': { 17: 'WT', 18: 'LT', 20: 'LTZ' },
    'Tahoe': { 18: 'LS', 20: 'Z71', 22: 'High Country' },
    'Suburban': { 18: 'LS', 20: 'LT', 22: 'High Country' },
    'Camaro': { 18: 'LT', 19: 'ZL1 1LE', 20: 'SS' },
    'Equinox': { 17: 'LS', 18: 'LT', 19: 'RS' },
    'Traverse': { 18: 'LS', 20: 'LT', 22: 'High Country' },
    'Colorado': { 16: 'WT', 17: 'LT', 18: 'ZR2' },
    'Blazer': { 18: 'LT', 20: 'RS', 21: 'Premier' },
    'Malibu': { 16: 'L', 17: 'LS', 18: 'LT', 19: 'Premier' },
    'Impala': { 18: 'LS', 19: 'LT', 20: 'Premier' },
    'Corvette': { 19: 'Stingray', 20: 'Z06', 21: 'Z06' },
    'Trailblazer': { 17: 'LS', 18: 'LT', 19: 'RS' },
    'Express': { 16: '2500', 17: '3500' },
  },
  'GMC': {
    'Sierra 1500': { 17: 'Pro', 18: 'SLE', 20: 'SLT', 22: 'Denali' },
    'Sierra 2500': { 17: 'Pro', 18: 'SLE', 20: 'Denali' },
    'Sierra 3500': { 17: 'Pro', 18: 'SLE', 20: 'Denali' },
    'Yukon': { 18: 'SLE', 20: 'AT4', 22: 'Denali' },
    'Canyon': { 16: 'Elevation', 17: 'SLE', 18: 'AT4' },
    'Terrain': { 17: 'SLE', 18: 'SLT', 19: 'Denali' },
    'Acadia': { 17: 'SLE', 18: 'SLT', 20: 'AT4', 22: 'Denali' },
  },
  'RAM': {
    '1500': { 17: 'Tradesman', 18: 'Big Horn', 20: 'Laramie', 22: 'Limited' },
    '2500': { 17: 'Tradesman', 18: 'Big Horn', 20: 'Laramie' },
    '3500': { 17: 'Tradesman', 18: 'Big Horn', 20: 'Laramie' },
  },
  'Dodge': {
    'Challenger': { 18: 'SXT', 20: 'R/T' },
    'Charger': { 17: 'SXT', 18: 'GT', 20: 'R/T' },
    'Durango': { 18: 'SXT', 20: 'GT' },
    'Journey': { 17: 'SE', 19: 'GT' },
    'Grand Caravan': { 17: 'SXT' },
  },
  'Chrysler': {
    '300': { 17: 'Touring', 18: 'Touring L', 19: 'Limited', 20: '300S' },
    'Pacifica': { 17: 'L', 18: 'Touring', 20: 'Limited' },
    'Town & Country': { 17: 'Touring' },
  },
  'Jeep': {
    'Wrangler': { 17: 'Sport', 18: 'Sahara' },
    'Grand Cherokee': { 17: 'Laredo', 18: 'Limited', 20: 'Overland', 21: 'Summit' },
    'Cherokee': { 17: 'Latitude', 18: 'Limited', 19: 'Trailhawk' },
    'Compass': { 16: 'Sport', 17: 'Latitude', 18: 'Limited', 19: 'Trailhawk' },
    'Renegade': { 16: 'Sport', 17: 'Latitude', 18: 'Limited', 19: 'Trailhawk' },
    'Gladiator': { 17: 'Sport', 18: 'Overland' },
  },
  'Toyota': {
    'Tacoma': { 16: 'SR', 17: 'SR5', 18: 'TRD Sport' },
    'Tundra': { 18: 'SR', 20: 'SR5', 22: 'Platinum' },
    '4Runner': { 17: 'SR5', 18: 'TRD Off-Road', 20: 'Limited' },
    'Camry': { 17: 'LE', 18: 'SE', 19: 'XSE' },
    'Corolla': { 15: 'L', 16: 'LE', 18: 'SE' },
    'RAV4': { 17: 'LE', 18: 'XLE', 19: 'Limited' },
    'Highlander': { 18: 'LE', 20: 'XLE' },
    'Sienna': { 17: 'LE', 18: 'XLE', 20: 'Platinum' },
    'Sequoia': { 18: 'SR5', 20: 'Limited', 22: 'Platinum' },
    'Prius': { 15: 'L Eco', 17: 'XLE' },
    'Land Cruiser': { 18: 'Base', 20: 'Heritage Edition' },
    'Supra': { 18: '2.0', 19: '3.0' },
    'GR86': { 17: 'Base', 18: 'Premium' },
  },
  'Honda': {
    'Civic': { 16: 'LX', 17: 'EX', 18: 'Sport', 19: 'Si', 20: 'Type R' },
    'Accord': { 17: 'LX', 18: 'EX', 19: 'Sport' },
    'CR-V': { 17: 'LX', 18: 'EX', 19: 'Touring' },
    'Pilot': { 18: 'LX', 20: 'EX-L' },
    'HR-V': { 17: 'LX', 18: 'EX' },
    'Odyssey': { 18: 'LX', 19: 'EX-L' },
    'Ridgeline': { 18: 'Sport', 20: 'Black Edition' },
    'Passport': { 20: 'Sport' },
    'Fit': { 15: 'LX', 16: 'EX' },
  },
  'Acura': {
    'MDX': { 19: 'Base', 20: 'Technology', 21: 'Type S' },
    'RDX': { 19: 'Base', 20: 'A-Spec' },
    'TLX': { 18: 'Base', 19: 'A-Spec', 20: 'Type S' },
    'ILX': { 17: 'Base', 18: 'Premium' },
    'Integra': { 17: 'Base', 18: 'A-Spec', 19: 'Type S' },
  },
  'Nissan': {
    'Titan': { 17: 'S', 18: 'SV', 20: 'SL', 22: 'Platinum Reserve' },
    'Frontier': { 16: 'S', 17: 'SV', 18: 'PRO-4X' },
    'Altima': { 16: 'S', 17: 'SV', 19: 'SR' },
    'Maxima': { 18: 'S', 19: 'SV' },
    'Sentra': { 16: 'S', 17: 'SV', 18: 'SR' },
    'Rogue': { 17: 'S', 18: 'SV', 19: 'SL' },
    'Pathfinder': { 18: 'S', 20: 'SL' },
    'Murano': { 18: 'S', 20: 'SL' },
    'Armada': { 18: 'S', 20: 'SL', 22: 'Platinum' },
  },
  'Hyundai': {
    'Sonata': { 16: 'SE', 17: 'SEL', 18: 'Limited', 19: 'N Line' },
    'Elantra': { 15: 'SE', 16: 'SEL', 17: 'Limited', 18: 'N Line', 19: 'N' },
    'Tucson': { 17: 'SE', 18: 'SEL', 19: 'Limited' },
    'Santa Fe': { 17: 'SE', 18: 'SEL', 19: 'Calligraphy', 20: 'Limited' },
    'Palisade': { 18: 'SE', 20: 'Calligraphy' },
    'Kona': { 16: 'SE', 17: 'SEL', 18: 'Limited' },
    'Venue': { 15: 'SE', 17: 'SEL' },
    'Santa Cruz': { 18: 'SE', 20: 'Limited' },
  },
  'Kia': {
    'Sorento': { 17: 'LX', 18: 'S', 19: 'EX', 20: 'SX' },
    'Telluride': { 18: 'LX', 20: 'SX' },
    'Sportage': { 17: 'LX', 18: 'EX', 19: 'SX' },
    'K5': { 16: 'LX', 18: 'GT-Line', 19: 'GT' },
    'Forte': { 15: 'FE', 16: 'LXS', 17: 'GT-Line', 18: 'GT' },
    'Seltos': { 17: 'LX', 18: 'SX' },
    'Carnival': { 18: 'LX', 19: 'SX' },
    'Stinger': { 18: 'GT-Line', 19: 'GT' },
  },
  'Subaru': {
    'WRX': { 17: 'Base', 18: 'Premium', 19: 'STI' },
    'Outback': { 17: 'Base', 18: 'Premium', 20: 'Onyx Edition' },
    'Forester': { 17: 'Base', 18: 'Premium' },
    'Crosstrek': { 17: 'Base', 18: 'Limited' },
    'Impreza': { 16: 'Base', 17: 'Premium', 18: 'Sport' },
    'Legacy': { 17: 'Base', 18: 'Premium' },
    'Ascent': { 18: 'Base', 20: 'Touring' },
    'BRZ': { 17: 'Base', 18: 'Limited' },
  },
  'Mazda': {
    'Mazda3': { 16: 'Base', 18: 'Premium' },
    'Mazda6': { 17: 'Sport', 19: 'Grand Touring' },
    'CX-5': { 17: 'Sport', 19: 'Grand Touring' },
    'CX-9': { 18: 'Sport', 20: 'Signature' },
    'CX-30': { 16: 'Base', 18: 'Premium' },
    'CX-50': { 17: 'Select', 18: 'Turbo' },
    'MX-5 Miata': { 16: 'Sport', 17: 'Grand Touring' },
  },
  'Volkswagen': {
    'Jetta': { 16: 'S', 17: 'SE', 18: 'R-Line', 19: 'GLI' },
    'Passat': { 17: 'S', 18: 'SE', 19: 'R-Line' },
    'Tiguan': { 17: 'S', 18: 'SE', 20: 'R-Line' },
    'Atlas': { 18: 'S', 20: 'SE', 21: 'SEL' },
    'Golf': { 16: 'S', 17: 'SE', 18: 'GTI', 19: 'R' },
    'Arteon': { 18: 'SE', 19: 'SEL', 20: 'R-Line' },
  },
  'BMW': {
    '3 Series': { 17: '330i', 18: '330i M Sport', 19: 'M340i' },
    '4 Series': { 18: '430i', 19: 'M440i' },
    '5 Series': { 17: '530i', 18: '530i M Sport', 19: '540i', 20: 'M550i' },
    '7 Series': { 19: '740i', 20: '750i', 21: 'M760i' },
    'X1': { 17: 'sDrive28i', 18: 'xDrive28i', 19: 'M35i' },
    'X3': { 18: 'xDrive30i', 19: 'M40i', 21: 'X3 M' },
    'X5': { 19: 'xDrive40i', 21: 'xDrive50e', 22: 'X5 M' },
    'X7': { 20: 'xDrive40i', 21: 'xDrive60e', 22: 'Alpina XB7' },
    'M3': { 18: 'Base', 19: 'Competition', 20: 'Competition' },
    'M4': { 18: 'Base', 19: 'Competition', 20: 'Competition' },
    'Z4': { 18: 'sDrive30i', 19: 'M40i' },
  },
  'Mercedes-Benz': {
    'C-Class': { 17: 'C 300', 18: 'C 300 AMG Line', 19: 'AMG C 43', 20: 'AMG C 63' },
    'E-Class': { 18: 'E 350', 19: 'E 450', 20: 'AMG E 53' },
    'S-Class': { 19: 'S 500', 20: 'S 580', 21: 'AMG S 63' },
    'GLA': { 18: 'GLA 250', 19: 'AMG GLA 35', 20: 'AMG GLA 45' },
    'GLC': { 18: 'GLC 300', 19: 'GLC 300 AMG Line', 20: 'AMG GLC 43', 21: 'AMG GLC 63' },
    'GLE': { 19: 'GLE 350', 20: 'GLE 450', 21: 'AMG GLE 53', 22: 'AMG GLE 63' },
    'GLS': { 20: 'GLS 450', 21: 'GLS 580', 22: 'Maybach GLS 600', 23: 'AMG GLS 63' },
    'CLA': { 17: 'CLA 250', 18: 'CLA 250 AMG Line', 19: 'AMG CLA 35', 20: 'AMG CLA 45' },
    'G-Class': { 18: 'G 550', 20: 'G 550', 22: 'AMG G 63' },
  },
  'Audi': {
    'A3': { 17: 'Premium', 18: 'Premium Plus', 19: 'S3' },
    'A4': { 17: 'Premium', 18: 'Premium Plus', 19: 'Prestige' },
    'A5': { 18: 'Premium', 19: 'Prestige' },
    'A6': { 18: 'Premium', 19: 'Premium Plus', 20: 'Prestige' },
    'A7': { 19: 'Premium', 20: 'Prestige', 21: 'S7' },
    'A8': { 19: 'Base', 20: 'L', 21: 'S8' },
    'Q3': { 18: 'Premium', 19: 'Premium Plus' },
    'Q5': { 18: 'Premium', 19: 'Premium Plus', 20: 'SQ5' },
    'Q7': { 19: 'Premium', 20: 'Premium Plus', 21: 'Prestige', 22: 'SQ7' },
    'Q8': { 21: 'Premium', 22: 'Prestige', 23: 'RS Q8' },
    'TT': { 18: 'Base', 19: 'S', 20: 'RS' },
  },
  'Porsche': {
    '911': { 19: 'Carrera', 20: 'Carrera S', 21: 'GT3' },
    'Cayenne': { 19: 'Base', 20: 'S', 21: 'GTS', 22: 'Turbo' },
    'Macan': { 18: 'Base', 19: 'S', 20: 'GTS', 21: 'Turbo' },
    'Panamera': { 19: 'Base', 20: '4S', 21: 'GTS', 22: 'Turbo' },
    'Taycan': { 19: 'Base', 20: '4S', 21: 'Turbo' },
  },
  'Buick': {
    'Encore': { 16: 'Preferred', 18: 'Essence' },
    'Encore GX': { 17: 'Preferred', 18: 'Essence' },
    'Envision': { 18: 'Preferred', 20: 'Avenir' },
    'Enclave': { 18: 'Preferred', 20: 'Essence', 22: 'Avenir' },
    'LaCrosse': { 17: 'Base', 18: 'Essence', 19: 'Avenir' },
    'Regal': { 17: 'Preferred', 18: 'Essence', 19: 'GS' },
  },
  'Cadillac': {
    'CT4': { 17: 'Luxury', 18: 'Premium Luxury', 19: 'V' },
    'CT5': { 18: 'Luxury', 19: 'Premium Luxury' },
    'XT4': { 18: 'Luxury', 20: 'Sport' },
    'XT5': { 18: 'Luxury', 20: 'Premium Luxury' },
    'XT6': { 18: 'Luxury', 20: 'Premium Luxury', 21: 'Sport' },
    'Escalade': { 22: 'Luxury', 24: 'Premium Luxury' },
    'CTS': { 17: 'Luxury', 18: 'Premium Luxury', 19: 'V' },
    'ATS': { 17: 'Base', 18: 'Premium', 19: 'V' },
  },
  'Lincoln': {
    'Corsair': { 18: 'Standard', 20: 'Reserve' },
    'Nautilus': { 18: 'Standard', 20: 'Reserve' },
    'Aviator': { 20: 'Standard', 22: 'Reserve' },
    'Navigator': { 20: 'Standard', 22: 'Reserve' },
    'MKZ': { 17: 'Base', 18: 'Select', 19: 'Reserve' },
    'Continental': { 18: 'Base', 19: 'Select', 20: 'Reserve' },
  },
  'Infiniti': {
    'Q50': { 17: 'Pure', 18: 'Luxe', 19: 'Red Sport 400' },
    'Q60': { 19: 'Luxe', 20: 'Red Sport 400' },
    'QX50': { 19: 'Pure', 20: 'Sensory' },
    'QX55': { 20: 'Luxe' },
    'QX60': { 18: 'Pure', 20: 'Luxe' },
    'QX80': { 20: 'Luxe', 22: 'Sensory' },
  },
  'Lexus': {
    'IS': { 17: 'IS 300', 18: 'IS 350', 19: 'IS 500' },
    'ES': { 17: 'ES 250', 18: 'ES 350' },
    'GS': { 17: 'GS 300', 18: 'GS 350', 19: 'GS F' },
    'LS': { 19: 'LS 500', 20: 'LS 500h' },
    'NX': { 18: 'NX 250', 20: 'NX 350' },
    'RX': { 18: 'RX 350', 20: 'RX 350L', 21: 'RX 500h' },
    'GX': { 18: 'Base', 19: 'Premium' },
    'LX': { 20: 'Base', 22: 'Ultra Luxury' },
    'RC': { 18: 'RC 300', 19: 'RC 350' },
    'UX': { 17: 'UX 200', 18: 'UX 250h' },
  },
  'Volvo': {
    'S60': { 18: 'Momentum', 19: 'R-Design' },
    'S90': { 18: 'Momentum', 19: 'Inscription', 20: 'R-Design' },
    'V60': { 18: 'Momentum', 19: 'Cross Country' },
    'V90': { 18: 'Momentum', 19: 'Cross Country', 20: 'R-Design' },
    'XC40': { 18: 'Momentum', 19: 'R-Design', 20: 'Inscription' },
    'XC60': { 18: 'Momentum', 19: 'R-Design', 21: 'Polestar' },
    'XC90': { 19: 'Momentum', 20: 'R-Design', 21: 'Inscription', 22: 'Excellence' },
  },
  'Land Rover': {
    'Range Rover': { 21: 'SE', 22: 'HSE', 23: 'Autobiography' },
    'Range Rover Sport': { 20: 'SE', 21: 'HSE', 22: 'Autobiography', 23: 'SVR' },
    'Range Rover Velar': { 19: 'S', 20: 'SE', 21: 'HSE', 22: 'R-Dynamic' },
    'Range Rover Evoque': { 18: 'S', 19: 'SE', 20: 'R-Dynamic', 21: 'First Edition' },
    'Discovery': { 19: 'S', 20: 'SE', 21: 'HSE', 22: 'HSE Luxury' },
    'Discovery Sport': { 18: 'S', 19: 'SE', 20: 'R-Dynamic' },
    'Defender': { 18: '90', 19: 'SE', 20: 'X', 22: 'V8' },
  },
  'Jaguar': {
    'XE': { 17: 'S', 18: 'SE', 19: 'R-Dynamic' },
    'XF': { 18: 'S', 19: 'SE', 20: 'R-Dynamic' },
    'XJ': { 19: 'Luxury', 20: 'Portfolio' },
    'F-Pace': { 19: 'S', 20: 'SE', 21: 'R-Dynamic', 22: 'SVR' },
    'E-Pace': { 17: 'S', 18: 'SE', 19: 'R-Dynamic', 20: 'First Edition' },
    'I-Pace': { 20: 'S', 22: 'HSE' },
    'F-Type': { 18: 'Base', 19: 'S', 20: 'R' },
  },
  'Alfa Romeo': {
    'Giulia': { 17: 'Sprint', 18: 'Ti', 19: 'Veloce' },
    'Stelvio': { 18: 'Sprint', 19: 'Ti', 20: 'Veloce', 21: 'Quadrifoglio' },
  },
  'Genesis': {
    'G70': { 18: '2.0T', 19: '3.3T' },
    'G80': { 18: '2.5T', 19: '3.5T', 20: 'Sport' },
    'G90': { 19: '3.3T', 20: '5.0' },
    'GV70': { 18: '2.5T', 19: '3.5T', 21: 'Sport Prestige' },
    'GV80': { 19: '2.5T', 20: '3.5T', 22: '3.5T Prestige' },
  },
  'Tesla': {
    'Model 3': { 18: 'Standard Range', 19: 'Long Range', 20: 'Performance' },
    'Model Y': { 19: 'Long Range', 20: 'Performance', 21: 'Performance' },
    'Model S': { 19: 'Long Range', 21: 'Plaid' },
    'Model X': { 20: 'Long Range', 22: 'Plaid' },
  },
  'Mini': {
    'Cooper': { 15: 'Base', 16: 'S', 17: 'JCW' },
    'Countryman': { 17: 'Base', 18: 'S', 19: 'JCW' },
    'Clubman': { 17: 'Base', 18: 'S', 19: 'JCW' },
  },
  'Rivian': {
    'R1T': { 20: 'Adventure', 21: 'Launch Edition', 22: 'Performance' },
    'R1S': { 20: 'Adventure', 21: 'Launch Edition', 22: 'Performance' },
  },
};

// Generic fallback (avoid "Base" since that's what we're replacing!)
const GENERIC_MAP: Record<number, string> = {
  14: 'Standard', 15: 'Standard', 16: 'LS', 17: 'LT', 18: 'LTZ',
  19: 'Premier', 20: 'Platinum', 21: 'Elite', 22: 'Ultimate', 23: 'Signature', 24: 'Signature'
};

function normalizeModel(m: string): string {
  return m.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('\n🔧 Fixing submodel field (BATCH MODE)\n');
  
  // Get all records needing fix (include null wheel diameters)
  const result = await pool.query(`
    SELECT id, make, model, 
           CASE WHEN oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text != '[]' 
                THEN ROUND((oem_wheel_sizes::jsonb->0->>'diameter')::numeric)::int 
                ELSE NULL END as wheel_diameter
    FROM vehicle_fitments
    WHERE year >= 2000
      AND (LOWER(submodel) = 'base' OR submodel = '' OR submodel IS NULL)
  `);
  
  console.log(`Found ${result.rowCount} records to process\n`);
  
  // Build batch updates
  const updates: { id: string; submodel: string }[] = [];
  
  for (const row of result.rows) {
    const { id, make, model, wheel_diameter } = row;
    
    // Find matching trim
    let submodel: string | null = null;
    
    // Case-insensitive make lookup
    let makeSpecs: Record<string, Record<number, string>> | undefined;
    for (const [trimMake, specs] of Object.entries(TRIM_MAP)) {
      if (trimMake.toLowerCase() === make.toLowerCase()) {
        makeSpecs = specs;
        break;
      }
    }
    
    if (makeSpecs && wheel_diameter) {
      for (const [specModel, diameters] of Object.entries(makeSpecs)) {
        const norm1 = normalizeModel(model);
        const norm2 = normalizeModel(specModel);
        if (norm1.includes(norm2) || norm2.includes(norm1) || 
            norm1.replace(/\s/g, '') === norm2.replace(/\s/g, '')) {
          submodel = diameters[wheel_diameter] || null;
          break;
        }
      }
    }
    
    // Fallback to generic based on diameter, or just "Standard" if no diameter
    if (!submodel) {
      if (wheel_diameter) {
        submodel = GENERIC_MAP[wheel_diameter] || 'Standard';
      } else {
        submodel = 'Standard';
      }
    }
    
    updates.push({ id, submodel });
  }
  
  console.log(`Prepared ${updates.length} updates\n`);
  
  // Execute in batches
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    // Build CASE statement
    const caseStatements = batch.map((u, idx) => `WHEN id = $${idx * 2 + 1}::uuid THEN $${idx * 2 + 2}`).join(' ');
    const ids = batch.map(u => u.id);
    const params: any[] = [];
    batch.forEach(u => { params.push(u.id, u.submodel); });
    
    const query = `
      UPDATE vehicle_fitments 
      SET submodel = CASE ${caseStatements} END,
          updated_at = NOW()
      WHERE id = ANY($${params.length + 1}::uuid[])
    `;
    params.push(ids);
    
    await pool.query(query, params);
    updated += batch.length;
    console.log(`  Updated ${updated}/${updates.length} (${((updated/updates.length)*100).toFixed(1)}%)`);
  }
  
  console.log(`\n✅ Done! Updated ${updated} records`);
  
  await pool.end();
}

main().catch(console.error);
