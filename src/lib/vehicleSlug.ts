import { slugify } from "@/lib/slug";

export function vehicleSlug(year: string, make: string, model: string) {
  return `${slugify(year)}-${slugify(make)}-${slugify(model)}`;
}
