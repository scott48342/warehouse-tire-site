const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function classifyWithAI(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Is this wheel image FRONT-FACING (showing the wheel face straight-on) or ANGLED (3/4 view, tilted)?
              
Reply with just: FRONT or ANGLED`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 10,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
  }
  
  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || "UNKNOWN";
}

async function run() {
  // Get 10 random wheel images
  const res = await pool.query(`
    SELECT style_key, brand, model, image_url 
    FROM wheel_style_assets 
    WHERE image_url IS NOT NULL AND image_url != ''
    ORDER BY RANDOM()
    LIMIT 10
  `);
  
  console.log("Testing AI classification on 10 random wheels...\n");
  
  let frontCount = 0;
  let angledCount = 0;
  
  for (const row of res.rows) {
    try {
      const result = await classifyWithAI(row.image_url);
      const isFront = result.toUpperCase().includes("FRONT");
      if (isFront) frontCount++;
      else angledCount++;
      
      console.log(`${isFront ? "✅ FRONT" : "❌ ANGLED"}: ${row.brand} ${row.model}`);
      console.log(`   ${row.image_url}\n`);
      
      // Small delay
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`⚠️ ERROR: ${row.brand} ${row.model} - ${err.message}\n`);
    }
  }
  
  console.log("\n=== SUMMARY ===");
  console.log(`Front-facing: ${frontCount}`);
  console.log(`Angled: ${angledCount}`);
  console.log(`Front-facing rate: ${((frontCount / (frontCount + angledCount)) * 100).toFixed(1)}%`);
  
  await pool.end();
}

run().catch(e => { console.error(e); pool.end(); });
