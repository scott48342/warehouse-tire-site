import pg from "pg";

export type SiteRebate = {
  id: string;
  source: string;
  brand: string | null;
  headline: string;
  learn_more_url: string | null;
  form_url: string | null;
  ends_text: string | null;
  enabled: boolean;
  updated_at: string;
};

export const REBATE_SOURCE_TIRERACK = "tirerack";
export const REBATE_SOURCE_DISCOUNTTIRE = "discounttire";

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
export function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: required("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

export async function ensureRebatesTable(db: pg.Pool) {
  await db.query(`
    create table if not exists site_rebates (
      id text primary key,
      source text not null,
      brand text,
      headline text not null,
      learn_more_url text,
      form_url text,
      ends_text text,
      enabled boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists site_rebates_enabled_brand_idx on site_rebates (enabled, brand);
  `);
}

export async function listRebates(db: pg.Pool): Promise<SiteRebate[]> {
  await ensureRebatesTable(db);
  const { rows } = await db.query({
    text: `
      select id, source, brand, headline, learn_more_url, form_url, ends_text, enabled, updated_at
      from site_rebates
      order by enabled desc, updated_at desc
      limit 500
    `,
    values: [],
  });
  return rows as SiteRebate[];
}

export async function listActiveRebates(db: pg.Pool): Promise<SiteRebate[]> {
  await ensureRebatesTable(db);
  const { rows } = await db.query({
    text: `
      select id, source, brand, headline, learn_more_url, form_url, ends_text, enabled, updated_at
      from site_rebates
      where enabled = true
      order by updated_at desc
      limit 500
    `,
    values: [],
  });
  return rows as SiteRebate[];
}
