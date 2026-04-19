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
    description: "Light bars, pods, and rock lights",
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

async function getAccessories(
  category?: string,
  query?: string,
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

    if (query) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR brand ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`
      );
      params.push(`%${query}%`);
      paramIndex++;
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
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const query = params.q;
  const page = parseInt(params.page || "1");

  const [{ items, total }, categoryCounts] = await Promise.all([
    getAccessories(category, query, page),
    getCategoryCounts(),
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
                <Link
                  key={cat.id}
                  href={`/accessories?category=${cat.id}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    category === cat.id
                      ? "bg-orange-100 text-orange-700"
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
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
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
