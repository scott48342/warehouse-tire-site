import type { Metadata } from "next";
import { Inter, Oswald, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart/CartContext";
import { CartSavePromptProvider } from "@/lib/cart/CartSavePromptProvider";
import { CompareProvider } from "@/context/CompareContext";
import { DiscountProvider } from "@/lib/discounts/DiscountContext";
import { ShopContextProvider } from "@/contexts/ShopContextProvider";
import { VehicleMemoryProvider } from "@/contexts/VehicleMemoryContext";
import { GarageProvider } from "@/contexts/GarageContext";
import { QuickViewProvider } from "@/contexts/QuickViewContext";
import { CartTracker } from "@/components/CartTracker";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
import { Analytics } from "@/components/Analytics";
import { FunnelTracker } from "@/components/FunnelTracker";
import { OrganizationJsonLd } from "@/components/trust/TrustJsonLd";
// import { Chatwoot } from "@/components/Chatwoot"; // Disabled temporarily
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
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
        <MicrosoftClarity />
        <OrganizationJsonLd />
      </head>
      <body className={`${inter.variable} ${oswald.variable} ${bebasNeue.variable} antialiased flex min-h-screen flex-col`}>
        <ShopContextProvider>
          <GarageProvider>
            <VehicleMemoryProvider>
              <CartProvider>
                <CartSavePromptProvider>
                  <DiscountProvider>
                    <CompareProvider>
                      <QuickViewProvider>
                        <CartTracker />
                        <Suspense fallback={null}>
                          <Analytics />
                          <FunnelTracker />
                        </Suspense>
                        <ConditionalLayout>
                          {children}
                        </ConditionalLayout>
                      </QuickViewProvider>
                    </CompareProvider>
                  </DiscountProvider>
                </CartSavePromptProvider>
              </CartProvider>
            </VehicleMemoryProvider>
          </GarageProvider>
        </ShopContextProvider>
        {/* <Chatwoot /> */}{/* Disabled temporarily */}
      </body>
    </html>
  );
}
