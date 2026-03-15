import pg from "pg";

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

export type CatalogItem = {
  id: string;
  name: string;
  unit_price_usd: number;
  applies_to: "tire" | "wheel" | "vehicle" | "flat";
  taxable: boolean;
  default_checked: boolean;
  sort_order: number;
  category: string | null;
  active: boolean;
};

export async function ensureQuoteTables(db: pg.Pool) {
  await db.query(`
    create table if not exists site_settings (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists quote_catalog_items (
      id text primary key,
      name text not null,
      unit_price_usd numeric(12,2) not null,
      applies_to text not null,
      taxable boolean not null default false,
      default_checked boolean not null default false,
      sort_order int not null default 0,
      category text,
      active boolean not null default true,
      updated_at timestamptz not null default now()
    );

    create index if not exists quote_catalog_items_active_idx on quote_catalog_items (active, sort_order);
  `);

  // Default tax rate if not set
  await db.query({
    text: `insert into site_settings (key, value)
           values ('tax_rate', $1)
           on conflict (key) do nothing`,
    values: ["0.06"],
  });
}

export async function getTaxRate(db: pg.Pool): Promise<number> {
  await ensureQuoteTables(db);
  const { rows } = await db.query({
    text: `select value from site_settings where key = 'tax_rate' limit 1`,
    values: [],
  });
  const v = rows?.[0]?.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0.06;
}

export async function setTaxRate(db: pg.Pool, rate: number) {
  await ensureQuoteTables(db);
  const r = Number(rate);
  if (!Number.isFinite(r) || r < 0 || r > 0.2) throw new Error("invalid_tax_rate");
  await db.query({
    text: `insert into site_settings (key, value, updated_at)
           values ('tax_rate', $1, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
    values: [String(r)],
  });
}

export async function listCatalogItems(db: pg.Pool): Promise<CatalogItem[]> {
  await ensureQuoteTables(db);
  const { rows } = await db.query({
    text: `
      select id, name, unit_price_usd, applies_to, taxable, default_checked, sort_order, category, active
      from quote_catalog_items
      order by active desc, sort_order asc, name asc
      limit 500
    `,
    values: [],
  });
  return rows.map((r: any) => ({
    ...r,
    unit_price_usd: Number(r.unit_price_usd),
  })) as CatalogItem[];
}

export async function upsertCatalogItem(db: pg.Pool, item: Omit<CatalogItem, "id"> & { id?: string }) {
  await ensureQuoteTables(db);
  const id = (item.id || `item:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).slice(0, 80);

  await db.query({
    text: `
      insert into quote_catalog_items (id, name, unit_price_usd, applies_to, taxable, default_checked, sort_order, category, active)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (id) do update set
        name = excluded.name,
        unit_price_usd = excluded.unit_price_usd,
        applies_to = excluded.applies_to,
        taxable = excluded.taxable,
        default_checked = excluded.default_checked,
        sort_order = excluded.sort_order,
        category = excluded.category,
        active = excluded.active,
        updated_at = now()
    `,
    values: [
      id,
      item.name,
      item.unit_price_usd,
      item.applies_to,
      !!item.taxable,
      !!item.default_checked,
      Math.trunc(item.sort_order || 0),
      item.category || null,
      item.active !== false,
    ],
  });

  return { id };
}
