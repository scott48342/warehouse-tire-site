import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function MobileActionBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-3 py-2">
        <a
          href={BRAND.links.tel}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-center text-sm font-extrabold text-neutral-900"
        >
          Call
        </a>
        <Link
          href="/schedule"
          className="rounded-xl bg-[var(--brand-red)] px-3 py-3 text-center text-sm font-extrabold text-white"
        >
          Schedule
        </Link>
      </div>
    </div>
  );
}
