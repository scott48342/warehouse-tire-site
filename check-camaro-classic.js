const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Full Camaro 67-69 record
  const camaro = await client`
    SELECT *
    FROM classic_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro'
    AND year_start <= 1969 AND year_end >= 1969
  `;
  
  console.log("Camaro 1967-1969 classic_fitments record:");
  if (camaro.length > 0) {
    const r = camaro[0];
    console.log("  rec_wheel_diameter_min:", r.rec_wheel_diameter_min);
    console.log("  rec_wheel_diameter_max:", r.rec_wheel_diameter_max);
    console.log("  rec_wheel_width_min:", r.rec_wheel_width_min);
    console.log("  rec_wheel_width_max:", r.rec_wheel_width_max);
    console.log("  rec_offset_min_mm:", r.rec_offset_min_mm);
    console.log("  rec_offset_max_mm:", r.rec_offset_max_mm);
    console.log("  stock_wheel_diameter:", r.stock_wheel_diameter);
    console.log("  stock_wheel_width:", r.stock_wheel_width);
    console.log("  common_bolt_pattern:", r.common_bolt_pattern);
    console.log("  common_center_bore:", r.common_center_bore);
  }
  
  await client.end();
}

main().catch(console.error);