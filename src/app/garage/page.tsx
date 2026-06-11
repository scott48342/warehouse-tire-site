import { Metadata } from "next";
import { GaragePageClient } from "./GaragePageClient";

export const metadata: Metadata = {
  title: "My Garage | Warehouse Tire Direct",
  description: "Manage your saved vehicles. Add, remove, and switch between vehicles for a personalized shopping experience.",
};

export default function GaragePage() {
  return <GaragePageClient />;
}
