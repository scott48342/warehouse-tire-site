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
  // Legacy single price (kept for backward compat + simple admin entry)
  unit_price_usd: number;

  // Context applicability (what kind of quote should include this line)
  applies_tire: boolean;
  applies_wheel: boolean;
  applies_package: boolean;

  // Context prices (if null/blank, we can fall back to unit_price_usd)
  unit_price_tire_usd: number | null;
  unit_price_wheel_usd: number | null;
  unit_price_package_usd: number | null;

  // Quantity basis
  applies_to: "tire" | "wheel" | "vehicle" | "flat";

  taxable: boolean;
  default_checked: boolean;
  required: boolean;
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

      applies_tire boolean not null default true,
      applies_wheel boolean not null default true,
      applies_package boolean not null default true,

      unit_price_tire_usd numeric(12,2),
      unit_price_wheel_usd numeric(12,2),
      unit_price_package_usd numeric(12,2),

      applies_to text not null,
      taxable boolean not null default false,
      default_checked boolean not null default false,
      required boolean not null default false,
      sort_order int not null default 0,
      category text,
      active boolean not null default true,
      updated_at timestamptz not null default now()
    );

    alter table quote_catalog_items add column if not exists required boolean not null default false;

    alter table quote_catalog_items add column if not exists applies_tire boolean not null default true;
    alter table quote_catalog_items add column if not exists applies_wheel boolean not null default true;
    alter table quote_catalog_items add column if not exists applies_package boolean not null default true;

    alter table quote_catalog_items add column if not exists unit_price_tire_usd numeric(12,2);
    alter table quote_catalog_items add column if not exists unit_price_wheel_usd numeric(12,2);
    alter table quote_catalog_items add column if not exists unit_price_package_usd numeric(12,2);

    -- Best-effort: for existing rows, copy legacy price into context prices if missing.
    update quote_catalog_items
       set unit_price_tire_usd = coalesce(unit_price_tire_usd, unit_price_usd),
           unit_price_wheel_usd = coalesce(unit_price_wheel_usd, unit_price_usd),
           unit_price_package_usd = coalesce(unit_price_package_usd, unit_price_usd)
     where unit_price_usd is not null;

    create index if not exists quote_catalog_items_active_idx on quote_catalog_items (active, required, sort_order);
  `);

  // Default tax rate if not set
  await db.query({
    text: `insert into site_settings (key, value)
           values ('tax_rate', $1)
           on conflict (key) do nothing`,
    values: ["0.06"],
  });
}

export async function getSiteSetting(db: pg.Pool, key: string): Promise<string | null> {
  await ensureQuoteTables(db);
  const { rows } = await db.query({
    text: `select value from site_settings where key = $1 limit 1`,
    values: [key],
  });
  return rows?.[0]?.value ?? null;
}

export async function setSiteSetting(db: pg.Pool, key: string, value: string) {
  await ensureQuoteTables(db);
  await db.query({
    text: `insert into site_settings (key, value, updated_at)
           values ($1, $2, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
    values: [key, String(value)],
  });
}

export async function getTaxRate(db: pg.Pool): Promise<number> {
  await ensureQuoteTables(db);
  const v = await getSiteSetting(db, "tax_rate");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0.06;
}

export async function setTaxRate(db: pg.Pool, rate: number) {
  await ensureQuoteTables(db);
  const r = Number(rate);
  if (!Number.isFinite(r) || r < 0 || r > 0.2) throw new Error("invalid_tax_rate");
  await setSiteSetting(db, "tax_rate", String(r));
}

export async function listCatalogItems(db: pg.Pool): Promise<CatalogItem[]> {
  await ensureQuoteTables(db);
  const { rows } = await db.query({
    text: `
      select id, name, unit_price_usd,
             applies_tire, applies_wheel, applies_package,
             unit_price_tire_usd, unit_price_wheel_usd, unit_price_package_usd,
             applies_to, taxable, default_checked, required, sort_order, category, active
      from quote_catalog_items
      order by active desc, required desc, sort_order asc, name asc
      limit 500
    `,
    values: [],
  });
  return rows.map((r: any) => ({
    ...r,
    unit_price_usd: Number(r.unit_price_usd),
    required: !!r.required,
    applies_tire: r.applies_tire !== false,
    applies_wheel: r.applies_wheel !== false,
    applies_package: r.applies_package !== false,
    unit_price_tire_usd: r.unit_price_tire_usd != null ? Number(r.unit_price_tire_usd) : null,
    unit_price_wheel_usd: r.unit_price_wheel_usd != null ? Number(r.unit_price_wheel_usd) : null,
    unit_price_package_usd: r.unit_price_package_usd != null ? Number(r.unit_price_package_usd) : null,
  })) as CatalogItem[];
}

export async function upsertCatalogItem(db: pg.Pool, item: Omit<CatalogItem, "id"> & { id?: string }) {
  await ensureQuoteTables(db);
  const id = (item.id || `item:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).slice(0, 80);

  await db.query({
    text: `
      insert into quote_catalog_items (
        id, name, unit_price_usd,
        applies_tire, applies_wheel, applies_package,
        unit_price_tire_usd, unit_price_wheel_usd, unit_price_package_usd,
        applies_to, taxable, default_checked, required, sort_order, category, active
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      on conflict (id) do update set
        name = excluded.name,
        unit_price_usd = excluded.unit_price_usd,
        applies_tire = excluded.applies_tire,
        applies_wheel = excluded.applies_wheel,
        applies_package = excluded.applies_package,
        unit_price_tire_usd = excluded.unit_price_tire_usd,
        unit_price_wheel_usd = excluded.unit_price_wheel_usd,
        unit_price_package_usd = excluded.unit_price_package_usd,
        applies_to = excluded.applies_to,
        taxable = excluded.taxable,
        default_checked = excluded.default_checked,
        required = excluded.required,
        sort_order = excluded.sort_order,
        category = excluded.category,
        active = excluded.active,
        updated_at = now()
    `,
    values: [
      id,
      item.name,
      item.unit_price_usd,
      (item as any).applies_tire !== false,
      (item as any).applies_wheel !== false,
      (item as any).applies_package !== false,
      (item as any).unit_price_tire_usd != null ? Number((item as any).unit_price_tire_usd) : null,
      (item as any).unit_price_wheel_usd != null ? Number((item as any).unit_price_wheel_usd) : null,
      (item as any).unit_price_package_usd != null ? Number((item as any).unit_price_package_usd) : null,
      item.applies_to,
      !!item.taxable,
      !!item.default_checked,
      !!item.required,
      Math.trunc(item.sort_order || 0),
      item.category || null,
      item.active !== false,
    ],
  });

  return { id };
}
