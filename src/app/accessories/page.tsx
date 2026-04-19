/**
 * Accessories Browse Page
 * 
 * /accessories
 * /accessories?category=lug_nut
 * /accessories?q=gorilla
 */

import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = {
  title: "Wheel & Tire Accessories | Warehouse Tire Direct",
  description:
    "Shop lug nuts, center caps, hub rings, LED lights, TPMS sensors, and more. Quality accessories for your wheel and tire installation.",
};

// Category config
const CATEGORIES = [
  {
    id: "center_cap",
    name: "Center Caps",
    icon: "🎯",
    description: "Finish the look of your wheels",
  },
  {
    id: "lug_nut",
    name: "Lug Nuts & Locks",
    icon: "🔩",
    description: "Secure your wheels properly",
  },
  {
    id: "hub_ring",
    name: "Hub Centric Rings",
    icon: "⭕",
    description: "Eliminate wheel vibration",
  },
  {
    id: "lighting",
    name: "LED Lighting",
    icon: "💡",
    description: "LED pods, fog lights, headlights & more",
  },
  {
    id: "tpms",
    name: "TPMS Sensors",
    icon: "📊",
    description: "Tire pressure monitoring",
  },
  {
    id: "valve_stem",
    name: "Valve Stems",
    icon: "🎈",
    description: "Standard and chrome stems",
  },
  {
    id: "spacer",
    name: "Wheel Spacers",
    icon: "📏",
    description: "Wider stance and clearance",
  },
];

// Lighting subcategories
const LIGHTING_SUBCATEGORIES = [
  { id: "led_pod", name: "LED Pods", icon: "🔦" },
  { id: "fog_light", name: "Fog Lights", icon: "🌫️" },
  { id: "headlight", name: "Headlights", icon: "🔆" },
  { id: "tail_light", name: "Tail Lights", icon: "🚨" },
  { id: "rock_light", name: "Rock Lights", icon: "🪨" },
  { id: "light_bar", name: "Light Bars", icon: "📏" },
];

type AccessoryRow = {
  sku: string;
  title: string;
  brand: string | null;
  category: string;
  sell_price: number | null;
  msrp: number | null;
  image_url: string | null;
  in_stock: boolean;
};

type FilterParams = {
  brand?: string;
  thread_size?: string;
  material?: string;
  style?: string;
};

async function getAccessories(
  category?: string,
  subType?: string,
  query?: string,
  filters?: FilterParams,
  page = 1,
  pageSize = 24
): Promise<{ items: AccessoryRow[]; total: number }> {
  const pool = getDbPool();
  if (!pool) return { items: [], total: 0 };

  try {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    
    if (subType) {
      conditions.push(`sub_type = $${paramIndex++}`);
      params.push(subType);
    }

    if (query) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR brand ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`
      );
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    // Apply filters
    if (filters?.brand) {
      conditions.push(`brand = $${paramIndex++}`);
      params.push(filters.brand);
    }
    if (filters?.thread_size) {
      conditions.push(`thread_size = $${paramIndex++}`);
      params.push(filters.thread_size);
    }
    if (filters?.material) {
      conditions.push(`material = $${paramIndex++}`);
      params.push(filters.material);
    }
    if (filters?.style) {
      conditions.push(`style = $${paramIndex++}`);
      params.push(filters.style);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM accessories ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items
    const result = await pool.query(
      `SELECT sku, title, brand, category, sell_price, msrp, image_url, in_stock
       FROM accessories 
       ${where}
       ORDER BY in_stock DESC, sell_price ASC NULLS LAST
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    return { items: result.rows, total };
  } catch (e) {
    console.error("[accessories] Error:", e);
    return { items: [], total: 0 };
  }
}

