import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { MobileActionBar } from "@/components/MobileActionBar";
import { CartProvider } from "@/lib/cart/CartContext";
import { CartSlideout } from "@/components/CartSlideout";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: {
    default: "Warehouse Tire Direct | Wheels, Tires & Professional Installation",
    template: "%s | Warehouse Tire Direct",
  },
  description: "Shop premium wheels and tires online with professional installation. Browse thousands of in-stock wheels from top brands. Free quotes, competitive pricing, and expert service.",
  keywords: ["wheels", "tires", "wheel installation", "tire shop", "aftermarket wheels", "custom wheels"],
  openGraph: {
    title: "Warehouse Tire Direct",
    description: "Premium wheels and tires with professional installation",
    url: "https://shop.warehousetiredirect.com",
    siteName: "Warehouse Tire Direct",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL("https://shop.warehousetiredirect.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <GoogleAnalytics />
      </head>
      <body className={`${inter.variable} ${oswald.variable} antialiased`}>
        <CartProvider>
          <Suspense fallback={<div className="h-16" />}>
            <Header />
          </Suspense>
          {children}
          <MobileActionBar />
          <CartSlideout />
        </CartProvider>
      </body>
    </html>
  );
}
