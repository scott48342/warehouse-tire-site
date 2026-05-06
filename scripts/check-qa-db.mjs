import pg from 'pg';

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

try {
  // Check runs
  const runs = await pool.query(`
    SELECT run_id, started_at, status, vehicle_count, pass_rate, critical_failures 
    FROM qa_runs 
    ORDER BY started_at DESC 
    LIMIT 3
  `);
  console.log('Recent QA Runs:');
  for (const r of runs.rows) {
    console.log(`  ${r.run_id.substr(0,8)} | ${r.started_at.toISOString().substr(0,16)} | ${r.status} | ${r.vehicle_count} vehicles | ${r.pass_rate}% | ${r.critical_failures} critical`);
  }
  
  // Check results breakdown
  const results = await pool.query(`
    SELECT status, severity, failure_type, COUNT(*) as count 
    FROM qa_results 
    GROUP BY status, severity, failure_type 
    ORDER BY status, severity
  `);
  console.log('\nResults Breakdown:');
  for (const r of results.rows) {
    console.log(`  ${r.status} / ${r.severity || 'null'} / ${r.failure_type || 'null'}: ${r.count}`);
  }
  
  // Check category stats
  const cats = await pool.query(`
    SELECT category, 
      COUNT(*) as total, 
      COUNT(*) FILTER (WHERE status = 'pass') as passed,
      COUNT(*) FILTER (WHERE status = 'fail') as failed
    FROM qa_results 
    GROUP BY category
  `);
  console.log('\nCategory Stats:');
  for (const c of cats.rows) {
    console.log(`  ${c.category}: ${c.passed}/${c.total} passed, ${c.failed} failed`);
  }

  // Check staggered detection accuracy
  const staggered = await pool.query(`
    SELECT year, make, model, trim, staggered_expected, staggered_detected, staggered_mismatch
    FROM qa_results
    WHERE category = 'staggered'
    ORDER BY year DESC, make, model
    LIMIT 10
  `);
  console.log('\nStaggered Detection (last 10):');
  for (const s of staggered.rows) {
    const match = s.staggered_mismatch ? '❌' : '✓';
    console.log(`  ${s.year} ${s.make} ${s.model} ${s.trim || ''}: expected=${s.staggered_expected}, detected=${s.staggered_detected} ${match}`);
  }

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
