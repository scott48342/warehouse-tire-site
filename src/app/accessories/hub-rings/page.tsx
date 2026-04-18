import { AccessoryGrid } from "@/components/AccessoryGrid";

export const metadata = {
  title: "Hub Centric Rings | Warehouse Tire Direct",
  description: "Shop hub centric rings to eliminate vibration and ensure perfect wheel centering. Available in all popular sizes.",
};

export default function HubRingsPage() {
  return (
    <AccessoryGrid
      category="hub-ring"
      title="Hub Centric Rings"
      description="Eliminate vibration and ensure perfect wheel centering with hub centric rings. Essential for aftermarket wheels with larger center bores than your vehicle's hub."
      icon="⭕"
    />
  );
}
