import type { Metadata } from "next";
import { POSProvider } from "@/components/pos";
import { POSAuthGate } from "@/components/pos/POSAuthGate";

export const metadata: Metadata = {
  title: "Warehouse Tire Direct | In-Store Sales",
  description: "In-store sales configurator for Warehouse Tire Direct",
  robots: {
    index: false,
    follow: false,
  },
};

export default function POSLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No html/body here - root layout handles that
  // ConditionalLayout in root already hides Header/Footer for /pos routes
  // POSAuthGate requires PIN to access POS
  // POSProvider wraps all POS routes for shared state
  return (
    <POSAuthGate>
      <POSProvider>{children}</POSProvider>
    </POSAuthGate>
  );
}
