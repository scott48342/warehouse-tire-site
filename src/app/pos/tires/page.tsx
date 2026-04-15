import { Metadata } from "next";
import { POSTiresClient } from "./POSTiresClient";

export const metadata: Metadata = {
  title: "Select Tires | POS",
  robots: "noindex, nofollow",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function POSTiresPage({ searchParams }: Props) {
  const sp = await searchParams;
  
  const year = Array.isArray(sp.year) ? sp.year[0] : sp.year || "";
  const make = Array.isArray(sp.make) ? sp.make[0] : sp.make || "";
  const model = Array.isArray(sp.model) ? sp.model[0] : sp.model || "";
  const trim = Array.isArray(sp.trim) ? sp.trim[0] : sp.trim || "";
  const wheelDia = Array.isArray(sp.wheelDia) ? sp.wheelDia[0] : sp.wheelDia || "";
  const wheelWidth = Array.isArray(sp.wheelWidth) ? sp.wheelWidth[0] : sp.wheelWidth || "";
  
  return (
    <POSTiresClient
      year={year}
      make={make}
      model={model}
      trim={trim}
      wheelDia={wheelDia}
      wheelWidth={wheelWidth}
      searchParams={sp}
    />
  );
}