async function getFilters(category: string): Promise<Record<string, { value: string; count: number }[]>> {
  const pool = getDbPool();
  if (!pool) return {};

  const filters: Record<string, { value: string; count: number }[]> = {};
  
  try {
    // Always get brands
    const brandResult = await pool.query(`
      SELECT brand as value, COUNT(*) as count 
      FROM accessories 
      WHERE category = $1 AND brand IS NOT NULL
      GROUP BY brand 
      ORDER BY count DESC
      LIMIT 30
    `, [category]);
    
    if (brandResult.rows.length > 0) {
      filters.brand = brandResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
    }
    
    // Category-specific filters
    if (category === 'lug_nut') {
      // Thread size
      const threadResult = await pool.query(`
        SELECT thread_size as value, COUNT(*) as count 
        FROM accessories 
        WHERE category = $1 AND thread_size IS NOT NULL
        GROUP BY thread_size 
        ORDER BY count DESC
        LIMIT 20
      `, [category]);
      if (threadResult.rows.length > 0) {
        filters.thread_size = threadResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
      }
      
      // Material
      const materialResult = await pool.query(`
        SELECT material as value, COUNT(*) as count 
        FROM accessories 
        WHERE category = $1 AND material IS NOT NULL
        GROUP BY material 
        ORDER BY count DESC
      `, [category]);
      if (materialResult.rows.length > 0) {
        filters.material = materialResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
      }
      
      // Style
      const styleResult = await pool.query(`
        SELECT style as value, COUNT(*) as count 
        FROM accessories 
        WHERE category = $1 AND style IS NOT NULL
        GROUP BY style 
        ORDER BY count DESC
      `, [category]);
      if (styleResult.rows.length > 0) {
        filters.style = styleResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
      }
    }
    
    // Lighting subcategories
    if (category === 'lighting') {
      const subTypeResult = await pool.query(`
        SELECT sub_type as value, COUNT(*) as count 
        FROM accessories 
        WHERE category = $1 AND sub_type IS NOT NULL
        GROUP BY sub_type 
        ORDER BY count DESC
      `, [category]);
      if (subTypeResult.rows.length > 0) {
        filters.sub_type = subTypeResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
      }
    }
    
    return filters;
  } catch (e) {
    console.error("[accessories/filters] Error:", e);
    return {};
  }
}

async function getCategoryCounts(): Promise<Record<string, number>> {
  const pool = getDbPool();
  if (!pool) return {};

  try {
    const result = await pool.query(
      `SELECT category, COUNT(*) as count FROM accessories GROUP BY category`
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.category] = parseInt(row.count);
    }
    return counts;
  } catch {
    return {};
  }
}

