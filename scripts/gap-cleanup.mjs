/**
 * Gap Sweep Cleanup Script
 * Removes non-US vehicles and fixes data issues identified in GAP_SWEEP_REPORT.md
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL not set");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function runCleanup() {
  console.log("🧹 Starting Gap Sweep Cleanup...\n");
  
  let totalDeleted = 0;
  
  // Helper to run delete and report
  async function deleteAndReport(description, query) {
    try {
      const result = await db.execute(query);
      const count = result.rowCount || 0;
      if (count > 0) {
        console.log(`✅ ${description}: ${count} rows deleted`);
        totalDeleted += count;
      }
      return count;
    } catch (err) {
      console.log(`⚠️ ${description}: ${err.message}`);
      return 0;
    }
  }
  
  console.log("=== CHINA-ONLY MODELS ===");
  await deleteAndReport("Audi A7L", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'A7L'`);
  await deleteAndReport("Audi Q2L e-tron", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q2L e-tron'`);
  await deleteAndReport("Audi Q5 e-tron", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q5 e-tron'`);
  await deleteAndReport("Audi Q6 (ICE)", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q6' AND model NOT LIKE '%e-tron%'`);
  await deleteAndReport("Audi Q6L Sportback e-tron", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q6L Sportback e-tron'`);
  await deleteAndReport("Hyundai Mufasa", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Mufasa'`);
  await deleteAndReport("VW ID.4 Crozz", sql`DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'ID.4 Crozz'`);
  await deleteAndReport("Volvo EM90", sql`DELETE FROM vehicle_fitments WHERE make = 'Volvo' AND model = 'EM90'`);
  await deleteAndReport("Volvo ES90", sql`DELETE FROM vehicle_fitments WHERE make = 'Volvo' AND model = 'ES90'`);
  
  console.log("\n=== EUROPE-ONLY MODELS ===");
  await deleteAndReport("Mercedes T-Class", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'T-Class'`);
  await deleteAndReport("Mercedes Vaneo", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'Vaneo'`);
  await deleteAndReport("Mercedes EQT", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'EQT'`);
  await deleteAndReport("Mercedes EQV", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'EQV'`);
  await deleteAndReport("VW XL1", sql`DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'XL1'`);
  await deleteAndReport("Cadillac BLS", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'BLS'`);
  
  console.log("\n=== JDM-ONLY MODELS ===");
  await deleteAndReport("Mitsubishi JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model IN ('Aspire', 'Chariot Grandis', 'Debonair', 'Toppo BJ', 'Toppo BJ Wide', 'Town Box Wide', 'Legnum', 'Mirage Asti', 'GTO')`);
  await deleteAndReport("Honda JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model IN ('Integra SJ', 'Lagreat', 'Life Dunk', 'Orthia', 'S-MX', 'Saber', 'Z', 'Domani', 'e', 'FR-V', 'Avenir', 'Cefiro')`);
  await deleteAndReport("Nissan JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model IN ('Clipper EV', 'Clipper Rio', 'Dualis-2', 'Kix', 'Kubistar', 'Leopard', 'Lucino', 'NV150-AD', 'Presea', 'R-Nessa', 'Rasheen', 'Sakura', 'Skyline Crossover', 'Aprio')`);
  await deleteAndReport("Toyota JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model IN ('Corolla Runx', 'Corolla Spacio', 'Corona Premio', 'Cresta', 'Grand Hiace', 'Land Cruiser Cygnus', 'Mega Cruiser', 'Sprinter', 'Sprinter Carib', 'Sprinter Trueno', 'Camry Gracia')`);
  await deleteAndReport("Mazda JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Mazda' AND model IN ('Laputa', 'Spiano', 'Xedos-9', 'MazdaSpeed Axela')`);
  await deleteAndReport("Subaru JDM", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model IN ('Impreza Anesis', 'Pleo Custom', 'Pleo Nesta')`);
  
  console.log("\n=== AUSTRALIA/OTHER MARKETS ===");
  await deleteAndReport("Mitsubishi Express", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Express'`);
  await deleteAndReport("Mitsubishi Magna", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Magna'`);
  await deleteAndReport("Mitsubishi Verada", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Verada'`);
  await deleteAndReport("Ford LTD (AU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'LTD'`);
  await deleteAndReport("Ford Fairlane (AU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Fairlane'`);
  await deleteAndReport("Ford Fairmont (AU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Fairmont'`);
  await deleteAndReport("Subaru Liberty (AU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model = 'Liberty'`);
  
  console.log("\n=== MEXICO/SOUTH AMERICA ===");
  await deleteAndReport("Chevrolet Sonora", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Sonora'`);
  await deleteAndReport("Chevrolet Spark Classic", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Spark Classic'`);
  await deleteAndReport("Chevrolet Spark GT Activ", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Spark GT Activ'`);
  await deleteAndReport("Dodge Vision", sql`DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'Vision'`);
  await deleteAndReport("Ford Ka Freestyle", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Ka Freestyle'`);
  await deleteAndReport("Ford Maverick (old)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Maverick' AND year < 2022`);
  await deleteAndReport("Nissan Platina", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Platina'`);
  await deleteAndReport("Nissan Paladin", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Paladin'`);
  await deleteAndReport("Nissan X-Trail X-Treme", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'X-Trail X-Treme'`);
  await deleteAndReport("Toyota Etios Valco", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'Etios Valco'`);
  await deleteAndReport("Toyota Soluna", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'Soluna'`);
  await deleteAndReport("Toyota Vios FS", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'Vios FS'`);
  
  console.log("\n=== WRONG US MARKET YEARS - AUDI ===");
  await deleteAndReport("Audi Q3 pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q3' AND year < 2015`);
  await deleteAndReport("Audi Q7 pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q7' AND year < 2007`);
  await deleteAndReport("Audi RS3 wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS3' AND year IN (2011, 2012, 2015, 2016, 2021)`);
  await deleteAndReport("Audi RS6 wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS6' AND year NOT IN (2003, 2020, 2021, 2022, 2023, 2024, 2025, 2026)`);
  await deleteAndReport("Audi RS7 pre-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS7' AND year < 2014`);
  await deleteAndReport("Audi S3 pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'S3' AND year < 2015`);
  await deleteAndReport("Audi SQ5 pre-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ5' AND year < 2014`);
  await deleteAndReport("Audi SQ7 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ7' AND year < 2020`);
  await deleteAndReport("Audi SQ8 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ8' AND year < 2020`);
  await deleteAndReport("Audi Cabriolet post-1998", sql`DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Cabriolet' AND year > 1998`);
  
  console.log("\n=== WRONG US MARKET YEARS - BMW ===");
  await deleteAndReport("BMW X1 pre-2013", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X1' AND year < 2013`);
  await deleteAndReport("BMW X2 pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X2' AND year < 2018`);
  await deleteAndReport("BMW X7 pre-2019", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X7' AND year < 2019`);
  await deleteAndReport("BMW iX pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'iX' AND year < 2022`);
  await deleteAndReport("BMW Z3 post-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'Z3' AND year > 2002`);
  await deleteAndReport("BMW M2 pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'M2' AND year < 2016`);
  
  console.log("\n=== WRONG US MARKET YEARS - BUICK ===");
  await deleteAndReport("Buick Allure", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Allure'`);
  await deleteAndReport("Buick Park Avenue post-2005", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Park Avenue' AND year > 2005`);
  await deleteAndReport("Buick Regal GS post-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Regal GS' AND year > 2017`);
  await deleteAndReport("Buick Regal TourX post-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Regal TourX' AND year > 2020`);
  await deleteAndReport("Buick Rainier pre-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Rainier' AND year < 2004`);
  await deleteAndReport("Buick Rendezvous pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Rendezvous' AND year < 2002`);
  await deleteAndReport("Buick Verano China", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Verano%' AND year > 2017`);
  await deleteAndReport("Buick Electra China", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Electra%'`);
  await deleteAndReport("Buick Envision China trims", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Envision S%'`);
  await deleteAndReport("Buick Envista GS", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Envista GS%'`);
  await deleteAndReport("Buick Excelle XT", sql`DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Excelle XT'`);
  
  console.log("\n=== WRONG US MARKET YEARS - CADILLAC ===");
  await deleteAndReport("Cadillac SRX post-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'SRX' AND year > 2016`);
  await deleteAndReport("Cadillac STS-V pre-2006", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'STS-V' AND year < 2006`);
  await deleteAndReport("Cadillac XT5 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'XT5' AND year < 2017`);
  await deleteAndReport("Cadillac XT6 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'XT6' AND year < 2020`);
  await deleteAndReport("Cadillac SLS (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'SLS'`);
  await deleteAndReport("Cadillac GT4 (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'GT4'`);
  
  console.log("\n=== WRONG US MARKET YEARS - OTHER ===");
  await deleteAndReport("Mitsubishi 3000 GT post-1999", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = '3000 GT' AND year > 1999`);
  await deleteAndReport("Mitsubishi Diamante post-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Diamante' AND year > 2004`);
  await deleteAndReport("Mitsubishi Galant post-2012", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Galant' AND year > 2012`);
  await deleteAndReport("Mitsubishi Lancer pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Lancer' AND year < 2002`);
  await deleteAndReport("Mitsubishi Lancer Evolution wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Lancer Evolution' AND (year < 2003 OR year = 2007 OR year > 2015)`);
  await deleteAndReport("Mitsubishi Destinator", sql`DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Destinator'`);
  await deleteAndReport("Hyundai Entourage post-2009", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Entourage' AND year > 2009`);
  await deleteAndReport("Honda HR-V pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'HR-V' AND year < 2016`);
  await deleteAndReport("Honda Ridgeline pre-2006", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'Ridgeline' AND year < 2006`);
  await deleteAndReport("Honda Fit 2001-2006, 2022+", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'Fit' AND (year < 2007 OR year > 2020)`);
  await deleteAndReport("Hyundai Ioniq 2016", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Ioniq' AND year = 2016`);
  await deleteAndReport("Hyundai Palisade pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Palisade' AND year < 2020`);
  await deleteAndReport("Hyundai Sedona pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Sedona' AND year < 2002`);
  await deleteAndReport("Kia Seltos pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Seltos' AND year < 2021`);
  await deleteAndReport("Kia Soul pre-2010", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Soul' AND year < 2010`);
  await deleteAndReport("Lexus IS-F pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'Lexus' AND model = 'IS-F' AND year < 2008`);
  await deleteAndReport("Lexus RC-F pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Lexus' AND model = 'RC-F' AND year < 2015`);
  await deleteAndReport("Lexus LBX", sql`DELETE FROM vehicle_fitments WHERE make = 'Lexus' AND model = 'LBX'`);
  await deleteAndReport("Lexus TX pre-2024", sql`DELETE FROM vehicle_fitments WHERE make = 'Lexus' AND model = 'TX' AND year < 2024`);
  await deleteAndReport("MINI Cooper pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Cooper' AND year < 2002`);
  await deleteAndReport("MINI Clubman pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Clubman' AND year < 2008`);
  await deleteAndReport("MINI Countryman pre-2011", sql`DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Countryman' AND year < 2011`);
  await deleteAndReport("Nissan 200SX post-1998", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = '200SX' AND year > 1998`);
  await deleteAndReport("Nissan GT-R pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'GT-R' AND year < 2008`);
  await deleteAndReport("Nissan Kicks pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Kicks' AND year < 2018`);
  await deleteAndReport("Nissan Leaf pre-2011", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Leaf' AND year < 2011`);
  await deleteAndReport("Nissan X-Terra (Middle East)", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'X-Terra' AND year > 2015`);
  await deleteAndReport("VW Touareg pre-2003", sql`DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'Touareg' AND year < 2003`);
  await deleteAndReport("VW Atlas pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'Atlas' AND year < 2018`);
  await deleteAndReport("Subaru WRX pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model LIKE '%WRX%' AND year < 2002`);
  await deleteAndReport("Subaru STI pre-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model LIKE '%STI%' AND year < 2004`);
  await deleteAndReport("Toyota FJ Cruiser post-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'FJ Cruiser' AND year > 2014`);
  await deleteAndReport("Toyota Celica post-2005", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'Celica' AND year > 2005`);
  await deleteAndReport("Toyota MR2 post-2005", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model LIKE 'MR2%' AND year > 2005`);
  await deleteAndReport("Toyota iQ", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'iQ'`);
  await deleteAndReport("Ford FJ Cruiser (dup)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'FJ Cruiser'`);
  
  console.log("\n=== PLATFORM CODES & NAMING ISSUES ===");
  await deleteAndReport("Hyundai JM (platform code)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'JM'`);
  await deleteAndReport("Hyundai NF (platform code)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'NF'`);
  await deleteAndReport("Hyundai Tuscani", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Tuscani'`);
  await deleteAndReport("Hyundai Santa Fe Classic", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Santa Fe Classic'`);
  await deleteAndReport("Hyundai Tiburon Turbulence", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Tiburon Turbulence'`);
  await deleteAndReport("Hyundai Santro Zip", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Santro Zip'`);
  await deleteAndReport("Honda NSX (should be Acura)", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'NSX'`);
  await deleteAndReport("Honda MDX (should be Acura)", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'MDX'`);
  await deleteAndReport("Honda MR-V (should be Acura MDX)", sql`DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'MR-V'`);
  await deleteAndReport("Infiniti Q30 (Europe only)", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'Q30'`);
  await deleteAndReport("Infiniti generic I", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'I'`);
  await deleteAndReport("Infiniti generic M", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'M'`);
  await deleteAndReport("Infiniti generic G", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'G'`);
  await deleteAndReport("Infiniti generic EX", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'EX'`);
  await deleteAndReport("Infiniti generic FX", sql`DELETE FROM vehicle_fitments WHERE make = 'Infiniti' AND model = 'FX'`);
  await deleteAndReport("GMC Suburban (doesn't exist)", sql`DELETE FROM vehicle_fitments WHERE make = 'GMC' AND model LIKE 'Suburban%'`);
  await deleteAndReport("Dodge JC (platform code)", sql`DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'JC'`);
  await deleteAndReport("Dodge Charger Pursuit (fleet)", sql`DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'Charger Pursuit'`);
  await deleteAndReport("Chrysler Grand Caravan Canada", sql`DELETE FROM vehicle_fitments WHERE make = 'Chrysler' AND model = 'Grand Caravan' AND year > 2020`);
  await deleteAndReport("Chrysler 300C 2004", sql`DELETE FROM vehicle_fitments WHERE make = 'Chrysler' AND model = '300C' AND year = 2004`);
  await deleteAndReport("Land Rover Discovery 4 (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Land Rover' AND model = 'Discovery 4'`);
  await deleteAndReport("Land Rover Discovery 5 (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Land Rover' AND model = 'Discovery 5'`);
  await deleteAndReport("Land Rover Freelander 2 (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Land Rover' AND model = 'Freelander 2'`);
  await deleteAndReport("Land Rover Discovery-3 (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Land Rover' AND model = 'Discovery-3'`);
  await deleteAndReport("Land Rover Discovery-4 (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Land Rover' AND model = 'Discovery-4'`);
  await deleteAndReport("Mazda3-MPS (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mazda' AND model = 'Mazda3-MPS'`);
  await deleteAndReport("Mazda6-MPS (EU name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mazda' AND model = 'Mazda6-MPS'`);
  await deleteAndReport("Mazda6-Ruiyi (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mazda' AND model = 'Mazda6-Ruiyi'`);
  await deleteAndReport("Mazda2-Hybrid (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mazda' AND model = 'Mazda2-Hybrid'`);
  await deleteAndReport("Toyota MR2 Roadster (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'MR2 Roadster'`);
  await deleteAndReport("Toyota xA (should be Scion)", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'xA'`);
  await deleteAndReport("Toyota Urban Cruiser Taisor", sql`DELETE FROM vehicle_fitments WHERE make = 'Toyota' AND model = 'Urban Cruiser Taisor'`);
  await deleteAndReport("Genesis EQ900 (Korea)", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'EQ900'`);
  await deleteAndReport("Genesis early years", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'G70' AND year < 2019`);
  await deleteAndReport("Genesis G80 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'G80' AND year < 2017`);
  await deleteAndReport("Genesis G90 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'G90' AND year < 2017`);
  await deleteAndReport("Genesis GV70 pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'GV70' AND year < 2022`);
  await deleteAndReport("Genesis GV80 pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'Genesis' AND model = 'GV80' AND year < 2021`);
  await deleteAndReport("Ford Cougar (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Cougar'`);
  await deleteAndReport("Ford Classic (India)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Classic'`);
  await deleteAndReport("Ford Fiesta Classic (India)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Fiesta Classic'`);
  await deleteAndReport("Ford Fiesta Ikon (Mexico)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Fiesta Ikon'`);
  await deleteAndReport("Ford Focus C-Max pre-2013", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Focus C-Max' AND year < 2013`);
  await deleteAndReport("Ford Evos (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Evos'`);
  await deleteAndReport("Ford Transit-T8 (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Transit-T8'`);
  await deleteAndReport("Ford Transit pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Transit' AND year < 2015`);
  await deleteAndReport("Ford SportKa (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'SportKa'`);
  await deleteAndReport("Ford StreetKa (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'StreetKa'`);
  await deleteAndReport("Chevrolet Viva (Russia)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Viva'`);
  await deleteAndReport("Chevrolet Tacuma (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Tacuma'`);
  await deleteAndReport("Chevrolet Trans Sport (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Trans Sport'`);
  await deleteAndReport("Chevrolet Utility (SA)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Utility'`);
  await deleteAndReport("Chevrolet Tracker RS (SA)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Tracker RS'`);
  await deleteAndReport("Chevy Evanda (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Evanda'`);
  await deleteAndReport("Chevy Aveo U-VA (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Aveo U-VA'`);
  await deleteAndReport("Chevy Caprice 2000-2010 (AU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Caprice' AND year BETWEEN 2000 AND 2010`);
  await deleteAndReport("Chevy Corsa Classic (Brazil)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Corsa Classic'`);
  await deleteAndReport("Chevy Cruze Sport6 RS (Brazil)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Cruze Sport6 RS'`);
  await deleteAndReport("Chevy LUV (Mexico)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'LUV'`);
  await deleteAndReport("Chevy MW (JDM kei)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'MW'`);
  await deleteAndReport("Chevy Onix variants (Brazil)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model LIKE 'Onix%'`);
  await deleteAndReport("Chevy Prisma variants (Brazil)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model LIKE 'Prisma%'`);
  await deleteAndReport("Chevy Seeker (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Seeker'`);
  await deleteAndReport("Chevy Lova RV (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Lova RV'`);
  await deleteAndReport("Chevy Alero (wrong make)", sql`DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Alero'`);
  await deleteAndReport("Ram C/V post-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Ram' AND model = 'C/V' AND year > 2015`);
  await deleteAndReport("Nissan Terrano-2 (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Terrano-2'`);
  await deleteAndReport("Nissan Terrano-Regulus (JDM)", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Terrano-Regulus'`);
  await deleteAndReport("Nissan Datsun brand", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'Datsun'`);
  await deleteAndReport("Nissan N7 (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Nissan' AND model = 'N7'`);
  await deleteAndReport("Volvo V90 sedan post-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'Volvo' AND model = 'V90' AND year > 2021 AND model NOT LIKE '%Cross Country%'`);
  await deleteAndReport("Kia Tonic (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Tonic'`);
  await deleteAndReport("Kia Vigato", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Vigato'`);
  await deleteAndReport("Kia Visto (kei)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Visto'`);
  await deleteAndReport("Kia X-Trek", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'X-Trek'`);
  await deleteAndReport("Kia Spectra-Wing (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Spectra-Wing'`);
  await deleteAndReport("Kia Potentia (Korea)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Potentia'`);
  await deleteAndReport("Kia Pregio (commercial)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Pregio'`);
  await deleteAndReport("Kia Rio Cross (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Rio Cross'`);
  await deleteAndReport("Kia 300e (not US)", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = '300e'`);
  await deleteAndReport("Kia Optima pre-2001", sql`DELETE FROM vehicle_fitments WHERE make = 'Kia' AND model = 'Optima' AND year < 2001`);
  await deleteAndReport("Jeep Liberty wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'Jeep' AND model = 'Liberty' AND (year < 2002 OR year > 2012)`);
  await deleteAndReport("Jeep Renegade pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'Jeep' AND model = 'Renegade' AND year < 2015`);
  await deleteAndReport("Jeep Wagoneer pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'Jeep' AND model = 'Wagoneer' AND year < 2022`);
  await deleteAndReport("Jeep Grand Wagoneer pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'Jeep' AND model = 'Grand Wagoneer' AND year < 2022`);
  await deleteAndReport("GMC Envoy pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'GMC' AND model = 'Envoy' AND year < 2002`);
  await deleteAndReport("Porsche 718 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Porsche' AND model = '718' AND year < 2017`);
  await deleteAndReport("Porsche 918 wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'Porsche' AND model = '918' AND year NOT IN (2014, 2015)`);
  await deleteAndReport("Porsche Panamera pre-2010", sql`DELETE FROM vehicle_fitments WHERE make = 'Porsche' AND model = 'Panamera' AND year < 2010`);
  await deleteAndReport("Subaru B9 Tribeca pre-2006", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model = 'B9 Tribeca' AND year < 2006`);
  await deleteAndReport("Subaru Impreza XV (JDM name)", sql`DELETE FROM vehicle_fitments WHERE make = 'Subaru' AND model = 'Impreza XV'`);
  await deleteAndReport("Jaguar XEL (China LWB)", sql`DELETE FROM vehicle_fitments WHERE make = 'Jaguar' AND model = 'XEL'`);
  await deleteAndReport("Jaguar XFL (China LWB)", sql`DELETE FROM vehicle_fitments WHERE make = 'Jaguar' AND model = 'XFL'`);
  await deleteAndReport("Jaguar X-Type 2001, 2009", sql`DELETE FROM vehicle_fitments WHERE make = 'Jaguar' AND model = 'X-Type' AND year NOT BETWEEN 2002 AND 2008`);
  await deleteAndReport("Jeep Compass pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'Jeep' AND model = 'Compass' AND year < 2007`);
  await deleteAndReport("Hyundai Amica (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Amica'`);
  await deleteAndReport("Hyundai Aslan (Korea)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Aslan'`);
  await deleteAndReport("Hyundai Custo (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Custo'`);
  await deleteAndReport("Hyundai Elantra EV (Korea)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Elantra EV'`);
  await deleteAndReport("Hyundai Encino (China Kona)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Encino'`);
  await deleteAndReport("Hyundai XG (generic)", sql`DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'XG'`);
  await deleteAndReport("Chrysler Voyager EU years", sql`DELETE FROM vehicle_fitments WHERE make = 'Chrysler' AND model = 'Voyager' AND year BETWEEN 2004 AND 2016`);
  await deleteAndReport("Chrysler Voyager post-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'Chrysler' AND model = 'Voyager' AND year > 2021`);
  await deleteAndReport("Dodge Caliber SRT post-2009", sql`DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'Caliber SRT' AND year > 2009`);
  await deleteAndReport("Dodge Magnum 2004, 2009", sql`DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'Magnum' AND year NOT BETWEEN 2005 AND 2008`);
  await deleteAndReport("Mercedes R-Class AMG wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'R-Class%AMG%' AND year != 2007`);
  await deleteAndReport("Mercedes GLS pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'GLS%' AND year < 2017`);
  await deleteAndReport("Mercedes GL pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'GL-Class%' AND year < 2007`);
  await deleteAndReport("Mercedes GLC pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'GLC%' AND year < 2016`);
  await deleteAndReport("Mercedes GLB AMG pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'GLB%AMG%' AND year < 2021`);
  await deleteAndReport("Mercedes GLE pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'GLE%' AND year < 2016`);
  await deleteAndReport("Mercedes EQC (never US)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'EQC'`);
  await deleteAndReport("Mercedes CLC (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'CLC-Class'`);
  await deleteAndReport("Mercedes C-Class All-Terrain", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'C-Class All-Terrain'`);
  await deleteAndReport("Mercedes E-Class All-Terrain pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'E-Class All-Terrain' AND year < 2022`);
  await deleteAndReport("Mercedes CLK post-2009", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'CLK%' AND year > 2009`);
  await deleteAndReport("Mercedes SLC pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'SLC%' AND year < 2017`);
  await deleteAndReport("Mercedes CLE pre-2024", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'CLE%' AND year < 2024`);
  await deleteAndReport("Mercedes AMG GT 4-Door pre-2019", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'AMG GT%4%' AND year < 2019`);
  await deleteAndReport("Mercedes EQE AMG pre-2023", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model LIKE 'EQE%AMG%' AND year < 2023`);
  await deleteAndReport("Mercedes EQS SUV pre-2023", sql`DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model = 'EQS SUV' AND year < 2023`);
  
  console.log("\n" + "=".repeat(50));
  console.log(`🎉 CLEANUP COMPLETE! Total rows deleted: ${totalDeleted}`);
  console.log("=".repeat(50));
  
  await client.end();
}

runCleanup().catch(console.error);
