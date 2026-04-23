/**
 * Gap Sweep Cleanup Script v2
 * Fixed for lowercase make names
 */

import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL);

console.log("🧹 Starting Gap Sweep Cleanup v2...\n");

let totalDeleted = 0;

async function del(description, query) {
  try {
    const result = await query;
    const count = result.count || 0;
    if (count > 0) {
      console.log(`✅ ${description}: ${count} deleted`);
      totalDeleted += count;
    }
    return count;
  } catch (err) {
    console.log(`⚠️ ${description}: ${err.message}`);
    return 0;
  }
}

// PHANTOM MODEL YEARS
console.log("=== PHANTOM MODEL YEARS ===");
await del("Cadillac SRX 2017+", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'srx' AND year > 2016`);
await del("Cadillac STS-V pre-2006", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'sts-v' AND year < 2006`);
await del("Cadillac XT5 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'xt5' AND year < 2017`);
await del("Cadillac XT6 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'xt6' AND year < 2020`);
await del("Chrysler 300C 2004", sql`DELETE FROM vehicle_fitments WHERE make = 'chrysler' AND model LIKE '300c%' AND year = 2004`);
await del("Mitsubishi 3000 GT post-1999", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model = '3000 gt' AND year > 1999`);
await del("Mitsubishi Galant post-2012", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model = 'galant' AND year > 2012`);
await del("Mitsubishi Diamante post-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model = 'diamante' AND year > 2004`);
await del("BMW X1 pre-2013", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'x1' AND year < 2013`);
await del("BMW Z3 post-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'z3' AND year > 2002`);
await del("Audi Q3 pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'q3' AND year < 2015`);
await del("Audi RS3 wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'rs3' AND year IN (2011, 2012, 2015, 2016)`);
await del("MINI pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'mini' AND model = 'cooper' AND year < 2002`);
await del("Toyota FJ Cruiser post-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'toyota' AND model = 'fj cruiser' AND year > 2014`);
await del("Nissan GT-R pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'nissan' AND model = 'gt-r' AND year < 2008`);
await del("Hyundai Entourage post-2009", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model = 'entourage' AND year > 2009`);
await del("Honda Fit wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model = 'fit' AND (year < 2007 OR year > 2020)`);
await del("VW Touareg pre-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'volkswagen' AND model = 'touareg' AND year < 2004`);
await del("Porsche 918 wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'porsche' AND model = '918' AND year NOT IN (2014, 2015)`);

// WRONG BADGES
console.log("\n=== WRONG BADGES ===");
await del("Honda NSX → Acura", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model = 'nsx'`);
await del("Honda MDX → Acura", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model = 'mdx'`);
await del("Hyundai Tuscani → Tiburon", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model = 'tuscani'`);
await del("Hyundai JM (platform code)", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model = 'jm'`);
await del("Hyundai NF (platform code)", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model = 'nf'`);
await del("Infiniti Q30 (EU only)", sql`DELETE FROM vehicle_fitments WHERE make = 'infiniti' AND model = 'q30'`);
await del("GMC Suburban (doesn't exist)", sql`DELETE FROM vehicle_fitments WHERE make = 'gmc' AND model LIKE 'suburban%'`);

// MORE PHANTOM YEARS
console.log("\n=== MORE PHANTOM YEARS ===");
await del("BMW X2 pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'x2' AND year < 2018`);
await del("BMW X7 pre-2019", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'x7' AND year < 2019`);
await del("BMW iX pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'ix' AND year < 2022`);
await del("BMW M2 pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'bmw' AND model = 'm2' AND year < 2016`);
await del("Audi RS6 wrong years", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'rs6' AND year BETWEEN 2004 AND 2019`);
await del("Audi RS7 pre-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'rs7' AND year < 2014`);
await del("Audi S3 pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 's3' AND year < 2015`);
await del("Audi SQ5 pre-2014", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'sq5' AND year < 2014`);
await del("Audi SQ7 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'sq7' AND year < 2020`);
await del("Audi SQ8 pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'sq8' AND year < 2020`);
await del("Audi Q7 pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'q7' AND year < 2007`);
await del("Lexus IS-F pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'lexus' AND model = 'is-f' AND year < 2008`);
await del("Lexus RC-F pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'lexus' AND model = 'rc-f' AND year < 2015`);
await del("Lexus TX pre-2024", sql`DELETE FROM vehicle_fitments WHERE make = 'lexus' AND model = 'tx' AND year < 2024`);
await del("Hyundai Palisade pre-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model = 'palisade' AND year < 2020`);
await del("Kia Seltos pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'kia' AND model = 'seltos' AND year < 2021`);
await del("Kia Soul pre-2010", sql`DELETE FROM vehicle_fitments WHERE make = 'kia' AND model = 'soul' AND year < 2010`);
await del("Kia Sedona pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'kia' AND model = 'sedona' AND year < 2002`);
await del("Genesis G70 pre-2019", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'g70' AND year < 2019`);
await del("Genesis G80 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'g80' AND year < 2017`);
await del("Genesis G90 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'g90' AND year < 2017`);
await del("Genesis GV70 pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'gv70' AND year < 2022`);
await del("Genesis GV80 pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'gv80' AND year < 2021`);
await del("Buick Park Avenue post-2005", sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model = 'park avenue' AND year > 2005`);
await del("Buick Rainier pre-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model = 'rainier' AND year < 2004`);
await del("Buick Rendezvous pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model = 'rendezvous' AND year < 2002`);
await del("Buick Regal TourX post-2020", sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model = 'regal tourx' AND year > 2020`);
await del("Honda HR-V pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model = 'hr-v' AND year < 2016`);
await del("Honda Ridgeline pre-2006", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model = 'ridgeline' AND year < 2006`);
await del("Subaru WRX pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'subaru' AND model LIKE '%wrx%' AND year < 2002`);
await del("Subaru STI pre-2004", sql`DELETE FROM vehicle_fitments WHERE make = 'subaru' AND model LIKE '%sti%' AND year < 2004`);
await del("Toyota Celica post-2005", sql`DELETE FROM vehicle_fitments WHERE make = 'toyota' AND model = 'celica' AND year > 2005`);
await del("Jeep Liberty wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'jeep' AND model = 'liberty' AND (year < 2002 OR year > 2012)`);
await del("Jeep Renegade pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'jeep' AND model = 'renegade' AND year < 2015`);
await del("Jeep Wagoneer pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'jeep' AND model = 'wagoneer' AND year < 2022 AND model NOT LIKE '%grand%'`);
await del("Jeep Grand Wagoneer pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'jeep' AND model = 'grand wagoneer' AND year < 2022`);
await del("Jeep Compass pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'jeep' AND model = 'compass' AND year < 2007`);
await del("GMC Envoy pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'gmc' AND model = 'envoy' AND year < 2002`);
await del("Porsche 718 pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'porsche' AND model LIKE '718%' AND year < 2017`);
await del("Porsche Panamera pre-2010", sql`DELETE FROM vehicle_fitments WHERE make = 'porsche' AND model = 'panamera' AND year < 2010`);
await del("VW Atlas pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'volkswagen' AND model = 'atlas' AND year < 2018`);
await del("MINI Clubman pre-2008", sql`DELETE FROM vehicle_fitments WHERE make = 'mini' AND model = 'clubman' AND year < 2008`);
await del("MINI Countryman pre-2011", sql`DELETE FROM vehicle_fitments WHERE make = 'mini' AND model = 'countryman' AND year < 2011`);
await del("Nissan 200SX post-1998", sql`DELETE FROM vehicle_fitments WHERE make = 'nissan' AND model = '200sx' AND year > 1998`);
await del("Nissan Kicks pre-2018", sql`DELETE FROM vehicle_fitments WHERE make = 'nissan' AND model = 'kicks' AND year < 2018`);
await del("Nissan Leaf pre-2011", sql`DELETE FROM vehicle_fitments WHERE make = 'nissan' AND model = 'leaf' AND year < 2011`);
await del("Ford Transit pre-2015", sql`DELETE FROM vehicle_fitments WHERE make = 'ford' AND model = 'transit' AND year < 2015`);
await del("Mits Lancer pre-2002", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model = 'lancer' AND year < 2002 AND model NOT LIKE '%evo%'`);
await del("Mits Evo wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model LIKE '%evolution%' AND (year < 2003 OR year = 2007 OR year > 2015)`);

// NON-US MODELS (if they exist)
console.log("\n=== NON-US MODELS ===");
await del("Cadillac SLS (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'sls'`);
await del("Cadillac GT4 (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'gt4'`);
await del("Cadillac BLS (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'cadillac' AND model = 'bls'`);
await del("Audi A7L (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'audi' AND model = 'a7l'`);
await del("Volvo EM90 (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'volvo' AND model = 'em90'`);
await del("Volvo ES90 (China)", sql`DELETE FROM vehicle_fitments WHERE make = 'volvo' AND model = 'es90'`);
await del("Mercedes T-Class (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 't-class'`);
await del("Mercedes EQC (never US)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'eqc'`);
await del("Mercedes EQT (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'eqt'`);
await del("Mercedes EQV (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'eqv'`);
await del("Lexus LBX", sql`DELETE FROM vehicle_fitments WHERE make = 'lexus' AND model = 'lbx'`);
await del("Mits JDM models", sql`DELETE FROM vehicle_fitments WHERE make = 'mitsubishi' AND model IN ('aspire', 'chariot grandis', 'debonair', 'gto', 'legnum', 'magna', 'verada', 'express')`);
await del("Honda JDM models", sql`DELETE FROM vehicle_fitments WHERE make = 'honda' AND model IN ('integra sj', 'lagreat', 'life dunk', 'orthia', 's-mx', 'e', 'fr-v', 'saber', 'z', 'domani')`);
await del("Toyota JDM models", sql`DELETE FROM vehicle_fitments WHERE make = 'toyota' AND model IN ('corolla runx', 'corolla spacio', 'corona premio', 'cresta', 'grand hiace', 'mega cruiser', 'sprinter', 'iq')`);
await del("Nissan JDM models", sql`DELETE FROM vehicle_fitments WHERE make = 'nissan' AND model IN ('sakura', 'skyline crossover', 'clipper', 'rasheen', 'presea')`);
await del("Chevrolet intl", sql`DELETE FROM vehicle_fitments WHERE make = 'chevrolet' AND model IN ('sonora', 'viva', 'tacuma', 'utility', 'onix', 'prisma', 'lova rv', 'mw', 'seeker', 'alero')`);
await del("Ford intl", sql`DELETE FROM vehicle_fitments WHERE make = 'ford' AND model IN ('fairlane', 'fairmont', 'ltd', 'ka freestyle', 'evos', 'cougar', 'fiesta ikon', 'fiesta classic')`);
await del("Buick intl", sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model IN ('allure', 'excelle xt', 'verano gs', 'verano pro gs')`);
await del("Dodge Charger Pursuit", sql`DELETE FROM vehicle_fitments WHERE make = 'dodge' AND model = 'charger pursuit'`);
await del("Dodge JC (platform)", sql`DELETE FROM vehicle_fitments WHERE make = 'dodge' AND model = 'jc'`);
await del("Land Rover EU names", sql`DELETE FROM vehicle_fitments WHERE make = 'land rover' AND model IN ('discovery 4', 'discovery 5', 'freelander 2', 'discovery-3', 'discovery-4')`);
await del("Mazda intl", sql`DELETE FROM vehicle_fitments WHERE make = 'mazda' AND model IN ('mazda3-mps', 'mazda6-mps', 'mazda6-ruiyi', 'mazda2-hybrid', 'mazdaspeed axela', 'laputa', 'spiano', 'xedos-9')`);
await del("Kia intl", sql`DELETE FROM vehicle_fitments WHERE make = 'kia' AND model IN ('tonic', 'visto', 'vigato', 'x-trek', 'potentia', 'pregio', 'rio cross', '300e', 'spectra-wing')`);
await del("Hyundai intl", sql`DELETE FROM vehicle_fitments WHERE make = 'hyundai' AND model IN ('amica', 'aslan', 'custo', 'elantra ev', 'encino', 'santro zip', 'santa fe classic', 'tiburon turbulence', 'mufasa', 'xg')`);
await del("Jaguar China LWB", sql`DELETE FROM vehicle_fitments WHERE make = 'jaguar' AND model IN ('xel', 'xfl')`);
await del("Subaru intl", sql`DELETE FROM vehicle_fitments WHERE make = 'subaru' AND model IN ('impreza anesis', 'liberty', 'impreza xv', 'pleo')`);
await del("VW intl", sql`DELETE FROM vehicle_fitments WHERE make = 'volkswagen' AND model IN ('id.4 crozz', 'xl1')`);
await del("Genesis Korea", sql`DELETE FROM vehicle_fitments WHERE make = 'genesis' AND model = 'eq900'`);

// MERCEDES WRONG YEARS
console.log("\n=== MERCEDES TIMING ===");
await del("Mercedes GLS pre-2017", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'gls%' AND year < 2017`);
await del("Mercedes GLE pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'gle%' AND year < 2016`);
await del("Mercedes GLC pre-2016", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'glc%' AND year < 2016`);
await del("Mercedes GLB AMG pre-2021", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'glb%amg%' AND year < 2021`);
await del("Mercedes GL pre-2007", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'gl-%' AND year < 2007`);
await del("Mercedes AMG GT 4D pre-2019", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'amg gt%4%' AND year < 2019`);
await del("Mercedes CLE pre-2024", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'cle%' AND year < 2024`);
await del("Mercedes E-All-Terrain pre-2022", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'e-class all-terrain' AND year < 2022`);
await del("Mercedes C-All-Terrain (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'c-class all-terrain'`);
await del("Mercedes CLC (EU)", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'clc-class'`);
await del("Mercedes R63 wrong", sql`DELETE FROM vehicle_fitments WHERE make = 'mercedes' AND model LIKE 'r-class%amg%' AND year != 2007`);

console.log("\n" + "=".repeat(50));
console.log(`🎉 CLEANUP COMPLETE! Total rows deleted: ${totalDeleted}`);
console.log("=".repeat(50));

await sql.end();
