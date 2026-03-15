import pg from "pg";

const { Client } = pg;

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const DATABASE_URL = required("DATABASE_URL");

const ddl = `
create table if not exists wp_wheels (
  sku text primary key,
  brand_desc text,
  brand_code_3 text,
  style text,
  display_style_no text,
  product_desc text,
  diameter_in numeric,
  width_in numeric,
  lug_count int,
  bolt_pattern_standard text,
  bolt_pattern_metric text,
  offset_mm numeric,
  backspacing_in numeric,
  centerbore_mm numeric,
  load_rating_lb int,
  image_url text,
  image_urls text[],
  msrp_usd numeric,
  map_usd numeric,
  inv_order_type text,
  division text,
  updated_at timestamptz default now(),
  raw jsonb
);

create table if not exists wp_tires (
  sku text primary key,
  brand_desc text,
  brand_code_3 text,
  tire_size text,
  simple_size text,
  tire_description text,
  load_index text,
  speed_rating text,
  section_width numeric,
  series numeric,
  rim_diameter_in numeric,
  tire_diameter_in numeric,
  image_url text,
  weight_lb numeric,
  min_width_in numeric,
  max_width_in numeric,
  max_load_lb numeric,
  terrain text,
  construction_type text,
  mileage_warranty text,
  msrp_usd numeric,
  map_usd numeric,
  inv_order_type text,
  division text,
  updated_at timestamptz default now(),
  raw jsonb
);

create table if not exists wp_accessories (
  sku text primary key,
  brand text,
  part_description text,
  image_url text,
  msrp_usd numeric,
  map_usd numeric,
  updated_at timestamptz default now(),
  raw jsonb
);

create table if not exists wp_inventory (
  sku text not null,
  product_type text not null check (product_type in ('wheel','tire','accessory')),
  location_id text not null,
  qoh int not null,
  run_date timestamptz,
  updated_at timestamptz default now(),
  primary key (sku, product_type, location_id)
);

create index if not exists wp_wheels_filter_idx on wp_wheels (bolt_pattern_standard, lug_count, diameter_in, width_in);
create index if not exists wp_wheels_offset_idx on wp_wheels (offset_mm);
create index if not exists wp_tires_filter_idx on wp_tires (simple_size, rim_diameter_in, section_width, series);
create index if not exists wp_inventory_sku_idx on wp_inventory (sku, product_type);
`;

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

console.log("Connecting...");
await client.connect();
console.log("Creating tables...");
await client.query(ddl);
console.log("Done.");
await client.end();
