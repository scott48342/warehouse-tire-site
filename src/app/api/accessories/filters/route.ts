/**
 * GET /api/accessories/filters
 * 
 * Returns available filter values for a category
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

// Filter configurations by category
const FILTER_CONFIG: Record<string, string[]> = {
  lug_nut: ['brand', 'thread_size', 'material', 'style', 'package_type', 'hex_size'],
  center_cap: ['brand', 'wheel_brand', 'bolt_pattern'],
  hub_ring: ['brand'],
  lighting: ['brand', 'sub_type'],
  tpms: ['brand'],
  valve_stem: ['brand'],
  spacer: ['brand'],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  
  if (!category) {
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  
  try {
    const filters: Record<string, { value: string; count: number }[]> = {};
    const filterFields = FILTER_CONFIG[category] || ['brand'];
    
    for (const field of filterFields) {
      let query: string;
      let params: any[] = [category];
      
      if (field === 'brand') {
        query = `
          SELECT brand as value, COUNT(*) as count 
          FROM accessories 
          WHERE category = $1 AND brand IS NOT NULL
          GROUP BY brand 
          ORDER BY count DESC
          LIMIT 50
        `;
      } else if (field === 'sub_type') {
        query = `
          SELECT sub_type as value, COUNT(*) as count 
          FROM accessories 
          WHERE category = $1 AND sub_type IS NOT NULL
          GROUP BY sub_type 
          ORDER BY count DESC
          LIMIT 30
        `;
      } else {
        // Dynamic field lookup
        query = `
          SELECT ${field} as value, COUNT(*) as count 
          FROM accessories 
          WHERE category = $1 AND ${field} IS NOT NULL
          GROUP BY ${field} 
          ORDER BY count DESC
          LIMIT 30
        `;
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        filters[field] = result.rows.map(r => ({
          value: r.value,
          count: parseInt(r.count)
        }));
      }
    }
    
    return NextResponse.json({ category, filters });
    
  } catch (e) {
    console.error("[accessories/filters] Error:", e);
    return NextResponse.json({ error: "Failed to fetch filters" }, { status: 500 });
  }
}
