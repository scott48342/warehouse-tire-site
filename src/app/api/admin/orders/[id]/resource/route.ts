import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { checkStockBySize as checkStockUSAF } from "@/lib/usautoforce";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

type SupplierOption = {
  source: string;
  name: string;
  cost: number;
  sellPrice: number;
  quantity: number;
  autoOrder: boolean;
  partNumber: string;
};

// GET - Get alternative suppliers for order items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  
  try {
    const { rows } = await pool.query(
      `SELECT snapshot_json FROM orders WHERE id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    const snapshot = rows[0].snapshot_json;
    const lines = snapshot.lines || [];
    
    // Find tire/wheel items that can be re-sourced
    const resourcableItems = lines.filter((line: any) => 
      line.meta?.cartType === "tire" || line.meta?.cartType === "wheel"
    );
    
    const alternatives: Record<string, SupplierOption[]> = {};
    
    for (const item of resourcableItems) {
      const size = item.meta?.tireSize;
      const sku = item.sku;
      if (!size) continue;
      
      const options: SupplierOption[] = [];
      
      // Current supplier
      options.push({
        source: item.meta?.source || "unknown",
        name: formatSupplierName(item.meta?.source),
        cost: item.unitPriceUsd,
        sellPrice: item.unitPriceUsd,
        quantity: item.qty,
        autoOrder: isAutoOrderSource(item.meta?.source),
        partNumber: sku,
      });
      
      // Check USAF
      try {
        const usafResult = await checkStockUSAF(size, { quantity: item.qty });
        if (usafResult.success) {
          for (const usafItem of usafResult.items) {
            // Match by part number or similar product
            if (usafItem.partNumber === sku || 
                (usafItem.model?.toLowerCase().includes(item.name?.toLowerCase().split(' ').slice(-2).join(' ')))) {
              const totalQty = usafItem.availability.reduce((sum, a) => sum + a.quantityAvailable, 0);
              if (totalQty >= item.qty) {
                options.push({
                  source: "usautoforce",
                  name: "US AutoForce",
                  cost: usafItem.cost,
                  sellPrice: usafItem.cost + 50, // Standard markup
                  quantity: totalQty,
                  autoOrder: true,
                  partNumber: usafItem.partNumber,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("[resource] USAF check failed:", e);
      }
      
      // Note: TireWeb alternatives not shown - focus on auto-order sources (USAF)
      // TireWeb requires manual ordering anyway, so no benefit to switching TO TireWeb
      
      // Dedupe by source
      const uniqueOptions = options.filter((opt, idx, arr) => 
        arr.findIndex(o => o.source === opt.source) === idx
      );
      
      // Sort: auto-order first, then by cost
      uniqueOptions.sort((a, b) => {
        if (a.autoOrder !== b.autoOrder) return a.autoOrder ? -1 : 1;
        return a.cost - b.cost;
      });
      
      alternatives[sku] = uniqueOptions;
    }
    
    return NextResponse.json({ 
      orderId: id,
      alternatives,
    });
  } catch (err) {
    console.error("[resource] GET error:", err);
    return NextResponse.json({ error: "Failed to get alternatives" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// POST - Update order to use different supplier
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  
  try {
    const body = await request.json();
    const { sku, newSource, newPartNumber, newCost } = body;
    
    if (!sku || !newSource) {
      return NextResponse.json({ error: "Missing sku or newSource" }, { status: 400 });
    }
    
    // Get current order
    const { rows } = await pool.query(
      `SELECT snapshot_json FROM orders WHERE id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    const snapshot = rows[0].snapshot_json;
    
    // Update the line item with new source
    let updated = false;
    for (const line of snapshot.lines) {
      if (line.sku === sku) {
        line.meta = line.meta || {};
        line.meta.originalSource = line.meta.source;
        line.meta.source = newSource;
        if (newPartNumber) {
          line.meta.originalSku = line.sku;
          line.sku = newPartNumber;
        }
        if (newCost) {
          line.meta.originalPrice = line.unitPriceUsd;
          line.unitPriceUsd = newCost;
        }
        line.meta.resourcedAt = new Date().toISOString();
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      return NextResponse.json({ error: "Item not found in order" }, { status: 404 });
    }
    
    // Save updated snapshot
    await pool.query(
      `UPDATE orders SET snapshot_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(snapshot), id]
    );
    
    return NextResponse.json({ 
      success: true,
      message: `Order ${id} updated to use ${formatSupplierName(newSource)}`,
    });
  } catch (err) {
    console.error("[resource] POST error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

function formatSupplierName(source?: string): string {
  const names: Record<string, string> = {
    "tireweb:atd": "ATD",
    "tireweb:ntw": "NTW",
    "tireweb:usautoforce": "USAF (TireWeb)",
    "tireweb:km": "K&M",
    "usautoforce": "US AutoForce",
    "wheelpros": "WheelPros",
  };
  return names[source || ""] || source || "Unknown";
}

function isAutoOrderSource(source?: string): boolean {
  return source === "usautoforce" || source === "wheelpros";
}
