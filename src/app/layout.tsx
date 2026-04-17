import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart/CartContext";
import { CompareProvider } from "@/context/CompareContext";
import { ShopContextProvider } from "@/contexts/ShopContextProvider";
import { CartTracker } from "@/components/CartTracker";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Analytics } from "@/components/Analytics";
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
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome", url: "/android-chrome-192x192.png", sizes: "192x192" },
      { rel: "android-chrome", url: "/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
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
      <body className={`${inter.variable} ${oswald.variable} antialiased flex min-h-screen flex-col`}>
        <ShopContextProvider>
          <CartProvider>
            <CompareProvider>
              <CartTracker />
              <Suspense fallback={null}>
                <Analytics />
              </Suspense>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </CompareProvider>
          </CartProvider>
        </ShopContextProvider>
      </body>
    </html>
  );
}
