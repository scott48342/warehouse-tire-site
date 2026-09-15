// Fitment API landing-page traffic report (first-party analytics tables).
//   node --env-file=.env.local scripts/fitment-api-traffic.mjs [--since "2026-09-14 16:20"] [--days 14]
// Shows: sessions + pageviews to /fitment-api*, by day and by referrer source,
// with a before/after split around --since (default: Reddit post time).
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1] ?? true]] : a), []),
);
const SINCE = args.since || "2026-09-14 16:20:00-04"; // Reddit post went live
const DAYS = Number(args.days || 14);

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const src = `
  CASE
    WHEN referrer ILIKE '%reddit.%' THEN 'reddit'
    WHEN referrer ILIKE '%google.%' THEN 'google'
    WHEN referrer ILIKE '%bing.%' OR referrer ILIKE '%duckduckgo%' THEN 'other-search'
    WHEN referrer ILIKE '%facebook.%' OR referrer ILIKE '%fb.%' OR referrer ILIKE '%instagram%' THEN 'facebook/ig'
    WHEN referrer ILIKE '%t.co/%' OR referrer ILIKE '%twitter.%' OR referrer ILIKE '%x.com%' THEN 'x/twitter'
    WHEN referrer ILIKE '%linkedin.%' THEN 'linkedin'
    WHEN referrer ILIKE '%shopify.%' THEN 'shopify'
    WHEN referrer ILIKE '%warehousetire%' THEN 'internal'
    WHEN referrer IS NULL OR referrer = '' THEN 'direct/none'
    ELSE 'other'
  END`;

async function main() {
  // Column discovery so this survives schema drift
  const cols = await p.query(
    `select table_name, column_name from information_schema.columns
     where table_name in ('analytics_pageviews','analytics_sessions')`,
  );
  const pv = new Set(cols.rows.filter((r) => r.table_name === "analytics_pageviews").map((r) => r.column_name));
  const ss = new Set(cols.rows.filter((r) => r.table_name === "analytics_sessions").map((r) => r.column_name));
  const pvTime = ["created_at", "viewed_at", "timestamp"].find((c) => pv.has(c));
  const ssTime = ["started_at", "created_at", "first_seen_at"].find((c) => ss.has(c));
  const ssRef = ss.has("referrer") ? "referrer" : ss.has("landing_referrer") ? "landing_referrer" : null;
  const isTest = ss.has("is_test") ? "AND COALESCE(s.is_test,false) = false" : "";
  if (!pvTime || !ssTime || !ssRef) {
    console.log("columns:", [...pv].join(","), "|", [...ss].join(","));
    throw new Error("could not map time/referrer columns");
  }

  const base = `
    FROM analytics_pageviews v
    JOIN analytics_sessions s ON s.id::text = v.session_id::text
    WHERE v.path LIKE '/fitment-api%' ${isTest}
      AND v.${pvTime} >= now() - interval '${DAYS} days'`;

  const totals = await p.query(`
    SELECT
      (v.${pvTime} >= $1::timestamptz) AS after_post,
      COUNT(*)::int AS pageviews,
      COUNT(DISTINCT v.session_id)::int AS sessions
    ${base}
    GROUP BY 1 ORDER BY 1`, [SINCE]);

  const bySource = await p.query(`
    SELECT
      (v.${pvTime} >= $1::timestamptz) AS after_post,
      ${src.replaceAll("referrer", `s.${ssRef}`)} AS source,
      COUNT(DISTINCT v.session_id)::int AS sessions,
      COUNT(*)::int AS pageviews
    ${base}
    GROUP BY 1,2 ORDER BY 1, 3 DESC`, [SINCE]);

  const byDay = await p.query(`
    SELECT to_char(date_trunc('day', v.${pvTime} AT TIME ZONE 'America/New_York'), 'Mon DD') AS day,
      COUNT(DISTINCT v.session_id)::int AS sessions,
      COUNT(*)::int AS pageviews,
      COUNT(DISTINCT v.session_id) FILTER (WHERE s.${ssRef} ILIKE '%reddit%')::int AS reddit_sessions
    ${base}
    GROUP BY date_trunc('day', v.${pvTime} AT TIME ZONE 'America/New_York')
    ORDER BY date_trunc('day', v.${pvTime} AT TIME ZONE 'America/New_York')`);

  const subpages = await p.query(`
    SELECT split_part(v.path,'?',1) AS page, COUNT(DISTINCT v.session_id)::int AS sessions
    ${base} AND v.${pvTime} >= $1::timestamptz
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [SINCE]);

  const geo = ss.has("country")
    ? await p.query(`
      SELECT COALESCE(s.country,'?') AS country, COUNT(DISTINCT v.session_id)::int AS sessions
      ${base} AND v.${pvTime} >= $1::timestamptz
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6`, [SINCE])
    : { rows: [] };

  // Conversions: keys created since post
  const keys = await p.query(
    `SELECT COUNT(*)::int AS n FROM api_keys WHERE created_at >= $1::timestamptz AND company NOT ILIKE '%internal%'`,
    [SINCE],
  ).catch(() => ({ rows: [{ n: "n/a" }] }));

  const fmt = (rows) => console.table(rows);
  console.log(`\n=== /fitment-api traffic — last ${DAYS} days — split at ${SINCE} ===`);
  console.log("\nBefore vs after post:"); fmt(totals.rows.map((r) => ({ period: r.after_post ? "AFTER" : "before", ...r, after_post: undefined })));
  console.log("\nBy source:"); fmt(bySource.rows.map((r) => ({ period: r.after_post ? "AFTER" : "before", source: r.source, sessions: r.sessions, pageviews: r.pageviews })));
  console.log("\nBy day (ET):"); fmt(byDay.rows);
  console.log("\nPages since post:"); fmt(subpages.rows);
  if (geo.rows.length) { console.log("\nCountries since post:"); fmt(geo.rows); }
  console.log(`\nNew API keys since post (non-internal): ${keys.rows[0].n}`);
  await p.end();
}

main().catch(async (e) => { console.error("ERR", e.message); await p.end(); process.exit(1); });
