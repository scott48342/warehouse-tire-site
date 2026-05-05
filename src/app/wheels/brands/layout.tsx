import type { Metadata } from "next";

/**
 * Wheels/brands is a navigation helper page, not a landing page.
 * Set noindex to prevent parameter variations from polluting the index.
 */
export const metadata: Metadata = {
  title: "Shop Wheels by Brand | Warehouse Tire Direct",
  description: "Browse our selection of wheel brands. Find the perfect wheels for your vehicle.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function WheelsBrandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
