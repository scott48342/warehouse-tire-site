import type { Metadata } from "next";

// noindex for now - page is new, not fully featured with lift-specific sizing
// Remove noindex once lift-aware fitment logic is implemented
export const metadata: Metadata = {
  title: "Lifted & Off-Road Builds | Warehouse Tire Direct",
  description:
    "Build your lifted truck or SUV setup. Select your vehicle and lift level, then shop tires sized for your build. Guidance only — final fitment may vary.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LiftedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
