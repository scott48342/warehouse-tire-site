import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function NationalCatalogPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <h1 className="text-3xl font-extrabold text-neutral-900">Browse now. Order with our team.</h1>
      <p className="mt-5 text-lg text-neutral-700">
        Online checkout for Warehouse Tire Direct is paused for the season. Our team can help
        confirm fitment, availability, and your final price, then complete your order directly.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={BRAND.links.tel} className="rounded-xl bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700">
          Call {BRAND.phone.callDisplay}
        </a>
        <Link href="/contact" className="rounded-xl border border-neutral-300 px-6 py-3 font-bold text-neutral-900 hover:bg-neutral-50">
          Contact us
        </Link>
      </div>
      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-neutral-700 underline">
        Continue browsing
      </Link>
    </div>
  );
}
