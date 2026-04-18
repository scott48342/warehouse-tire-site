import { AccessoryGrid } from "@/components/AccessoryGrid";

export const metadata = {
  title: "Lug Nuts & Wheel Locks | Warehouse Tire Direct",
  description: "Shop lug nuts, wheel locks, and lug nut kits. OEM replacement and aftermarket options for all vehicles.",
};

export default function LugNutsPage() {
  return (
    <AccessoryGrid
      category="lug-nut"
      title="Lug Nuts & Wheel Locks"
      description="Keep your wheels secure with quality lug nuts and wheel locks. We carry OEM replacement and aftermarket options for all vehicle makes and models."
      icon="🔩"
    />
  );
}
