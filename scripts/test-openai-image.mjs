#!/usr/bin/env node
/**
 * OpenAI Image Generation Test Script
 * 
 * Tests DALL-E 3 and gpt-image-1 models to verify API access and configuration.
 * 
 * Usage:
 *   node scripts/test-openai-image.mjs
 *   
 * Requires:
 *   OPENAI_API_KEY environment variable
 */

import OpenAI from "openai";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const MODELS_TO_TEST = [
  {
    name: "dall-e-3",
    size: "1792x1024",
    quality: "hd",
  },
  {
    name: "gpt-image-1",
    size: "1024x1024",
    quality: "auto",
  },
];

const TEST_PROMPT = "A simple red circle on a white background, minimalist, clean";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("OpenAI Image Generation Test");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY not set in environment");
    process.exit(1);
  }
  
  // Mask key for logging
  const maskedKey = apiKey.substring(0, 7) + "..." + apiKey.substring(apiKey.length - 4);
  console.log(`✅ API Key found: ${maskedKey}`);
  console.log(`   Key length: ${apiKey.length} characters`);
  console.log(`   Key prefix: ${apiKey.substring(0, 10)}`);
  console.log();

  const openai = new OpenAI({ apiKey });

  // Test each model
  for (const model of MODELS_TO_TEST) {
    console.log(`───────────────────────────────────────────────────────────────`);
    console.log(`Testing model: ${model.name}`);
    console.log(`───────────────────────────────────────────────────────────────`);
    
    const startTime = Date.now();
    
    try {
      console.log(`  Prompt: "${TEST_PROMPT}"`);
      console.log(`  Size: ${model.size}`);
      console.log(`  Quality: ${model.quality}`);
      console.log(`  Requesting...`);
      
      const params = {
        model: model.name,
        prompt: TEST_PROMPT,
        n: 1,
        size: model.size,
      };
      
      // Only add quality for dall-e-3
      if (model.name === "dall-e-3") {
        params.quality = model.quality;
      }
      
      const response = await openai.images.generate(params);
      
      const elapsed = Date.now() - startTime;
      
      console.log(`\n  ✅ SUCCESS (${elapsed}ms)`);
      console.log(`  Response shape:`);
      console.log(`    - created: ${response.created}`);
      console.log(`    - data.length: ${response.data?.length}`);
      
      if (response.data?.[0]) {
        const item = response.data[0];
        console.log(`    - has url: ${!!item.url}`);
        console.log(`    - has b64_json: ${!!item.b64_json}`);
        console.log(`    - revised_prompt: ${item.revised_prompt ? "yes" : "no"}`);
        
        if (item.url) {
          console.log(`    - url preview: ${item.url.substring(0, 80)}...`);
        }
      }
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      
      console.log(`\n  ❌ FAILED (${elapsed}ms)`);
      console.log(`  Error type: ${error.constructor.name}`);
      console.log(`  Error message: ${error.message}`);
      
      if (error.status) {
        console.log(`  HTTP status: ${error.status}`);
      }
      if (error.code) {
        console.log(`  Error code: ${error.code}`);
      }
      if (error.type) {
        console.log(`  Error type: ${error.type}`);
      }
      
      // Log full error for debugging
      if (error.error) {
        console.log(`  API error details:`, JSON.stringify(error.error, null, 2));
      }
    }
    
    console.log();
  }

  // Test API key validity with a simple models list call
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log(`Testing API key validity (list models)`);
  console.log(`───────────────────────────────────────────────────────────────`);
  
  try {
    const models = await openai.models.list();
    const imageModels = [];
    
    for await (const model of models) {
      if (model.id.includes("dall-e") || model.id.includes("image")) {
        imageModels.push(model.id);
      }
    }
    
    console.log(`  ✅ API key is valid`);
    console.log(`  Available image-related models:`);
    imageModels.forEach(m => console.log(`    - ${m}`));
    
  } catch (error) {
    console.log(`  ❌ Failed to list models`);
    console.log(`  Error: ${error.message}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Test complete");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(console.error);
