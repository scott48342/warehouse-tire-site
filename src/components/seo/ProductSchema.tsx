/**
 * Product Schema Component (JSON-LD)
 * 
 * Generates structured data for Google rich results.
 * Supports wheels, tires, accessories, and suspension products.
 * 
 * @see https://schema.org/Product
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 * 
 * @created 2026-06-09
 */

import { BRAND } from "@/lib/brand";

// ============================================================================
// Types
// ============================================================================

export type ProductType = "wheel" | "tire" | "accessory" | "suspension";

export interface ProductSchemaProps {
  type: ProductType;
  sku: string;
  name: string;
  description: string;
  brand: string;
  imageUrl?: string;
  price?: number;
  /** Original MSRP if on sale */
  msrp?: number;
  inStock?: boolean;
  /** Product condition - typically "NewCondition" */
  condition?: "NewCondition" | "UsedCondition" | "RefurbishedCondition";
  /** URL to the product page */
  url?: string;
  /** Additional product attributes */
  attributes?: {
    // Wheel-specific
    diameter?: string;
    width?: string;
    boltPattern?: string;
    offset?: string;
    finish?: string;
    // Tire-specific
    tireSize?: string;
    loadIndex?: string;
    speedRating?: string;
    treadPattern?: string;
    mileageWarranty?: number;
    // Suspension-specific
    liftHeight?: number;
    vehicleFitment?: string;
  };
  /** Aggregate rating (if available) */
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
  /** Individual reviews (if available) */
  reviews?: Array<{
    author: string;
    datePublished: string;
    reviewBody: string;
    ratingValue: number;
  }>;
}

// ============================================================================
// Schema Builders
// ============================================================================

function buildProductSchema(props: ProductSchemaProps): Record<string, unknown> {
  const {
    type,
    sku,
    name,
    description,
    brand,
    imageUrl,
    price,
    msrp,
    inStock = true,
    condition = "NewCondition",
    url,
    attributes,
    aggregateRating,
    reviews,
  } = props;

  // Base product schema
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku,
    mpn: sku, // Manufacturer Part Number
    brand: {
      "@type": "Brand",
      name: brand,
    },
    category: getCategoryForType(type),
  };

  // Image
  if (imageUrl) {
    schema.image = imageUrl;
  }

  // URL
  if (url) {
    schema.url = url;
  }

  // Offers (pricing)
  if (price && price > 0) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: `https://schema.org/${condition}`,
      seller: {
        "@type": "Organization",
        name: BRAND.name,
      },
      priceValidUntil: getPriceValidUntil(),
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "USD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 3,
            maxValue: 7,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "US",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    };

    // Add sale price indicator if MSRP is higher
    if (msrp && msrp > price) {
      offer.priceSpecification = {
        "@type": "PriceSpecification",
        price: price.toFixed(2),
        priceCurrency: "USD",
        valueAddedTaxIncluded: false,
      };
    }

    schema.offers = offer;
  }

  // Product-specific attributes
  if (attributes) {
    const additionalProperties: Array<{ "@type": string; name: string; value: string }> = [];

    if (attributes.diameter) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Wheel Diameter",
        value: `${attributes.diameter}"`,
      });
    }
    if (attributes.width) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Wheel Width",
        value: `${attributes.width}"`,
      });
    }
    if (attributes.boltPattern) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Bolt Pattern",
        value: attributes.boltPattern,
      });
    }
    if (attributes.offset) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Offset",
        value: `${attributes.offset}mm`,
      });
    }
    if (attributes.finish) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Finish",
        value: attributes.finish,
      });
    }
    if (attributes.tireSize) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Tire Size",
        value: attributes.tireSize,
      });
    }
    if (attributes.loadIndex) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Load Index",
        value: attributes.loadIndex,
      });
    }
    if (attributes.speedRating) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Speed Rating",
        value: attributes.speedRating,
      });
    }
    if (attributes.mileageWarranty) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Mileage Warranty",
        value: `${attributes.mileageWarranty.toLocaleString()} miles`,
      });
    }
    if (attributes.liftHeight) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Lift Height",
        value: `${attributes.liftHeight}"`,
      });
    }
    if (attributes.vehicleFitment) {
      additionalProperties.push({
        "@type": "PropertyValue",
        name: "Vehicle Fitment",
        value: attributes.vehicleFitment,
      });
    }

    if (additionalProperties.length > 0) {
      schema.additionalProperty = additionalProperties;
    }
  }

  // Aggregate rating
  if (aggregateRating && aggregateRating.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue.toFixed(1),
      reviewCount: aggregateRating.reviewCount,
      bestRating: aggregateRating.bestRating || 5,
      worstRating: aggregateRating.worstRating || 1,
    };
  }

  // Individual reviews
  if (reviews && reviews.length > 0) {
    schema.review = reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: r.author,
      },
      datePublished: r.datePublished,
      reviewBody: r.reviewBody,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.ratingValue,
        bestRating: 5,
        worstRating: 1,
      },
    }));
  }

  return schema;
}

function getCategoryForType(type: ProductType): string {
  switch (type) {
    case "wheel":
      return "Wheels & Rims > Custom Wheels";
    case "tire":
      return "Tires > Passenger & Light Truck Tires";
    case "accessory":
      return "Automotive Parts & Accessories";
    case "suspension":
      return "Automotive Parts & Accessories > Suspension & Steering > Lift Kits";
    default:
      return "Automotive Parts & Accessories";
  }
}

function getPriceValidUntil(): string {
  // Price valid for 30 days
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

// ============================================================================
// Breadcrumb Schema Builder
// ============================================================================

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ============================================================================
// React Components
// ============================================================================

/**
 * Renders Product JSON-LD schema in the page head
 */
export function ProductSchema(props: ProductSchemaProps) {
  const schema = buildProductSchema(props);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Renders Breadcrumb JSON-LD schema
 */
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = buildBreadcrumbSchema(items);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Combined schema for product pages
 * Renders both Product and Breadcrumb schemas
 */
export function ProductPageSchema({
  product,
  breadcrumbs,
}: {
  product: ProductSchemaProps;
  breadcrumbs: BreadcrumbItem[];
}) {
  return (
    <>
      <ProductSchema {...product} />
      <BreadcrumbSchema items={breadcrumbs} />
    </>
  );
}

export default ProductSchema;
