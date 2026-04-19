/**
 * Accessory Product Detail Page
 * 
 * /accessories/[sku]
 * 
 * Displays center caps, lug nuts, hub rings, lights, TPMS, valve stems
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDbPool } from "@/lib/db/pool";
import { AccessoryAddToCartButton } from "@/components/AccessoryAddToCartButton";
import type { AccessoryCategory } from "@/lib/cart/accessoryTypes";

// Placeholder images by category
const CATEGORY_IMAGES: Record<string, string> = {
  center_cap: "/images/accessories/center-cap-placeholder.jpg",
  lug_nut: "/images/accessories/lug-nut-placeholder.jpg",
  hub_ring: "/images/accessories/hub-ring-placeholder.jpg",
  lighting: "/images/accessories/led-light-placeholder.jpg",
  tpms: "/images/accessories/tpms-placeholder.jpg",
  valve_stem: "/images/accessories/valve-stem-placeholder.jpg",
  spacer: "/images/accessories/spacer-placeholder.jpg",
  other: "/images/accessories/accessory-placeholder.jpg",
};

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  center_cap: "Center Caps",
  lug_nut: "Lug Nuts",
  hub_ring: "Hub Centric Rings",
  lighting: "LED Lighting",
  tpms: "TPMS Sensors",
  valve_stem: "Valve Stems",
  spacer: "Wheel Spacers",
  other: "Accessories",
};

type Accessory = {
  sku: string;
  title: string;
  brand: string | null;
  brand_code: string | null;
  category: string;
  sub_type: string | null;
  msrp: number | null;
  map_price: number | null;
  sell_price: number | null;
  cost: number | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  in_stock: boolean;
  thread_size: string | null;
  seat_type: string | null;
  outer_diameter: number | null;
  inner_diameter: number | null;
  bolt_pattern: string | null;
  wheel_brand: string | null;
  description: string | null;
};

async function getAccessory(sku: string): Promise<Accessory | null> {
  const pool = getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT * FROM accessories WHERE sku = $1`,
      [sku]
    );
    return result.rows[0] || null;
  } catch (e) {
    console.error("[accessories/sku] Error:", e);
    return null;
  }
}

/**
 * Generate rich description based on product data
 */
function generateDescription(acc: Accessory): string {
  const parts: string[] = [];

  switch (acc.category) {
    case "center_cap":
      parts.push(
        `Upgrade the look of your ${acc.wheel_brand || "aftermarket"} wheels with this ${acc.brand || "premium"} center cap.`
      );
      if (acc.bolt_pattern) {
        parts.push(`Designed to fit ${acc.bolt_pattern} bolt pattern wheels.`);
      }
      parts.push(
        "Center caps protect your wheel hub from dirt and debris while adding a polished, finished appearance."
      );
      break;

    case "lug_nut":
      parts.push(
        `${acc.brand || "Premium quality"} lug nuts built for secure wheel mounting and long-lasting performance.`
      );
      if (acc.thread_size) {
        parts.push(`Thread size: ${acc.thread_size}.`);
      }
      if (acc.seat_type) {
        parts.push(
          `Features a ${acc.seat_type} seat design for proper wheel seating.`
        );
      }
      parts.push(
        "Manufactured from high-strength steel with chrome or black finish options. Always torque to manufacturer specifications."
      );
      break;

    case "hub_ring":
      parts.push(
        "Hub centric rings eliminate vibration by centering your aftermarket wheels perfectly on your vehicle's hub."
      );
      if (acc.outer_diameter && acc.inner_diameter) {
        parts.push(
          `This ring converts from ${acc.outer_diameter}mm (wheel bore) to ${acc.inner_diameter}mm (vehicle hub).`
        );
      }
      parts.push(
        "Made from high-grade plastic or aluminum for durability. Essential for aftermarket wheel installations to ensure smooth, vibration-free driving."
      );
      break;

    case "lighting":
      parts.push(
        `${acc.brand || "High-performance"} LED lighting solution for off-road and vehicle customization.`
      );
      parts.push(
        "Features bright LED output with durable, weather-resistant construction. Perfect for trucks, Jeeps, and off-road vehicles."
      );
      parts.push(
        "Easy installation with included mounting hardware. Adds visibility and style to any build."
      );
      break;

    case "tpms":
      parts.push(
        "Tire Pressure Monitoring System (TPMS) sensor or tool for maintaining proper tire pressure."
      );
      parts.push(
        "Proper tire pressure improves fuel economy, tire life, and vehicle safety. Essential for any wheel and tire installation."
      );
      break;

    case "valve_stem":
      parts.push(
        `${acc.brand || "Quality"} valve stem for tire inflation and pressure maintenance.`
      );
      parts.push(
        "Durable construction with reliable sealing. Available in standard and chrome finishes."
      );
      break;

    case "spacer":
      parts.push(
        "Wheel spacers provide additional clearance and a wider stance for your vehicle."
      );
      if (acc.bolt_pattern) {
        parts.push(`Designed for ${acc.bolt_pattern} bolt pattern.`);
      }
      parts.push(
        "Precision-machined from billet aluminum for strength and proper fitment. Includes all necessary hardware."
      );
      break;

    default:
      parts.push(
        `${acc.brand || "Quality"} automotive accessory for your wheel and tire installation.`
      );
  }

  return parts.join(" ");
}

/**
 * Generate features list
 */
