import { Metadata } from "next";
import { POSWheelsClient } from "./POSWheelsClient";

export const metadata: Metadata = {
  title: "Select Wheels | POS",
  robots: "noindex, nofollow",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function POSWheelsPage({ searchParams }: Props) {
  const sp = await searchParams;
  
  // Extract vehicle params
  const year = Array.isArray(sp.year) ? sp.year[0] : sp.year || "";
  const make = Array.isArray(sp.make) ? sp.make[0] : sp.make || "";
  const model = Array.isArray(sp.model) ? sp.model[0] : sp.model || "";
  const trim = Array.isArray(sp.trim) ? sp.trim[0] : sp.trim || "";
  
  return (
    <POSWheelsClient
      year={year}
      make={make}
      model={model}
      trim={trim}
      searchParams={sp}
    />
  );
}
