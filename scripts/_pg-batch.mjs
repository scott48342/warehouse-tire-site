// Helper for building multi-row INSERT parameter lists.
// Returns { sql, params } for inserting rows with given column count.

export function buildValuesPlaceholders(rowCount, colCount, startIndex = 1) {
  // Produces: ($1,$2),($3,$4)...
  const parts = [];
  let idx = startIndex;
  for (let r = 0; r < rowCount; r++) {
    const row = [];
    for (let c = 0; c < colCount; c++) row.push(`$${idx++}`);
    parts.push(`(${row.join(",")})`);
  }
  return parts.join(",\n");
}

export async function inTransaction(client, fn) {
  await client.query("begin");
  try {
    const res = await fn();
    await client.query("commit");
    return res;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw err;
  }
}
