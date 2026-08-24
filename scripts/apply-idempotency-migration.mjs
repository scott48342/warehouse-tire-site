import pg from "pg";

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Applying migration 0045_saved_quotes_idempotency.sql...");
  
  try {
    // Check if column exists
    const { rows: cols } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'saved_quotes' AND column_name = 'idempotency_key'
    `);
    
    if (cols.length > 0) {
      console.log("idempotency_key column already exists");
    } else {
      await pool.query(`ALTER TABLE saved_quotes ADD COLUMN idempotency_key TEXT`);
      console.log("Added idempotency_key column");
    }
    
    // Check if index exists
    const { rows: idxs } = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'saved_quotes' AND indexname = 'idx_saved_quotes_idempotency'
    `);
    
    if (idxs.length > 0) {
      console.log("idx_saved_quotes_idempotency index already exists");
    } else {
      await pool.query(`
        CREATE UNIQUE INDEX idx_saved_quotes_idempotency 
        ON saved_quotes(user_id, idempotency_key) 
        WHERE idempotency_key IS NOT NULL
      `);
      console.log("Created unique partial index on (user_id, idempotency_key)");
    }
    
    // Verify schema
    console.log("\nFinal saved_quotes schema:");
    const { rows: schema } = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'saved_quotes' 
      ORDER BY ordinal_position
    `);
    schema.forEach(r => console.log("  " + r.column_name + ": " + r.data_type + (r.is_nullable === "NO" ? " NOT NULL" : "")));
    
    console.log("\nIndexes:");
    const { rows: indexes } = await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'saved_quotes'
    `);
    indexes.forEach(r => console.log("  " + r.indexname + ": " + r.indexdef.substring(0, 80) + "..."));
    
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  }
  
  await pool.end();
}

run();
