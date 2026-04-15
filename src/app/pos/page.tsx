import { Metadata } from "next";
import { POSPageClient } from "./POSPageClient";

export const metadata: Metadata = {
  title: "POS | Warehouse Tire Direct",
  description: "In-store sales configurator",
  robots: "noindex, nofollow", // Don't index employee tools
};

export default function POSPage() {
  return <POSPageClient />;
}
