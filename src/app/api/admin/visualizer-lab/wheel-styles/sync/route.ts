/**
 * Wheel Style Sync API
 * 
 * POST: Sync wheel styles from techfeed to database
 * 
 * Actions:
 * - sync: Import/update all styles from techfeed (no classification)
 * - classify: Run AI classification on unclassified styles
 * - classify-batch: Classify a batch of styles
 * 
 * NO REGRESSION: Admin/lab API only
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb } from "@/lib/visualizer/db";
import { wheelStyleAssets } from "@/lib/visualizer/schema";
import { eq, isNull, and, count } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

interface TechfeedWheel {
  sku: string;
  style?: string;
  brand_cd?: string;
  brand_desc?: string;
  product_desc?: string;
  images?: string[];
}

interface TechfeedData {
  bySku: Record<string, TechfeedWheel>;
}

// Load wheel styles from techfeed
async function loadStylesFromTechfeed(): Promise<Map<string, {
  styleKey: string;
  brandCode: string;
  brand: string;
  model: string;
  imageUrl: string;
}>> {
  const filePath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
  const buf = await fs.readFile(filePath);
  const data: TechfeedData = JSON.parse(zlib.gunzipSync(buf).toString());
  
  const styles = new Map<string, {
    styleKey: string;
    brandCode: string;
    brand: string;
    model: string;
    imageUrl: string;
  }>();
  
  for (const wheel of Object.values(data.bySku)) {
    const styleKey = wheel.style;
    if (!styleKey || styles.has(styleKey)) continue;
    
    styles.set(styleKey, {
      styleKey,
      brandCode: wheel.brand_cd || "",
      brand: wheel.brand_desc || "",
      model: wheel.product_desc || styleKey,
      imageUrl: wheel.images?.[0] || "",
    });
  }
  
  return styles;
}

// Classify a single wheel image using OpenAI Vision
async function classifyWheelImage(imageUrl: string): Promise<{
  isFrontFacing: boolean;
  confidence: number;
  reasoning: string;
}> {
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
              text: `Analyze this automotive wheel image. Is it a FRONT-FACING view (showing the wheel face straight-on, like a product photo) or an ANGLED view (3/4 view, tilted, or showing perspective)?

Respond in JSON format:
{
  "isFrontFacing": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}

Only respond with the JSON, no other text.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 200,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
  }
  
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";
  
  try {
    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      isFrontFacing: !!parsed.isFrontFacing,
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      reasoning: parsed.reasoning || "",
    };
  } catch {
    console.error("[classify] Failed to parse response:", content);
    return { isFrontFacing: false, confidence: 0, reasoning: "Parse error" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, batchSize = 10 } = body;
    
    if (action === "sync") {
      // Sync all styles from techfeed to database
      const styles = await loadStylesFromTechfeed();
      let inserted = 0;
      let updated = 0;
      
      for (const style of styles.values()) {
        try {
          // Check if exists
          const existing = await visualizerDb
            .select()
            .from(wheelStyleAssets)
            .where(eq(wheelStyleAssets.styleKey, style.styleKey))
            .limit(1);
          
          if (existing.length === 0) {
            await visualizerDb.insert(wheelStyleAssets).values({
              styleKey: style.styleKey,
              brandCode: style.brandCode,
              brand: style.brand,
              model: style.model,
              imageUrl: style.imageUrl,
              visualizerStatus: "pending",
            });
            inserted++;
          } else {
            // Update image URL if it changed
            if (existing[0].imageUrl !== style.imageUrl && style.imageUrl) {
              await visualizerDb
                .update(wheelStyleAssets)
                .set({ 
                  imageUrl: style.imageUrl,
                  updatedAt: new Date(),
                })
                .where(eq(wheelStyleAssets.styleKey, style.styleKey));
              updated++;
            }
          }
        } catch (err) {
          console.error(`[sync] Error for ${style.styleKey}:`, err);
        }
      }
      
      return NextResponse.json({
        success: true,
        action: "sync",
        totalStyles: styles.size,
        inserted,
        updated,
      });
    }
    
    if (action === "classify" || action === "classify-batch") {
      // Get next batch of unclassified styles
      const stylesToClassify = await visualizerDb
        .select()
        .from(wheelStyleAssets)
        .where(isNull(wheelStyleAssets.isFrontFacing))
        .limit(batchSize);
      
      if (stylesToClassify.length === 0) {
        return NextResponse.json({
          success: true,
          action,
          message: "No unclassified styles found",
          classified: 0,
        });
      }
      
      const results = [];
      let frontFacingCount = 0;
      
      for (const style of stylesToClassify) {
        if (!style.imageUrl) {
          results.push({ styleKey: style.styleKey, error: "No image URL" });
          continue;
        }
        
        try {
          const classification = await classifyWheelImage(style.imageUrl);
          
          await visualizerDb
            .update(wheelStyleAssets)
            .set({
              isFrontFacing: classification.isFrontFacing,
              classificationConfidence: classification.confidence,
              visualizerStatus: classification.isFrontFacing ? "usable" : "needs_normalization",
              classifiedAt: new Date(),
              classifiedBy: "ai",
              notes: classification.reasoning,
              updatedAt: new Date(),
            })
            .where(eq(wheelStyleAssets.styleKey, style.styleKey));
          
          if (classification.isFrontFacing) frontFacingCount++;
          
          results.push({
            styleKey: style.styleKey,
            isFrontFacing: classification.isFrontFacing,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (err) {
          console.error(`[classify] Error for ${style.styleKey}:`, err);
          results.push({ 
            styleKey: style.styleKey, 
            error: err instanceof Error ? err.message : "Classification failed" 
          });
        }
      }
      
      // Get remaining count
      const [remaining] = await visualizerDb
        .select({ count: count() })
        .from(wheelStyleAssets)
        .where(isNull(wheelStyleAssets.isFrontFacing));
      
      return NextResponse.json({
        success: true,
        action,
        classified: results.filter(r => !("error" in r)).length,
        frontFacing: frontFacingCount,
        errors: results.filter(r => "error" in r).length,
        remaining: Number(remaining?.count || 0),
        results,
      });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    
  } catch (error) {
    console.error("[wheel-styles/sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return sync status / stats
  try {
    const [total] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets);
    
    const [classified] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(eq(wheelStyleAssets.classifiedBy, "ai"));
    
    const [frontFacing] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(eq(wheelStyleAssets.isFrontFacing, true));
    
    const [usable] = await visualizerDb
      .select({ count: count() })
      .from(wheelStyleAssets)
      .where(
        and(
          eq(wheelStyleAssets.isFrontFacing, true),
          eq(wheelStyleAssets.visualizerStatus, "usable")
        )
      );
    
    return NextResponse.json({
      total: Number(total?.count || 0),
      classified: Number(classified?.count || 0),
      pending: Number(total?.count || 0) - Number(classified?.count || 0),
      frontFacing: Number(frontFacing?.count || 0),
      usable: Number(usable?.count || 0),
    });
    
  } catch (error) {
    console.error("[wheel-styles/sync] GET error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
