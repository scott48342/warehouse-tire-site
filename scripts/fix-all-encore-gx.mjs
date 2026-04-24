import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Encore GX specs: 5x115, 70.3mm hub, M12x1.5 conical
const result = await pool.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x115',
      center_bore_mm = '70.3',
      thread_size = 'M12x1.5',
      seat_type = 'conical'
  WHERE LOWER(make) = 'buick' 
    AND LOWER(model) LIKE '%encore%gx%'
    AND (bolt_pattern IS NULL OR bolt_pattern = '')
  RETURNING year, display_trim
`);

console.log(`Updated ${result.rows.length} Encore GX records with bolt pattern 5x115`);

await pool.end();
