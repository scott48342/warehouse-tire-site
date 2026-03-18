import Link from "next/link";

export const metadata = {
  title: "Accessories | Warehouse Tire Direct",
};

export default function AccessoriesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Accessories</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Shop helpful add-ons like TPMS sensors.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/accessories/tpms"
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:bg-neutral-50"
        >
          <div className="text-sm font-extrabold text-neutral-900">TPMS Sensors</div>
          <div className="mt-1 text-sm text-neutral-600">Lookup KM TPMS sensors by part number.</div>
        </Link>
      </div>
    </main>
  );
}
