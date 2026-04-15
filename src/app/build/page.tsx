import { Metadata } from "next";
import { BuildPageClient } from "./BuildPageClient";

export const metadata: Metadata = {
  title: "Build Your Wheel & Tire Package | Warehouse Tire Direct",
  description: "Build a custom wheel and tire package for your vehicle. Guaranteed fitment, free shipping, and expert guidance.",
};

export default function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  }>;
}) {
  return <BuildPageClient searchParamsPromise={searchParams} />;
}
