/**
 * Audit api_access_requests against the anti-spam scorer.
 *
 *   node scripts/fitment-api-spam-audit.mjs            # dry run: show what would be rejected
 *   node scripts/fitment-api-spam-audit.mjs --apply    # mark spam as rejected (never deletes)
 *
 * Only PENDING rows are touched. Rejected rows get review_notes so the
 * cleanup is auditable and reversible (set status back to 'pending').
 */
import 'dotenv/config';
import pg from 'pg';

// Inline copy of the scorer's offline layers (no Turnstile / timing available for historical rows)
const VOWELS = new Set('aeiouy');
function gibberishScore(raw) {
  const s = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (s.length < 4) return 0;
  let vowels = 0, maxRun = 0, run = 0;
  for (const ch of s) {
    if (VOWELS.has(ch)) { vowels++; run = 0; } else { run++; if (run > maxRun) maxRun = run; }
  }
  const ratio = vowels / s.length;
  let score = 0;
  if (ratio < 0.2) score += 0.5; else if (ratio < 0.28) score += 0.25;
  if (maxRun >= 5) score += 0.4; else if (maxRun >= 4) score += 0.2;
  const flips = (raw.match(/[a-z][A-Z]|[A-Z][a-z][A-Z]/g) || []).length;
  if (!raw.includes(' ') && raw.length >= 12 && flips >= 4) score += 0.5;
  return Math.min(1, score);
}
const core = (c) => c.replace(/\b(llc|inc|co|corp|ltd|gmbh|plc|llp)\b\.?/gi, '').trim();
const dottedGmail = (e) => {
  const [l, d] = e.toLowerCase().split('@');
  if (!d || !/^(gmail|googlemail)\.com$/.test(d)) return false;
  const dots = (l.match(/\./g) || []).length;
  return dots >= 3 || (dots >= 2 && l.length <= 14);
};
const domainLabel = (u) => { try { return new URL(u.includes('://') ? u : 'https://' + u).hostname.replace(/^www\./, '').split('.')[0]; } catch { return u; } };

function score(r) {
  let s = 0; const why = [];
  const cg = gibberishScore(core(r.company || ''));
  if (cg >= 0.5) { s += 3; why.push('company'); } else if (cg >= 0.25) { s += 1; why.push('company?'); }
  if (r.use_case_details) {
    const dg = gibberishScore(r.use_case_details);
    const words = r.use_case_details.trim().split(/\s+/).length;
    if (dg >= 0.5 || (words === 1 && r.use_case_details.length >= 12)) { s += 3; why.push('details'); }
  }
  if (r.website && gibberishScore(domainLabel(r.website)) >= 0.5) { s += 2; why.push('domain'); }
  if (dottedGmail(r.email || '')) { s += 2; why.push('dotted-gmail'); }
  if (/@(vtext\.com|tmomail\.net|txt\.att\.net|messaging\.sprintpcs\.com)$/i.test(r.email || '')) { s += 3; why.push('sms-gw'); }
  // historical rows have no form timestamp → same +2 the live route applies to direct POSTs
  s += 2; why.push('no-ts');
  return { s, why };
}

const THRESHOLD = 5;
const apply = process.argv.includes('--apply');
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query(`SELECT id, name, email, company, website, use_case_details, expected_usage, created_at FROM api_access_requests WHERE status = 'pending' ORDER BY created_at`);
const spam = [], clean = [];
for (const r of rows) { const { s, why } = score(r); (s >= THRESHOLD ? spam : clean).push({ ...r, s, why }); }

console.log(`Pending: ${rows.length}  →  spam: ${spam.length}  clean: ${clean.length}\n`);
console.log('=== KEEP (clean) ===');
for (const r of clean) console.log(`  ${r.created_at.toISOString().slice(0, 10)} | ${r.company} | ${r.email} | ${r.website || '-'} | ${r.expected_usage} | score ${r.s} [${r.why}]`);
console.log('\n=== REJECT sample (first 5 of ' + spam.length + ') ===');
for (const r of spam.slice(0, 5)) console.log(`  ${r.company} | ${r.email} | score ${r.s} [${r.why}]`);
const lowest = spam.reduce((m, r) => (r.s < m.s ? r : m), spam[0]);
if (lowest) console.log(`\n  weakest spam match: ${lowest.company} | ${lowest.email} | score ${lowest.s} [${lowest.why}]`);

if (apply && spam.length) {
  const ids = spam.map((r) => r.id);
  const res = await pool.query(
    `UPDATE api_access_requests SET status = 'rejected', reviewed_by = 'auto-spam-filter', reviewed_at = NOW(), review_notes = 'Auto-rejected: bot spam (2026-09-14 cleanup, scorer v1)', updated_at = NOW() WHERE id = ANY($1) AND status = 'pending'`,
    [ids]
  );
  console.log(`\n✓ Marked ${res.rowCount} requests as rejected.`);
} else if (!apply) {
  console.log('\n(dry run — pass --apply to mark spam as rejected)');
}
await pool.end();
