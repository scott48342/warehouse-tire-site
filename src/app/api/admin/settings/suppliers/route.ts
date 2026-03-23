import { NextResponse } from "next/server";
import pg from "pg";

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

/**
 * Get all suppliers
 */
export async function GET() {
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, provider, display_name, enabled, priority, config,
        api_key_env, customer_number, company_code, warehouse_codes,
        last_test_at, last_test_status, last_test_message,
        created_at, updated_at
      FROM admin_suppliers
      ORDER BY priority, display_name
    `);

    // Check which env vars are configured
    const suppliers = rows.map((s: any) => ({
      ...s,
      apiKeyConfigured: s.api_key_env ? !!process.env[s.api_key_env] : null,
    }));

    return NextResponse.json({ suppliers });
  } catch (err: any) {
    // Table might not exist yet
    if (err.message?.includes("does not exist")) {
      return NextResponse.json({ 
        suppliers: [], 
        needsMigration: true,
        debug: { error: err.message, code: err.code }
      });
    }
    console.error("[admin/settings/suppliers] GET Error:", err);
    return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Create or update a supplier
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    id,
    provider,
    displayName,
    display_name,
    enabled,
    priority,
    config,
    customerNumber,
    customer_number,
    companyCode,
    company_code,
    warehouseCodes,
    warehouse_codes,
  } = body;
  
  // Support both camelCase and snake_case
  const finalDisplayName = displayName || display_name;
  const finalCustomerNumber = customerNumber || customer_number;
  const finalCompanyCode = companyCode || company_code;
  const finalWarehouseCodes = warehouseCodes || warehouse_codes;

  if (!provider && !id) {
    return NextResponse.json({ error: "provider or id required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    let result;
    
    if (id) {
      // Update existing
      result = await pool.query(`
        UPDATE admin_suppliers SET
          display_name = COALESCE($2, display_name),
          enabled = COALESCE($3, enabled),
          priority = COALESCE($4, priority),
          config = COALESCE($5, config),
          customer_number = COALESCE($6, customer_number),
          company_code = COALESCE($7, company_code),
          warehouse_codes = COALESCE($8, warehouse_codes),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        id, 
        finalDisplayName, 
        enabled, 
        priority, 
        config ? JSON.stringify(config) : null,
        finalCustomerNumber,
        finalCompanyCode,
        finalWarehouseCodes,
      ]);
    } else {
      // Insert new
      result = await pool.query(`
        INSERT INTO admin_suppliers (
          provider, display_name, enabled, priority, config,
          customer_number, company_code, warehouse_codes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (provider) DO UPDATE SET
          display_name = COALESCE(EXCLUDED.display_name, admin_suppliers.display_name),
          enabled = COALESCE(EXCLUDED.enabled, admin_suppliers.enabled),
          priority = COALESCE(EXCLUDED.priority, admin_suppliers.priority),
          config = COALESCE(EXCLUDED.config, admin_suppliers.config),
          customer_number = COALESCE(EXCLUDED.customer_number, admin_suppliers.customer_number),
          company_code = COALESCE(EXCLUDED.company_code, admin_suppliers.company_code),
          warehouse_codes = COALESCE(EXCLUDED.warehouse_codes, admin_suppliers.warehouse_codes),
          updated_at = NOW()
        RETURNING *
      `, [
        provider, 
        finalDisplayName || provider, 
        enabled ?? false, 
        priority || 0, 
        config ? JSON.stringify(config) : '{}',
        finalCustomerNumber || null,
        finalCompanyCode || null,
        finalWarehouseCodes || null,
      ]);
    }

    // Log the change
    await pool.query(`
      INSERT INTO admin_logs (log_type, details)
      VALUES ('supplier_update', $1)
    `, [JSON.stringify({ provider: provider || result.rows[0]?.provider, enabled })]);

    return NextResponse.json({ ok: true, supplier: result.rows[0] });
  } catch (err: any) {
    console.error("[admin/settings/suppliers] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Delete a supplier
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    await pool.query(`DELETE FROM admin_suppliers WHERE id = $1`, [id]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/settings/suppliers] DELETE Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
