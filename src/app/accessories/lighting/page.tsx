import { AccessoryGrid } from "@/components/AccessoryGrid";

export const metadata = {
  title: "LED Lighting | Warehouse Tire Direct",
  description: "Shop LED light bars, rock lights, pod lights, and off-road lighting accessories for trucks and Jeeps.",
};

export default function LightingPage() {
  return (
    <AccessoryGrid
      category="lighting"
      title="LED Lighting"
      description="Illuminate the trail with premium LED lighting. Light bars, rock lights, pod lights, and more for trucks, Jeeps, and off-road vehicles."
      icon="💡"
    />
  );
}
