import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NATIONAL_CHECKOUT_PAUSED, isNationalCatalogHost } from "@/lib/nationalCatalog";

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host") || "";
  if (NATIONAL_CHECKOUT_PAUSED && isNationalCatalogHost(host)) {
    redirect("/national-catalog");
  }
  return children;
}
