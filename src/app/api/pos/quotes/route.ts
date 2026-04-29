import { NextResponse } from "next/server";
import pg from "pg";

const { Pool } = pg;

// ============================================================================
// POS Quotes API - Save and retrieve quotes with sequential numbering
// ============================================================================

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
}

// Ensure quotes table exists
async function ensureTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_quotes (
      id SERIAL PRIMARY KEY,
      quote_number VARCHAR(20) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Customer info
      customer_name VARCHAR(255),
      customer_phone VARCHAR(50),
      customer_email VARCHAR(255),
      
      -- Vehicle
      vehicle_year VARCHAR(10),
      vehicle_make VARCHAR(100),
      vehicle_model VARCHAR(100),
      vehicle_trim VARCHAR(100),
      
      -- Full quote data (JSON blob for flexibility)
      quote_data JSONB NOT NULL,
      
      -- Totals for quick display
      out_the_door_price DECIMAL(10,2),
      
      -- Status
      status VARCHAR(20) DEFAULT 'draft',
      notes TEXT
    );
    
    -- Index for quick lookup by quote number
    CREATE INDEX IF NOT EXISTS idx_pos_quotes_number ON pos_quotes(quote_number);
    CREATE INDEX IF NOT EXISTS idx_pos_quotes_customer ON pos_quotes(customer_name, customer_phone);
    CREATE INDEX IF NOT EXISTS idx_pos_quotes_created ON pos_quotes(created_at DESC);
  `);
}

// Generate next quote number (WTD-0001, WTD-0002, etc.)
async function getNextQuoteNumber(pool: pg.Pool): Promise<string> {
  const { rows } = await pool.query(`
    SELECT quote_number FROM pos_quotes 
    WHERE quote_number LIKE 'WTD-%' 
    ORDER BY id DESC 
    LIMIT 1
  `);
  
  if (rows.length === 0) {
    return "WTD-0001";
  }
  
  const lastNumber = rows[0].quote_number;
  const match = lastNumber.match(/WTD-(\d+)/);
  if (!match) {
    return "WTD-0001";
  }
  
  const nextNum = parseInt(match[1], 10) + 1;
  return `WTD-${nextNum.toString().padStart(4, "0")}`;
}

// POST - Save a new quote
export async function POST(request: Request) {
  const pool = getPool();
  
  try {
    await ensureTable(pool);
    
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      vehicle,
      wheel,
      tire,
      selectedAddOns,
      adminSettings,
      laborTotal,
      addOnsTotal,
      discountAmount,
      discount,
      taxAmount,
      creditCardFee,
      outTheDoorPrice,
      notes,
      buildType,
      liftConfig,
    } = body;

    const quoteNumber = await getNextQuoteNumber(pool);
    
    const quoteData = {
      vehicle,
      wheel,
      tire,
      selectedAddOns,
      adminSettings,
      laborTotal,
      addOnsTotal,
      discountAmount,
      discount,
      taxAmount,
      creditCardFee,
      outTheDoorPrice,
      buildType,
      liftConfig,
    };

    const { rows } = await pool.query(
      `INSERT INTO pos_quotes (
        quote_number,
        customer_name,
        customer_phone,
        customer_email,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        vehicle_trim,
        quote_data,
        out_the_door_price,
        notes,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'saved')
      RETURNING id, quote_number, created_at`,
      [
        quoteNumber,
        customerName || null,
        customerPhone || null,
        customerEmail || null,
        vehicle?.year || null,
        vehicle?.make || null,
        vehicle?.model || null,
        vehicle?.trim || null,
        JSON.stringify(quoteData),
        outTheDoorPrice,
        notes || null,
      ]
    );

    console.log(`[pos-quotes] Saved quote ${quoteNumber}`);

    return NextResponse.json({
      success: true,
      quoteNumber: rows[0].quote_number,
      id: rows[0].id,
      createdAt: rows[0].created_at,
    });
  } catch (err: any) {
    console.error("[pos-quotes] Failed to save:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to save quote" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// GET - List quotes or get single quote by number
export async function GET(request: Request) {
  const pool = getPool();
  const { searchParams } = new URL(request.url);
  const quoteNumber = searchParams.get("number");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  
  try {
    await ensureTable(pool);
    
    // Get single quote by number
    if (quoteNumber) {
      const { rows } = await pool.query(
        `SELECT * FROM pos_quotes WHERE quote_number = $1`,
        [quoteNumber.toUpperCase()]
      );
      
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Quote not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        quote: {
          ...rows[0],
          quote_data: rows[0].quote_data,
        },
      });
    }
    
    // Search quotes
    if (search) {
      const searchPattern = `%${search}%`;
      const { rows } = await pool.query(
        `SELECT id, quote_number, created_at, customer_name, customer_phone, 
                vehicle_year, vehicle_make, vehicle_model, out_the_door_price, status
         FROM pos_quotes 
         WHERE quote_number ILIKE $1 
            OR customer_name ILIKE $1 
            OR customer_phone ILIKE $1
            OR vehicle_make ILIKE $1
            OR vehicle_model ILIKE $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [searchPattern, limit]
      );
      
      return NextResponse.json({
        success: true,
        quotes: rows,
      });
    }
    
    // List recent quotes
    const { rows } = await pool.query(
      `SELECT id, quote_number, created_at, customer_name, customer_phone,
              vehicle_year, vehicle_make, vehicle_model, out_the_door_price, status
       FROM pos_quotes 
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    return NextResponse.json({
      success: true,
      quotes: rows,
    });
  } catch (err: any) {
    console.error("[pos-quotes] Failed to fetch:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to fetch quotes" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
