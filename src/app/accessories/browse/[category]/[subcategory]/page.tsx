/**
 * Accessories Subcategory Page
 * 
 * /accessories/browse/wheel_installation/lug_nut
 * /accessories/browse/lighting/led_pod
 */

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDbPool } from "@/lib/db/pool";
import { 
  ACCESSORY_CATEGORIES, 
  getSubTypesForCategory,
  getDbCategoryForId,
  buildAccessoryUrl 
} from "@/lib/accessories/categories";

// Force dynamic rendering - queries DB
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string; subcategory: string }>;
  searchParams: Promise<{ page?: string; brand?: string }>;
};

// Find category and subcategory info
function getCategoryInfo(categorySlug: string, subcategorySlug: string) {
  const parent = ACCESSORY_CATEGORIES.find(c => c.id === categorySlug);
  if (!parent) return null;
  
  const child = parent.children?.find(c => c.id === subcategorySlug);
  if (!child) return null;
  
  return { parent, child };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, subcategory } = await params;
  const info = getCategoryInfo(category, subcategory);
  
  if (!info) {
    return { title: "Accessories | Warehouse Tire Direct" };
  }
  
  return {
    title: `${info.child.name} | ${info.parent.name} | Warehouse Tire Direct`,
    description: `Shop ${info.child.name} for your vehicle. Quality ${info.parent.name.toLowerCase()} products at competitive prices.`,
  };
}

type AccessoryRow = {
  sku: string;
  title: string;
  brand: string | null;
  sell_price: number | null;
  msrp: number | null;
  image_url: string | null;
  in_stock: boolean;
};

async function getAccessories(
  subTypes: string[],
  dbCategory: string | null,
  page: number,
  pageSize: number,
  brand?: string
): Promise<{ items: AccessoryRow[]; total: number }> {
  const pool = getDbPool();
  if (!pool || subTypes.length === 0) return { items: [], total: 0 };

  try {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by sub_type (array match)
    const subTypePlaceholders = subTypes.map((_, i) => `$${paramIndex + i}`).join(", ");
    conditions.push(`sub_type IN (${subTypePlaceholders})`);
    params.push(...subTypes);
    paramIndex += subTypes.length;

    // Also filter by category if available
    if (dbCategory) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(dbCategory);
    }

    // Brand filter
    if (brand) {
      conditions.push(`brand = $${paramIndex++}`);
      params.push(brand);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    // Get total
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM accessories ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items
    const result = await pool.query(
      `SELECT sku, title, brand, sell_price, msrp, image_url, in_stock
       FROM accessories 
       ${where}
       ORDER BY in_stock DESC, sell_price ASC NULLS LAST
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    return { items: result.rows, total };
  } catch (e) {
    console.error("[accessories/subcategory] Error:", e);
    return { items: [], total: 0 };
  }
}

async function getBrands(subTypes: string[], dbCategory: string | null): Promise<{ value: string; count: number }[]> {
  const pool = getDbPool();
  if (!pool || subTypes.length === 0) return [];

  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const subTypePlaceholders = subTypes.map((_, i) => `$${paramIndex + i}`).join(", ");
    conditions.push(`sub_type IN (${subTypePlaceholders})`);
    params.push(...subTypes);
    paramIndex += subTypes.length;

    if (dbCategory) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(dbCategory);
    }

    conditions.push("brand IS NOT NULL");

    const result = await pool.query(`
      SELECT brand as value, COUNT(*) as count 
      FROM accessories 
      WHERE ${conditions.join(" AND ")}
      GROUP BY brand 
      ORDER BY count DESC
      LIMIT 30
    `, params);

    return result.rows.map(r => ({ value: r.value, count: parseInt(r.count) }));
  } catch {
    return [];
  }
}

export default async function AccessorySubcategoryPage({ params, searchParams }: PageProps) {
  const { category, subcategory } = await params;
  const { page: pageParam, brand } = await searchParams;
  
  const info = getCategoryInfo(category, subcategory);
  if (!info) {
    notFound();
  }
  
  const { parent, child } = info;
  const subTypes = child.subTypes || [];
  const dbCategory = getDbCategoryForId(subcategory);
  
  const page = parseInt(pageParam || "1", 10);
  const pageSize = 24;
  
  const [{ items, total }, brands] = await Promise.all([
    getAccessories(subTypes, dbCategory, page, pageSize, brand),
    getBrands(subTypes, dbCategory),
  ]);
  
  const totalPages = Math.ceil(total / pageSize);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center gap-2 text-gray-500">
          <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
          <li>/</li>
          <li><Link href="/accessories" className="hover:text-blue-600">Accessories</Link></li>
          <li>/</li>
          <li><Link href={buildAccessoryUrl(parent.id)} className="hover:text-blue-600">{parent.name}</Link></li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{child.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">{child.icon}</span>
          {child.name}
        </h1>
        <p className="mt-2 text-gray-600">
          {total.toLocaleString()} products available
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          {/* Subcategory Navigation */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {parent.icon} {parent.name}
            </h3>
            <ul className="space-y-1">
              {parent.children?.map((sub) => (
                <li key={sub.id}>
                  <Link
                    href={buildAccessoryUrl(parent.id, sub.id)}
                    className={`block px-3 py-2 rounded-lg text-sm ${
                      sub.id === subcategory
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {sub.icon} {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Brand Filter */}
          {brands.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Brand</h3>
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {brand && (
                  <li>
                    <Link
                      href={buildAccessoryUrl(category, subcategory)}
                      className="block px-3 py-1 text-sm text-red-600 hover:underline"
                    >
                      ✕ Clear filter
                    </Link>
                  </li>
                )}
                {brands.map((b) => (
                  <li key={b.value}>
                    <Link
                      href={`${buildAccessoryUrl(category, subcategory)}?brand=${encodeURIComponent(b.value)}`}
                      className={`block px-3 py-1 text-sm ${
                        brand === b.value
                          ? "text-blue-700 font-medium"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {b.value} ({b.count})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900">No products found</h2>
              <p className="text-gray-500 mt-2">Try adjusting your filters or browse another category.</p>
              <Link
                href={buildAccessoryUrl(category, subcategory)}
                className="inline-block mt-4 text-blue-600 hover:underline"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                  <Link
                    key={item.sku}
                    href={`/accessories/${item.sku}`}
                    className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-square relative mb-3 bg-gray-50 rounded-lg overflow-hidden">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-contain p-2 group-hover:scale-105 transition-transform"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl text-gray-300">
                          {child.icon}
                        </div>
                      )}
                      {!item.in_stock && (
                        <div className="absolute top-2 right-2 bg-red-100 text-red-700 text-xs px-2 py-1 rounded">
                          Out of Stock
                        </div>
                      )}
                    </div>
                    {item.brand && (
                      <div className="text-xs text-gray-500 mb-1">{item.brand}</div>
                    )}
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600">
                      {item.title}
                    </h3>
                    <div className="mt-2">
                      {item.sell_price ? (
                        <div className="text-lg font-bold text-gray-900">
                          ${Number(item.sell_price).toFixed(2)}
                        </div>
                      ) : item.msrp ? (
                        <div className="text-lg font-bold text-gray-900">
                          ${Number(item.msrp).toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Call for price</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={`${buildAccessoryUrl(category, subcategory)}?page=${page - 1}${brand ? `&brand=${brand}` : ""}`}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`${buildAccessoryUrl(category, subcategory)}?page=${page + 1}${brand ? `&brand=${brand}` : ""}`}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