function generateFeatures(acc: Accessory): string[] {
  const features: string[] = [];

  // Common features
  if (acc.brand) {
    features.push(`Brand: ${acc.brand}`);
  }

  // Category-specific features
  switch (acc.category) {
    case "lug_nut":
      if (acc.thread_size) features.push(`Thread Size: ${acc.thread_size}`);
      if (acc.seat_type) features.push(`Seat Type: ${acc.seat_type}`);
      features.push("High-strength steel construction");
      features.push("Corrosion-resistant finish");
      break;

    case "hub_ring":
      if (acc.outer_diameter)
        features.push(`Outer Diameter: ${acc.outer_diameter}mm`);
      if (acc.inner_diameter)
        features.push(`Inner Diameter: ${acc.inner_diameter}mm`);
      features.push("Eliminates wheel vibration");
      features.push("Precision-molded for exact fit");
      break;

    case "center_cap":
      if (acc.wheel_brand) features.push(`Fits: ${acc.wheel_brand} wheels`);
      if (acc.bolt_pattern) features.push(`Bolt Pattern: ${acc.bolt_pattern}`);
      features.push("OEM-quality replacement");
      features.push("Easy snap-in installation");
      break;

    case "lighting":
      features.push("High-output LED technology");
      features.push("Weather-resistant IP67 rating");
      features.push("Universal mounting options");
      features.push("Low power draw");
      break;

    case "tpms":
      features.push("Direct-fit replacement");
      features.push("OEM-compatible programming");
      features.push("Long battery life");
      break;

    case "valve_stem":
      features.push("Reliable air-tight seal");
      features.push("Standard valve core");
      features.push("Easy installation");
      break;

    case "spacer":
      if (acc.bolt_pattern) features.push(`Bolt Pattern: ${acc.bolt_pattern}`);
      features.push("Billet aluminum construction");
      features.push("Hub-centric design");
      features.push("Includes all hardware");
      break;
  }

  return features;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const acc = await getAccessory(sku);

  if (!acc) {
    return { title: "Accessory Not Found" };
  }

  const categoryName = CATEGORY_NAMES[acc.category] || "Accessories";

  return {
    title: `${acc.title} | ${categoryName} | Warehouse Tire Direct`,
    description: generateDescription(acc).slice(0, 160),
    openGraph: {
      title: acc.title,
      description: generateDescription(acc).slice(0, 160),
      images: acc.image_url ? [acc.image_url] : undefined,
    },
  };
}

export default async function AccessoryPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const acc = await getAccessory(sku);

  if (!acc) {
    notFound();
  }

  const categoryName = CATEGORY_NAMES[acc.category] || "Accessories";
  const imageUrl = acc.image_url || CATEGORY_IMAGES[acc.category] || CATEGORY_IMAGES.other;
  // Use database description if available, otherwise generate one
  const description = acc.description || generateDescription(acc);
  const features = generateFeatures(acc);
  const price = acc.sell_price || acc.msrp || 0;
  
  // Collect all available images
  const images = [acc.image_url, acc.image_url_2, acc.image_url_3].filter(Boolean) as string[];

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-orange-600">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/accessories" className="hover:text-orange-600">
          Accessories
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/accessories?category=${acc.category}`}
          className="hover:text-orange-600"
        >
          {categoryName}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{acc.sku}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-lg overflow-hidden aspect-square relative">
            {acc.image_url ? (
              <Image
                src={imageUrl}
                alt={acc.title}
                fill
                className="object-contain p-4"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg
                    className="w-24 h-24 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">Image coming soon</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Thumbnail Gallery */}
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <div 
                  key={i} 
                  className="w-20 h-20 bg-gray-100 rounded border-2 border-gray-200 overflow-hidden relative cursor-pointer hover:border-orange-500 transition-colors"
                >
                  <Image
                    src={img}
                    alt={`${acc.title} - Image ${i + 1}`}
                    fill
                    className="object-contain p-1"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          {/* Brand */}
          {acc.brand && (
            <p className="text-sm font-medium text-orange-600 uppercase tracking-wide mb-2">
              {acc.brand}
            </p>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {acc.title}
          </h1>

          {/* SKU & Category */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>SKU: {acc.sku}</span>
            <span className="px-2 py-1 bg-gray-100 rounded">{categoryName}</span>
          </div>

          {/* Price */}
          <div className="mb-6">
            {price > 0 ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  ${price.toFixed(2)}
                </span>
                {acc.msrp && acc.sell_price && acc.sell_price < acc.msrp && (
                  <span className="text-lg text-gray-400 line-through">
                    ${acc.msrp.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-lg text-gray-500">Contact for pricing</p>
            )}
          </div>

          {/* Stock Status */}
          <div className="mb-6">
            {acc.in_stock ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✓ In Stock
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Special Order
              </span>
            )}
          </div>

          {/* Add to Cart */}
          <div className="mb-8">
            <AccessoryAddToCartButton
              sku={acc.sku}
              name={acc.title}
              brand={acc.brand || undefined}
              category={acc.category as AccessoryCategory}
              imageUrl={acc.image_url || undefined}
              unitPrice={price}
              className="px-8 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700"
            />
          </div>

          {/* Description */}
          <div className="prose prose-gray max-w-none mb-8">
            <h2 className="text-lg font-semibold mb-2">Description</h2>
            <div className="whitespace-pre-line">{description}</div>
          </div>

          {/* Features */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Features</h2>
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Install CTA */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              🔧 Professional Installation Available
            </h3>
            <p className="text-blue-700">
              Visit our Pontiac or Waterford locations for expert installation.
            </p>
          </div>
          <a
            href="tel:+12483324120"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            📞 (248) 332-4120
          </a>
        </div>
      </div>
    </main>
  );
}
