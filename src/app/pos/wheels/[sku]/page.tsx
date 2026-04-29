import { Metadata } from "next";
import { POSWheelPDPClient } from "./POSWheelPDPClient";

export const metadata: Metadata = {
  title: "Wheel Details | POS",
  robots: "noindex, nofollow",
};

type Props = {
  params: Promise<{ sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function POSWheelPDPPage({ params, searchParams }: Props) {
  const { sku } = await params;
  const sp = await searchParams;
  
  // Extract vehicle params
  const year = Array.isArray(sp.year) ? sp.year[0] : sp.year || "";
  const make = Array.isArray(sp.make) ? sp.make[0] : sp.make || "";
  const model = Array.isArray(sp.model) ? sp.model[0] : sp.model || "";
  const trim = Array.isArray(sp.trim) ? sp.trim[0] : sp.trim || "";
  
  return (
    <POSWheelPDPClient
      sku={decodeURIComponent(sku)}
      year={year}
      make={make}
      model={model}
      trim={trim}
    />
  );
}