function AccessoryCard({ item }: { item: AccessoryRow }) {
  const price = item.sell_price || item.msrp || 0;
  const categoryInfo = CATEGORIES.find((c) => c.id === item.category);

  return (
    <Link
      href={`/accessories/${item.sku}`}
      className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">
            {categoryInfo?.icon || "📦"}
          </div>
        )}

        {/* Stock badge */}
        {item.in_stock && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
            In Stock
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {item.brand && (
          <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">
            {item.brand}
          </p>
        )}
        <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors min-h-[3rem]">
          {item.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1">{item.sku}</p>

        {/* Price */}
        <div className="mt-3">
          {price > 0 ? (
            <p className="text-lg font-bold text-gray-900">${price.toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-500">Contact for price</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    category?: string; 
    subtype?: string; 
    q?: string; 
    page?: string;
    brand?: string;
    thread_size?: string;
    material?: string;
    style?: string;
  }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const subType = params.subtype;
  const query = params.q;
  const page = parseInt(params.page || "1");
  
  // Extract filters
  const filters: FilterParams = {
    brand: params.brand,
    thread_size: params.thread_size,
    material: params.material,
    style: params.style,
  };
  const hasFilters = Object.values(filters).some(v => v);

  const [{ items, total }, categoryCounts, categoryFilters] = await Promise.all([
    getAccessories(category, subType, query, filters, page),
    getCategoryCounts(),
    category ? getFilters(category) : Promise.resolve({}),
  ]);

  const totalPages = Math.ceil(total / 24);
  const selectedCategory = CATEGORIES.find((c) => c.id === category);

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedCategory ? selectedCategory.name : "Wheel & Tire Accessories"}
        </h1>
        <p className="text-gray-600">
          {selectedCategory
            ? selectedCategory.description
            : "Lug nuts, center caps, hub rings, LED lights, and more"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar - Categories */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="sticky top-4">
            <h2 className="font-semibold text-gray-900 mb-4">Categories</h2>
            <nav className="space-y-1">
              <Link
                href="/accessories"
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  !category
                    ? "bg-orange-100 text-orange-700"
                    : "hover:bg-gray-100"
                }`}
              >
                <span>All Accessories</span>
                <span className="text-sm text-gray-500">
                  {Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
                </span>
              </Link>

              {CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <Link
                    href={`/accessories?category=${cat.id}`}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      category === cat.id && !subType
                        ? "bg-orange-100 text-orange-700"
                        : category === cat.id
                        ? "bg-orange-50 text-orange-600"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      {categoryCounts[cat.id] || 0}
                    </span>
                  </Link>
                  
                  {/* Lighting subcategories */}
                  {cat.id === "lighting" && category === "lighting" && (
                    <div className="ml-6 mt-1 space-y-1">
                      {LIGHTING_SUBCATEGORIES.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/accessories?category=lighting&subtype=${sub.id}`}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            subType === sub.id
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span>{sub.icon}</span>
                          <span>{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Search */}
            <div className="mt-6">
              <h2 className="font-semibold text-gray-900 mb-3">Search</h2>
              <form action="/accessories" method="GET">
                {category && (
                  <input type="hidden" name="category" value={category} />
                )}
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Search accessories..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </form>
            </div>
            
            {/* Filters */}
            {category && Object.keys(categoryFilters).length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Filters</h2>
                  {hasFilters && (
                    <Link 
                      href={`/accessories?category=${category}`}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      Clear All
                    </Link>
                  )}
                </div>
                
                {/* Brand Filter */}
                {categoryFilters.brand && categoryFilters.brand.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Brand</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {categoryFilters.brand.slice(0, 10).map((f) => (
                        <Link
                          key={f.value}
                          href={`/accessories?category=${category}&brand=${encodeURIComponent(f.value)}`}
                          className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                            filters.brand === f.value
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span className="truncate">{f.value}</span>
                          <span className="text-xs text-gray-400">{f.count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Thread Size Filter (Lug Nuts) */}
                {categoryFilters.thread_size && categoryFilters.thread_size.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Thread Size</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {categoryFilters.thread_size.slice(0, 12).map((f) => (
                        <Link
                          key={f.value}
                          href={`/accessories?category=${category}&thread_size=${encodeURIComponent(f.value)}`}
                          className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                            filters.thread_size === f.value
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span>{f.value}</span>
                          <span className="text-xs text-gray-400">{f.count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Material Filter */}
                {categoryFilters.material && categoryFilters.material.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Material</h3>
                    <div className="space-y-1">
                      {categoryFilters.material.map((f) => (
                        <Link
                          key={f.value}
                          href={`/accessories?category=${category}&material=${encodeURIComponent(f.value)}`}
                          className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                            filters.material === f.value
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span>{f.value}</span>
                          <span className="text-xs text-gray-400">{f.count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Style Filter */}
                {categoryFilters.style && categoryFilters.style.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Style</h3>
                    <div className="space-y-1">
                      {categoryFilters.style.map((f) => (
                        <Link
                          key={f.value}
                          href={`/accessories?category=${category}&style=${encodeURIComponent(f.value)}`}
                          className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                            filters.style === f.value
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span>{f.value}</span>
                          <span className="text-xs text-gray-400">{f.count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Lighting Sub-type Filter */}
                {categoryFilters.sub_type && categoryFilters.sub_type.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Type</h3>
                    <div className="space-y-1">
                      {categoryFilters.sub_type.map((f) => (
                        <Link
                          key={f.value}
                          href={`/accessories?category=${category}&subtype=${encodeURIComponent(f.value)}`}
                          className={`flex items-center justify-between px-2 py-1 text-sm rounded transition-colors ${
                            subType === f.value
                              ? "bg-orange-100 text-orange-700"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span className="capitalize">{f.value.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-400">{f.count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Active filters */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.brand && (
                <Link
                  href={`/accessories?category=${category}${filters.thread_size ? `&thread_size=${filters.thread_size}` : ''}${filters.material ? `&material=${filters.material}` : ''}${filters.style ? `&style=${filters.style}` : ''}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full hover:bg-orange-200"
                >
                  Brand: {filters.brand}
                  <span className="text-orange-500">×</span>
                </Link>
              )}
              {filters.thread_size && (
                <Link
                  href={`/accessories?category=${category}${filters.brand ? `&brand=${filters.brand}` : ''}${filters.material ? `&material=${filters.material}` : ''}${filters.style ? `&style=${filters.style}` : ''}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full hover:bg-orange-200"
                >
                  Thread: {filters.thread_size}
                  <span className="text-orange-500">×</span>
                </Link>
              )}
              {filters.material && (
                <Link
                  href={`/accessories?category=${category}${filters.brand ? `&brand=${filters.brand}` : ''}${filters.thread_size ? `&thread_size=${filters.thread_size}` : ''}${filters.style ? `&style=${filters.style}` : ''}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full hover:bg-orange-200"
                >
                  {filters.material}
                  <span className="text-orange-500">×</span>
                </Link>
              )}
              {filters.style && (
                <Link
                  href={`/accessories?category=${category}${filters.brand ? `&brand=${filters.brand}` : ''}${filters.thread_size ? `&thread_size=${filters.thread_size}` : ''}${filters.material ? `&material=${filters.material}` : ''}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full hover:bg-orange-200"
                >
                  {filters.style}
                  <span className="text-orange-500">×</span>
                </Link>
              )}
            </div>
          )}
          
          {/* Results count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              {total} {total === 1 ? "product" : "products"}
              {query && ` matching "${query}"`}
            </p>
          </div>

          {/* Grid */}
          {items.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <AccessoryCard key={item.sku} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-4">No accessories found</p>
              <Link
                href="/accessories"
                className="text-orange-600 hover:underline"
              >
                View all accessories
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/accessories?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    ...(query ? { q: query } : {}),
                    page: String(page - 1),
                  })}`}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}

              <span className="px-4 py-2 text-gray-600">
                Page {page} of {totalPages}
              </span>

              {page < totalPages && (
                <Link
                  href={`/accessories?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    ...(query ? { q: query } : {}),
                    page: String(page + 1),
                  })}`}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
