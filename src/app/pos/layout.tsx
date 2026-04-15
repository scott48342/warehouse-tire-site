import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "../globals.css";
import { CartProvider } from "@/lib/cart/CartContext";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

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
  return (
    <html lang="en">
      <head>
        <GoogleAnalytics />
      </head>
      <body className={`${inter.variable} ${oswald.variable} antialiased flex min-h-screen flex-col bg-gray-50`}>
        <CartProvider>
          <main className="flex-1">
            {children}
          </main>
        </CartProvider>
      </body>
    </html>
  );
}
