import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NATIONAL_CHECKOUT_PAUSED, isNationalCatalogHost } from "@/lib/nationalCatalog";
import CheckoutClientPage from "./CheckoutClientPage";

export default async function CheckoutPage() {
  const host = (await headers()).get("host") || "";
  if (NATIONAL_CHECKOUT_PAUSED && isNationalCatalogHost(host)) {
    redirect("/national-catalog");
  }
  return <CheckoutClientPage />;
}
