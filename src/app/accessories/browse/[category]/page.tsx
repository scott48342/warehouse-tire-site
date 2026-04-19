/**
 * Accessories Category Page
 * 
 * /accessories/browse/wheel_installation
 * /accessories/browse/lighting
 */

import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDbPool } from "@/lib/db/pool";
import { 
  ACCESSORY_CATEGORIES, 
  buildAccessoryUrl 
} from "@/lib/accessories/categories";

type PageProps = {
  params: Promise<{ category: string }>;
};

// Find category info
function getCategoryInfo(categorySlug: string) {
  return ACCESSORY_CATEGORIES.find(c => c.id === categorySlug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const info = getCategoryInfo(category);
  
  if (!info) {
    return { title: "Accessories | Warehouse Tire Direct" };
  }
  
  return {
    title: `${info.name} | Accessories | Warehouse Tire Direct`,
    description: info.description,
  };
}

// Get counts for each subcategory (only in-stock items)
async function getSubcategoryCounts(parentId: string) {
  const parent = ACCESSORY_CATEGORIES.find(c => c.id === parentId);
  if (!parent?.children) return {};
  
  const pool = getDbPool();
  if (!pool) return {};

  const counts: Record<string, number> = {};
  
  for (const child of parent.children) {
    if (!child.subTypes?.length) continue;
    
    const placeholders = child.subTypes.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM accessories WHERE sub_type IN (${placeholders}) AND in_stock = true`,
        child.subTypes
      );
      counts[child.id] = parseInt(result.rows[0].count);
    } catch {
      counts[child.id] = 0;
    }
  }
  
  return counts;
}

// Get a sample image for each subcategory (from in-stock items)
async function getSampleImages(parentId: string) {
  const parent = ACCESSORY_CATEGORIES.find(c => c.id === parentId);
  if (!parent?.children) return {};
  
  const pool = getDbPool();
  if (!pool) return {};

  const images: Record<string, string | null> = {};
  
  for (const child of parent.children) {
    if (!child.subTypes?.length) continue;
    
    const placeholders = child.subTypes.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const result = await pool.query(
        `SELECT image_url FROM accessories 
         WHERE sub_type IN (${placeholders}) AND image_url IS NOT NULL AND in_stock = true
         LIMIT 1`,
        child.subTypes
      );
      images[child.id] = result.rows[0]?.image_url || null;
    } catch {
      images[child.id] = null;
    }
  }
  
  return images;
}

export default async function AccessoryCategoryPage({ params }: PageProps) {
  const { category } = await params;
  
  const info = getCategoryInfo(category);
  if (!info) {
    notFound();
  }
  
  const [counts, images] = await Promise.all([
    getSubcategoryCounts(category),
    getSampleImages(category),
  ]);
  
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center gap-2 text-gray-500">
          <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
          <li>/</li>
          <li><Link href="/accessories" className="hover:text-blue-600">Accessories</Link></li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{info.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">{info.icon}</span>
          {info.name}
        </h1>
        <p className="mt-2 text-gray-600 text-lg">{info.description}</p>
        <p className="mt-1 text-gray-500">
          {totalCount.toLocaleString()} products across {info.children?.length || 0} categories
        </p>
      </div>

      {/* Subcategory Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {info.children?.map((sub) => (
          <Link
            key={sub.id}
            href={buildAccessoryUrl(info.id, sub.id)}
            className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-all hover:border-blue-200"
          >
            <div className="aspect-square relative mb-4 bg-gray-50 rounded-xl overflow-hidden">
              {images[sub.id] ? (
                <Image
                  src={images[sub.id]!}
                  alt={sub.name}
                  fill
                  className="object-contain p-4 group-hover:scale-105 transition-transform"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-6xl opacity-50">
                  {sub.icon}
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 flex items-center gap-2">
              <span>{sub.icon}</span>
              {sub.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {counts[sub.id]?.toLocaleString() || 0} products
            </p>
          </Link>
        ))}
      </div>

      {/* Other Categories */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Browse Other Categories
        </h2>
        <div className="flex flex-wrap gap-4">
          {ACCESSORY_CATEGORIES.filter(c => c.id !== category).map((cat) => (
            <Link
              key={cat.id}
              href={buildAccessoryUrl(cat.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              {cat.icon} {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
