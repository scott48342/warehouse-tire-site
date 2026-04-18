import { AccessoryGrid } from "@/components/AccessoryGrid";

export const metadata = {
  title: "Center Caps | Warehouse Tire Direct",
  description: "Shop replacement center caps for aftermarket wheels. Find the perfect finish to complete your wheel setup.",
};

export default function CenterCapsPage() {
  return (
    <AccessoryGrid
      category="center-cap"
      title="Center Caps"
      description="Complete your wheel setup with the perfect center cap. Replacement and custom center caps for all major aftermarket wheel brands."
      icon="🎯"
    />
  );
}
