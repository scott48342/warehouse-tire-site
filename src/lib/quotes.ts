import pg from "pg";
import crypto from "node:crypto";
import { ensureQuoteTables, getTaxRate, type CatalogItem } from "@/lib/quoteCatalog";

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

export type QuoteLine = {
  kind: "product" | "catalog" | "custom";
  name: string;
  sku?: string;
  unitPriceUsd: number;
  qty: number;
  taxable: boolean;
  meta?: Record<string, any>;
};

export type QuoteSnapshot = {
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    modification?: string;
  };
  lines: QuoteLine[];
  taxRate: number;
  totals: {
    partsSubtotal: number;
    servicesSubtotal: number;
    tax: number;
    total: number;
  };
};

export type QuoteRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_first: string;
  customer_last: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_label: string | null;
  snapshot: QuoteSnapshot;
};

function money(n: number) {
  const x = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isFinite(x) ? x : 0;
}

export async function ensureQuoteSystem(db: pg.Pool) {
  await ensureQuoteTables(db);
  await db.query(`
    create table if not exists quotes (
      id text primary key,
      customer_first text not null,
      customer_last text not null,
      customer_email text,
      customer_phone text,
      vehicle_label text,
      snapshot_json jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists quotes_updated_at_idx on quotes (updated_at desc);
    create index if not exists quotes_customer_email_idx on quotes (customer_email);
    create index if not exists quotes_customer_phone_idx on quotes (customer_phone);
  `);
}

export function vehicleLabel(v: QuoteSnapshot["vehicle"] | undefined) {
  if (!v) return "";
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export function computeTotals(lines: QuoteLine[], taxRate: number) {
  let taxableSubtotal = 0;
  let nontaxSubtotal = 0;

  for (const l of lines) {
    const ext = money((l.unitPriceUsd || 0) * (l.qty || 0));
    if (l.taxable) taxableSubtotal += ext;
    else nontaxSubtotal += ext;
  }

  const partsSubtotal = money(taxableSubtotal);
  const servicesSubtotal = money(nontaxSubtotal);
  const tax = money(partsSubtotal * (taxRate || 0));
  const total = money(partsSubtotal + servicesSubtotal + tax);

  return { partsSubtotal, servicesSubtotal, tax, total };
}

function newId() {
  // 16 bytes -> 32 hex
  return crypto.randomBytes(16).toString("hex");
}

export async function createQuote(
  db: pg.Pool,
  {
    customer,
    vehicle,
    lines,
  }: {
    customer: QuoteSnapshot["customer"];
    vehicle?: QuoteSnapshot["vehicle"];
    lines: QuoteLine[];
  }
) {
  await ensureQuoteSystem(db);

  const taxRate = await getTaxRate(db);
  const totals = computeTotals(lines, taxRate);

  const snap: QuoteSnapshot = { customer, vehicle, lines, taxRate, totals };
  const id = newId();
  const vlabel = vehicleLabel(vehicle) || null;

  await db.query({
    text: `
      insert into quotes (id, customer_first, customer_last, customer_email, customer_phone, vehicle_label, snapshot_json)
      values ($1,$2,$3,$4,$5,$6,$7)
    `,
    values: [
      id,
      customer.firstName,
      customer.lastName,
      customer.email || null,
      customer.phone || null,
      vlabel,
      JSON.stringify(snap),
    ],
  });

  return { id };
}

export async function getQuote(db: pg.Pool, id: string): Promise<QuoteRecord | null> {
  await ensureQuoteSystem(db);
  const { rows } = await db.query({
    text: `
      select id, created_at, updated_at, customer_first, customer_last, customer_email, customer_phone, vehicle_label, snapshot_json
      from quotes
      where id = $1
      limit 1
    `,
    values: [id],
  });
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    snapshot: (r.snapshot_json || {}) as QuoteSnapshot,
  } as QuoteRecord;
}

export async function listQuotes(
  db: pg.Pool,
  {
    q,
    limit,
  }: {
    q?: string;
    limit?: number;
  }
): Promise<Array<Pick<QuoteRecord, "id" | "created_at" | "updated_at" | "customer_first" | "customer_last" | "customer_email" | "customer_phone" | "vehicle_label">>> {
  await ensureQuoteSystem(db);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const query = String(q || "").trim();

  const { rows } = await db.query({
    text: `
      select id, created_at, updated_at, customer_first, customer_last, customer_email, customer_phone, vehicle_label
      from quotes
      where ($1::text is null)
         or (lower(customer_first) like lower('%' || $1 || '%'))
         or (lower(customer_last) like lower('%' || $1 || '%'))
         or (lower(coalesce(customer_email,'')) like lower('%' || $1 || '%'))
         or (coalesce(customer_phone,'') like '%' || $1 || '%')
         or (lower(coalesce(vehicle_label,'')) like lower('%' || $1 || '%'))
      order by updated_at desc
      limit $2
    `,
    values: [query ? query : null, lim],
  });

  return rows as any;
}

export function defaultLinesFromCatalog(items: CatalogItem[], wheelQty: number, tireQty: number): QuoteLine[] {
  const lines: QuoteLine[] = [];

  for (const it of items) {
    if (!it.active) continue;
    if (!it.default_checked) continue;

    const qty =
      it.applies_to === "tire"
        ? tireQty
        : it.applies_to === "wheel"
          ? wheelQty
          : 1;

    if (!qty) continue;

    lines.push({
      kind: "catalog",
      name: it.name,
      unitPriceUsd: Number(it.unit_price_usd),
      qty,
      taxable: !!it.taxable,
      meta: { catalogId: it.id, appliesTo: it.applies_to, category: it.category },
    });
  }

  return lines;
}
