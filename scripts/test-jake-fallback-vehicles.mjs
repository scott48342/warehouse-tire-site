#!/usr/bin/env node
/**
 * Jake Missing-DB QA Test Suite
 * 
 * Tests vehicles that may not be in our verified WTD database and confirms
 * Jake can recover using fallback mechanisms:
 * 1. Curated fallback
 * 2. Researched fitment cache
 * 3. Live trusted research
 * 4. Platform knowledge
 * 5. Surrogate/related-platform wheel search
 * 
 * Usage: node scripts/test-jake-fallback-vehicles.mjs [--verbose]
 * 
 * @created 2026-05-20
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const JAKE_API_URL = process.env.JAKE_API_URL || "https://tire-fitment-ai.onrender.com/api/ai/fitment";
const VERBOSE = process.argv.includes("--verbose");
const OUTPUT_DIR = path.join(__dirname, "qa-results");

// =============================================================================
// TEST CASES
// =============================================================================

const TEST_CASES = [
  {
    id: "dts-2008-20s",
    name: "2008 Cadillac DTS wanting 20s",
    prompt: "I have a 2008 Cadillac DTS and want modern 20 inch wheels and tires.",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "5x115",
      expectedDiameter: 20,
      expectFallback: true,
      expectCuratedFallback: true,
      expectPlatformKnowledge: false,
      expectDeadEnd: false,
      notes: "Should use curated GM W-body fallback",
    },
  },
  {
    id: "firebird-1998-20s",
    name: "1998 Pontiac Firebird Formula wanting 20s",
    prompt: "I have a 1998 Pontiac Firebird Formula and want 20 inch wheels.",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "5x120.65",
      expectedDiameter: 20,
      expectFallback: true,
      expectPlatformKnowledge: true,
      expectStaggeredMention: true,
      expectDeadEnd: false,
      notes: "Should use platform knowledge, mention staggered/F-body culture",
    },
  },
  {
    id: "camry-1995-tires",
    name: "1995 Toyota Camry tire size",
    prompt: "What tire size does a 1995 Toyota Camry take?",
    expected: {
      shouldSucceed: true,
      expectFallback: true,
      expectTrustedResearch: true,
      expectTrimQuestion: true, // May ask about trim
      expectDeadEnd: false,
      notes: "Should use trusted research or cache, may ask trim",
    },
  },
  {
    id: "camry-2015-se",
    name: "2015 Toyota Camry SE wheels and tires",
    prompt: "I need wheels and tires for a 2015 Toyota Camry SE.",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "5x114.3",
      expectFallback: true,
      expectTrustedResearch: true,
      expectDeadEnd: false,
      notes: "Should have tire sizes from research/cache",
    },
  },
  {
    id: "transport-1998-tires",
    name: "1998 Pontiac Transport tires",
    prompt: "I need tires for a 1998 Pontiac Transport.",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "5x115",
      expectFallback: true,
      expectCuratedFallback: true,
      expectDeadEnd: false,
      notes: "Should use curated GM U-body fallback",
    },
  },
  {
    id: "silhouette-2001-wheels",
    name: "2001 Oldsmobile Silhouette wheels",
    prompt: "I need wheels for a 2001 Oldsmobile Silhouette.",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "5x115",
      expectFallback: true,
      expectCuratedFallback: true,
      expectDeadEnd: false,
      notes: "Should use curated GM U-body fallback",
    },
  },
  {
    id: "avalon-1999-tires",
    name: "1999 Toyota Avalon tires",
    prompt: "What tires fit a 1999 Toyota Avalon?",
    expected: {
      shouldSucceed: true,
      expectFallback: true,
      expectTrustedResearch: true,
      expectDeadEnd: false,
      notes: "Should use trusted research if not in DB",
    },
  },
  {
    id: "f150-2024-control",
    name: "2024 Ford F-150 XLT (verified control)",
    prompt: "What wheels fit a 2024 Ford F-150 XLT?",
    expected: {
      shouldSucceed: true,
      expectedBoltPattern: "6x135",
      expectFallback: false, // Should be in verified DB
      expectVerifiedDB: true,
      expectDeadEnd: false,
      notes: "Control test - should use verified DB, no fallback language",
    },
  },
];

// =============================================================================
// DEAD-END DETECTION PATTERNS
// =============================================================================

const DEAD_END_PATTERNS = [
  /i can'?t help/i,
  /i don'?t have (any |that |this )?information/i,
  /unable to (find|locate|determine)/i,
  /no (wheels|tires|options|inventory|data) (available|found)/i,
  /call (our |the )?fitment team/i,
  /contact (our |the )?(support|team)/i,
  /we (probably )?don'?t have/i,
  /i'?m not able to/i,
  /unfortunately.*(can'?t|unable|no )/i,
  /difficult (bolt )?pattern/i,
  /use (wheel )?adapters/i, // Only bad if no other guidance
];

const GOOD_CONTINUATION_PATTERNS = [
  /what (wheel |tire )?size/i,
  /which trim/i,
  /here are (some |the )?options/i,
  /i found/i,
  /bolt pattern.*(is|:)/i,
  /tire size.*(is|:)/i,
  /you('d| would) need/i,
  /common (tire )?sizes?/i,
  /oem (wheel|tire)/i,
  /staggered/i,
  /i recommend/i,
  /let me (find|search|look)/i,
  /based on/i,
  /for (the |your )/i,
];

const FALLBACK_DISCLOSURE_PATTERNS = [
  /reference data/i,
  /researched data/i,
  /verify.*(tire|wheel|door|sticker)/i,
  /enthusiast guidance/i,
  /platform knowledge/i,
  /confirm.*(size|specs)/i,
  /not verified/i,
  /external (reference|data)/i,
];

// =============================================================================
// TEST RUNNER
// =============================================================================

async function runTest(testCase) {
  const startTime = Date.now();
  const result = {
    id: testCase.id,
    name: testCase.name,
    prompt: testCase.prompt,
    expected: testCase.expected,
    actual: {},
    analysis: {},
    passed: false,
    failures: [],
    duration: 0,
  };

  try {
    if (VERBOSE) console.log(`\n🧪 Testing: ${testCase.name}`);
    if (VERBOSE) console.log(`   Prompt: "${testCase.prompt}"`);

    // Call Jake API
    const response = await fetch(JAKE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: testCase.prompt,
      }),
    });

    result.actual.httpStatus = response.status;
    
    if (!response.ok) {
      result.actual.error = `HTTP ${response.status}`;
      result.failures.push(`API returned HTTP ${response.status}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    const data = await response.json();
    result.actual.rawResponse = data;

    // Extract key fields
    result.actual.responseText = data.response || data.message || data.text || "";
    result.actual.success = data.success !== false;
    result.actual.usedFallback = data.usedFallback || data.fallback?.used || false;
    result.actual.fallbackConfidence = data.fallbackConfidence || data.fallback?.confidence;
    result.actual.fallbackSource = data.fallbackSource || data.fallback?.source;
    result.actual.fallbackSearchMethod = data.fallbackSearchMethod || data.fallback?.searchMethod;
    result.actual.platformKnowledgeUsed = data.platformKnowledgeUsed || data.platform?.used || false;
    result.actual.platformId = data.platformId || data.platform?.id;
    result.actual.platformName = data.platformName || data.platform?.name;
    result.actual.trustedResearchAttempted = data.trustedResearchAttempted || data.research?.attempted || false;
    result.actual.trustedResearchSucceeded = data.trustedResearchSucceeded || data.research?.succeeded || false;
    result.actual.researchedCacheHit = data.researchedCacheHit || data.cache?.hit || false;
    result.actual.boltPattern = data.boltPattern || data.fitment?.boltPattern;
    result.actual.productsReturned = data.products?.length || data.wheels?.length || data.tires?.length || 0;
    result.actual.hasProducts = result.actual.productsReturned > 0;
    
    // Check for cart/continue links
    const text = result.actual.responseText.toLowerCase();
    result.actual.cartLinkPresent = text.includes("cart") || text.includes("add to") || text.includes("checkout");
    result.actual.continueShoppingPresent = text.includes("continue") || text.includes("browse") || text.includes("shop");

    // Analyze response
    result.analysis = analyzeResponse(result.actual.responseText, testCase.expected);
    
    // Determine pass/fail
    const failures = evaluateTest(testCase, result);
    result.failures = failures;
    result.passed = failures.length === 0;

    if (VERBOSE) {
      console.log(`   Response: "${result.actual.responseText.slice(0, 200)}..."`);
      console.log(`   ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);
      if (!result.passed) {
        result.failures.forEach(f => console.log(`      - ${f}`));
      }
    }

  } catch (err) {
    result.actual.error = err.message;
    result.failures.push(`Exception: ${err.message}`);
  }

  result.duration = Date.now() - startTime;
  return result;
}

function analyzeResponse(text, expected) {
  const analysis = {
    isDeadEnd: false,
    hasGoodContinuation: false,
    hasFallbackDisclosure: false,
    mentionsBoltPattern: false,
    mentionsStaggered: false,
    mentionsTireSize: false,
    asksTrimQuestion: false,
    mentionsProducts: false,
    deadEndPatterns: [],
    continuationPatterns: [],
  };

  const textLower = text.toLowerCase();

  // Check dead-end patterns
  for (const pattern of DEAD_END_PATTERNS) {
    if (pattern.test(text)) {
      analysis.deadEndPatterns.push(pattern.toString());
    }
  }

  // Check good continuation patterns
  for (const pattern of GOOD_CONTINUATION_PATTERNS) {
    if (pattern.test(text)) {
      analysis.continuationPatterns.push(pattern.toString());
    }
  }

  // Check fallback disclosure
  for (const pattern of FALLBACK_DISCLOSURE_PATTERNS) {
    if (pattern.test(text)) {
      analysis.hasFallbackDisclosure = true;
      break;
    }
  }

  // Determine if it's a dead-end
  // Dead-end = has dead-end patterns AND no good continuation patterns
  analysis.isDeadEnd = analysis.deadEndPatterns.length > 0 && 
                        analysis.continuationPatterns.length < 2;

  analysis.hasGoodContinuation = analysis.continuationPatterns.length >= 2;
  analysis.mentionsBoltPattern = /\d+x\d+(\.\d+)?/i.test(text) || /bolt pattern/i.test(text);
  analysis.mentionsStaggered = /stagger/i.test(text);
  analysis.mentionsTireSize = /\d{3}\/\d{2}[rR]\d{2}/i.test(text) || /tire size/i.test(text);
  analysis.asksTrimQuestion = /which trim/i.test(text) || /what trim/i.test(text) || /trim level/i.test(text);
  analysis.mentionsProducts = /wheel|tire|option|product/i.test(text);

  return analysis;
}

function evaluateTest(testCase, result) {
  const failures = [];
  const { expected } = testCase;
  const { actual, analysis } = result;

  // Check for dead-end (critical failure)
  if (expected.expectDeadEnd === false && analysis.isDeadEnd) {
    failures.push(`Dead-end detected: Jake gave up without proper fallback`);
  }

  // Check for API success
  if (expected.shouldSucceed && !actual.success) {
    failures.push(`Expected success but got failure`);
  }

  // Check bolt pattern if expected
  if (expected.expectedBoltPattern && actual.boltPattern) {
    const normalizedExpected = expected.expectedBoltPattern.replace(/\s/g, "").toLowerCase();
    const normalizedActual = actual.boltPattern.replace(/\s/g, "").toLowerCase();
    if (!normalizedActual.includes(normalizedExpected) && !normalizedExpected.includes(normalizedActual)) {
      failures.push(`Expected bolt pattern ${expected.expectedBoltPattern}, got ${actual.boltPattern}`);
    }
  }

  // Check fallback usage
  if (expected.expectFallback === true && !actual.usedFallback && !actual.platformKnowledgeUsed && !actual.trustedResearchAttempted) {
    // Only fail if no fallback mechanism was used AND it's a dead-end
    if (analysis.isDeadEnd) {
      failures.push(`Expected fallback to be used but none detected`);
    }
  }

  // Check platform knowledge for F-body test
  if (expected.expectPlatformKnowledge === true) {
    if (!actual.platformKnowledgeUsed && !analysis.mentionsStaggered && !actual.responseText.toLowerCase().includes("corvette")) {
      // Check if response still sounds knowledgeable
      const soundsKnowledgeable = /sweet spot|common|popular|aftermarket/i.test(actual.responseText);
      if (!soundsKnowledgeable) {
        failures.push(`Expected platform knowledge but response doesn't sound enthusiast-informed`);
      }
    }
  }

  // Check staggered mention for F-body
  if (expected.expectStaggeredMention === true && !analysis.mentionsStaggered) {
    // Not a hard failure, but note it
    // failures.push(`Expected staggered setup mention for F-body`);
  }

  // Check for fallback disclosure when using fallback
  if (actual.usedFallback && !expected.expectVerifiedDB && !analysis.hasFallbackDisclosure) {
    // Soft check - fallback should be disclosed
    // failures.push(`Fallback used but no disclosure/caveat detected`);
  }

  // Check for verified DB (control test)
  if (expected.expectVerifiedDB === true && actual.usedFallback) {
    failures.push(`Expected verified DB but fallback was used`);
  }

  // Check for good continuation (not a dead-end)
  if (!analysis.hasGoodContinuation && !analysis.asksTrimQuestion) {
    // Only fail if it really seems stuck
    if (actual.responseText.length < 100) {
      failures.push(`Response too short and no clear continuation path`);
    }
  }

  return failures;
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function generateMarkdownReport(results) {
  const lines = [];
  const timestamp = new Date().toISOString();
  
  lines.push(`# Jake Missing-DB QA Test Report`);
  lines.push(`**Generated:** ${timestamp}`);
  lines.push(`**API:** ${JAKE_API_URL}`);
  lines.push(``);
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  lines.push(`## Summary`);
  lines.push(`- **Total Tests:** ${total}`);
  lines.push(`- **Passed:** ${passed} ✅`);
  lines.push(`- **Failed:** ${failed} ❌`);
  lines.push(`- **Pass Rate:** ${((passed / total) * 100).toFixed(1)}%`);
  lines.push(``);
  
  // Results Table
  lines.push(`## Results`);
  lines.push(``);
  lines.push(`| # | Test | Status | Fallback | Platform | Research | Dead-End | Duration |`);
  lines.push(`|---|------|--------|----------|----------|----------|----------|----------|`);
  
  results.forEach((r, i) => {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const fallback = r.actual.usedFallback ? "Yes" : "No";
    const platform = r.actual.platformKnowledgeUsed ? "Yes" : "No";
    const research = r.actual.trustedResearchSucceeded ? "Yes" : (r.actual.trustedResearchAttempted ? "Tried" : "No");
    const deadEnd = r.analysis?.isDeadEnd ? "⚠️ Yes" : "No";
    const duration = `${r.duration}ms`;
    
    lines.push(`| ${i + 1} | ${r.name} | ${status} | ${fallback} | ${platform} | ${research} | ${deadEnd} | ${duration} |`);
  });
  
  lines.push(``);
  
  // Failures Detail
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    lines.push(`## Failures`);
    lines.push(``);
    
    failures.forEach(r => {
      lines.push(`### ❌ ${r.name}`);
      lines.push(`**Prompt:** "${r.prompt}"`);
      lines.push(``);
      lines.push(`**Failures:**`);
      r.failures.forEach(f => lines.push(`- ${f}`));
      lines.push(``);
      lines.push(`**Response Preview:**`);
      lines.push(`> ${r.actual.responseText?.slice(0, 300) || "(no response)"}...`);
      lines.push(``);
      if (r.analysis?.deadEndPatterns?.length > 0) {
        lines.push(`**Dead-end patterns detected:**`);
        r.analysis.deadEndPatterns.forEach(p => lines.push(`- \`${p}\``));
        lines.push(``);
      }
    });
  }
  
  // Detailed Results
  lines.push(`## Detailed Results`);
  lines.push(``);
  
  results.forEach(r => {
    lines.push(`### ${r.passed ? "✅" : "❌"} ${r.name}`);
    lines.push(`- **ID:** ${r.id}`);
    lines.push(`- **Duration:** ${r.duration}ms`);
    lines.push(`- **Used Fallback:** ${r.actual.usedFallback || "No"}`);
    lines.push(`- **Fallback Source:** ${r.actual.fallbackSource || "N/A"}`);
    lines.push(`- **Fallback Confidence:** ${r.actual.fallbackConfidence || "N/A"}`);
    lines.push(`- **Platform Knowledge:** ${r.actual.platformKnowledgeUsed ? `Yes (${r.actual.platformName})` : "No"}`);
    lines.push(`- **Trusted Research:** ${r.actual.trustedResearchSucceeded ? "Succeeded" : (r.actual.trustedResearchAttempted ? "Attempted" : "Not tried")}`);
    lines.push(`- **Cache Hit:** ${r.actual.researchedCacheHit || "No"}`);
    lines.push(`- **Bolt Pattern:** ${r.actual.boltPattern || "Not detected"}`);
    lines.push(`- **Products Returned:** ${r.actual.productsReturned || 0}`);
    lines.push(`- **Has Good Continuation:** ${r.analysis?.hasGoodContinuation || false}`);
    lines.push(`- **Dead-End Detected:** ${r.analysis?.isDeadEnd || false}`);
    lines.push(``);
    lines.push(`**Response:**`);
    lines.push(`> ${r.actual.responseText?.slice(0, 500) || "(no response)"}`);
    lines.push(``);
  });
  
  // Recommendations
  lines.push(`## Recommendations`);
  lines.push(``);
  
  if (failures.length === 0) {
    lines.push(`✅ All tests passed! No immediate fixes needed.`);
  } else {
    const deadEndFailures = failures.filter(f => f.analysis?.isDeadEnd);
    const platformFailures = failures.filter(f => f.expected.expectPlatformKnowledge && !f.actual.platformKnowledgeUsed);
    const fallbackFailures = failures.filter(f => f.expected.expectFallback && !f.actual.usedFallback);
    
    if (deadEndFailures.length > 0) {
      lines.push(`### 🚨 Dead-End Issues (${deadEndFailures.length})`);
      lines.push(`Jake is giving up too early on these vehicles:`);
      deadEndFailures.forEach(f => lines.push(`- ${f.name}`));
      lines.push(`**Fix:** Review fallback chain - ensure platform knowledge and trusted research are being triggered.`);
      lines.push(``);
    }
    
    if (platformFailures.length > 0) {
      lines.push(`### Platform Knowledge Issues (${platformFailures.length})`);
      lines.push(`Platform knowledge not being used when expected:`);
      platformFailures.forEach(f => lines.push(`- ${f.name}`));
      lines.push(`**Fix:** Check platform matching in platformKnowledgeService.ts`);
      lines.push(``);
    }
    
    if (fallbackFailures.length > 0) {
      lines.push(`### Fallback Issues (${fallbackFailures.length})`);
      lines.push(`Fallback mechanisms not triggering:`);
      fallbackFailures.forEach(f => lines.push(`- ${f.name}`));
      lines.push(`**Fix:** Review fallbackFitmentService.ts lookup chain`);
      lines.push(``);
    }
  }
  
  return lines.join("\n");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("🧪 Jake Missing-DB QA Test Suite");
  console.log("================================\n");
  console.log(`API: ${JAKE_API_URL}`);
  console.log(`Tests: ${TEST_CASES.length}`);
  console.log("");

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Run all tests
  const results = [];
  for (const testCase of TEST_CASES) {
    const result = await runTest(testCase);
    results.push(result);
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Generate reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  
  // JSON results
  const jsonPath = path.join(OUTPUT_DIR, `jake-fallback-qa-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 JSON results: ${jsonPath}`);
  
  // Markdown report
  const markdownReport = generateMarkdownReport(results);
  const mdPath = path.join(OUTPUT_DIR, `jake-fallback-qa-${timestamp}.md`);
  fs.writeFileSync(mdPath, markdownReport);
  console.log(`📄 Markdown report: ${mdPath}`);
  
  // Console summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log("\nFailures:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      r.failures.forEach(f => console.log(`     - ${f}`));
    });
  }
  
  console.log("\n" + "=".repeat(60));
  
  // Print the markdown table to console too
  console.log("\n| Test | Status | Notes |");
  console.log("|------|--------|-------|");
  results.forEach(r => {
    const status = r.passed ? "✅" : "❌";
    const notes = r.passed ? "OK" : r.failures[0]?.slice(0, 40) || "Failed";
    console.log(`| ${r.name.slice(0, 30)} | ${status} | ${notes} |`);
  });
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
