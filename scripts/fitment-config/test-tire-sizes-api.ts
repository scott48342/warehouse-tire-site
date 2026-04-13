import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// Simulate the tire-sizes API call
async function test() {
  const baseUrl = "http://localhost:3000";
  
  console.log("Testing tire-sizes API for 2020 Toyota Camry LE...\n");
  
  // Test tire-sizes endpoint
  const tireSizesUrl = `${baseUrl}/api/vehicles/tire-sizes?year=2020&make=toyota&model=camry&modification=940e5c2264`;
  console.log("GET", tireSizesUrl);
  
  try {
    const res = await fetch(tireSizesUrl);
    const data = await res.json();
    console.log("\nResponse:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }

  // Test configurations endpoint  
  console.log("\n\nTesting configurations API...");
  const configUrl = `${baseUrl}/api/vehicles/configurations?year=2020&make=toyota&model=camry&modification=940e5c2264`;
  console.log("GET", configUrl);
  
  try {
    const res = await fetch(configUrl);
    const data = await res.json();
    console.log("\nResponse:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
