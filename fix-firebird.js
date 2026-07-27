const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Check for Firebird with wrong bolt pattern
  const wrong = await client`
    SELECT year, display_trim, bolt_pattern
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'pontiac' AND LOWER(model) = 'firebird'
    AND year BETWEEN 1967 AND 2002
    AND bolt_pattern = '5x120'
    ORDER BY year
    LIMIT 10
  `;
  
  if (wrong.length > 0) {
    console.log("Firebird with 5x120 (need fixing):", wrong.length, "records");
    
    // Fix them
    const result = await client`
      UPDATE vehicle_fitments 
      SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
      WHERE LOWER(make) = 'pontiac' AND LOWER(model) = 'firebird'
      AND year BETWEEN 1967 AND 2002
      AND bolt_pattern = '5x120'
      RETURNING year, display_trim
    `;
    console.log("Fixed:", result.length, "records");
  } else {
    console.log("Firebird bolt patterns OK");
  }
  
  await client.end();
}

main().catch(console.error);