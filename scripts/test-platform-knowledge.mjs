#!/usr/bin/env node
/**
 * Test script for platform knowledge service
 * 
 * Tests:
 * 1. 98 Firebird Formula 20s - should get real guidance
 * 2. 98 Camaro Z28 staggered - should recommend staggered
 * 3. C5 Corvette wheels on Firebird - should mention overlap
 * 4. 22s on Firebird - should say "challenging but possible"
 * 5. 2024 F-150 - should have platform knowledge
 * 
 * Usage: node scripts/test-platform-knowledge.mjs
 */

// Mock imports for direct testing
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We need to compile and run the TypeScript, so let's just test via API
const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function testPlatformKnowledge() {
  console.log("\\n=== Platform Knowledge Test Suite ===\\n");
  
  const tests = [
    {
      name: "1998 Firebird Formula 20s",
      params: { year: 1998, make: "Pontiac", model: "Firebird", trim: "Formula", diameter: 20 },
      expectations: {
        shouldFind: true,
        shouldMentionFbody: true,
        shouldSay20sRealistic: true,
        shouldMentionStaggered: true,
        shouldMentionCorvette: true,
      },
    },
    {
      name: "1998 Camaro Z28 staggered",
      params: { year: 1998, make: "Chevrolet", model: "Camaro", trim: "Z28" },
      expectations: {
        shouldFind: true,
        shouldMentionFbody: true,
        shouldRecommendStaggered: true,
      },
    },
    {
      name: "2000 Camaro SS 22s",
      params: { year: 2000, make: "Chevrolet", model: "Camaro", trim: "SS", diameter: 22 },
      expectations: {
        shouldFind: true,
        feasibilityShouldBe: "challenging",
      },
    },
    {
      name: "2024 Ford F-150",
      params: { year: 2024, make: "Ford", model: "F-150" },
      expectations: {
        shouldFind: true,
        shouldHavePlatformKnowledge: true,
      },
    },
    {
      name: "2020 Dodge Challenger",
      params: { year: 2020, make: "Dodge", model: "Challenger" },
      expectations: {
        shouldFind: true,
        shouldMentionHellcat: true,
      },
    },
    {
      name: "1992 OBS Chevy C1500",
      params: { year: 1992, make: "Chevrolet", model: "C1500" },
      expectations: {
        shouldFind: true,
        shouldMentionOBS: true,
      },
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\\n--- Testing: ${test.name} ---`);
    
    try {
      const url = new URL(`${BASE_URL}/api/admin/platform-knowledge`);
      url.searchParams.set("action", "guidance");
      Object.entries(test.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      console.log("Response:", JSON.stringify(data, null, 2).slice(0, 1000));
      
      // Check expectations
      let testPassed = true;
      
      if (test.expectations.shouldFind && !data.success) {
        console.log("❌ FAIL: Expected to find platform, but didn't");
        testPassed = false;
      }
      
      if (test.expectations.shouldFind && data.success) {
        console.log("✅ Platform found:", data.platform?.name);
        
        if (test.expectations.shouldMentionFbody && !data.platform?.name?.includes("F-Body")) {
          console.log("❌ FAIL: Expected F-Body platform");
          testPassed = false;
        }
        
        if (test.expectations.shouldRecommendStaggered && !data.searchHints?.staggeredRecommended) {
          console.log("❌ FAIL: Expected staggered recommendation");
          testPassed = false;
        }
        
        if (test.expectations.feasibilityShouldBe && data.guidance?.feasibility !== test.expectations.feasibilityShouldBe) {
          console.log(`❌ FAIL: Expected feasibility "${test.expectations.feasibilityShouldBe}", got "${data.guidance?.feasibility}"`);
          testPassed = false;
        }
        
        // Check for specific mentions in cultural notes
        if (test.expectations.shouldMentionCorvette) {
          const notes = JSON.stringify(data.culturalNotes || []);
          if (!notes.toLowerCase().includes("corvette")) {
            console.log("❌ FAIL: Expected Corvette mention in cultural notes");
            testPassed = false;
          } else {
            console.log("✅ Corvette overlap mentioned");
          }
        }
        
        if (test.expectations.shouldMentionStaggered) {
          const notes = JSON.stringify(data.culturalNotes || []);
          if (!notes.toLowerCase().includes("staggered")) {
            console.log("❌ FAIL: Expected staggered mention");
            testPassed = false;
          } else {
            console.log("✅ Staggered setups mentioned");
          }
        }
        
        if (test.expectations.shouldSay20sRealistic && data.guidance) {
          const { feasibility } = data.guidance;
          if (!["recommended", "common", "possible"].includes(feasibility)) {
            console.log(`❌ FAIL: 20s should be realistic, got feasibility: ${feasibility}`);
            testPassed = false;
          } else {
            console.log(`✅ 20s are ${feasibility}`);
          }
        }
      }
      
      if (testPassed) {
        console.log(`✅ TEST PASSED: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ TEST FAILED: ${test.name}`);
        failed++;
      }
      
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\\n=== Results: ${passed} passed, ${failed} failed ===\\n`);
  
  return failed === 0;
}

// Run tests
testPlatformKnowledge()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
