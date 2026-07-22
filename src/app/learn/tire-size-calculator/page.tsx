import Link from "next/link";
import { Metadata } from "next";
import { AlternateSizeFinder, SpeedometerCalculator } from "@/components/tire-tools";

export const metadata: Metadata = {
  title: "Tire Size Calculator — Compare Sizes & Find Alternates | Warehouse Tire Direct",
  description:
    "Free tire size calculator. Compare two tire sizes, see diameter, sidewall, and speedometer differences, and find every alternate tire size that fits your wheels — 15\" to 26\".",
  openGraph: {
    title: "Tire Size Calculator & Alternate Size Finder",
    description:
      "Compare tire sizes and find every alternate size for any wheel diameter. Keep your speedometer accurate when upsizing wheels.",
  },
  alternates: {
    canonical: "/learn/tire-size-calculator",
  },
};

const FAQS = [
  {
    q: "How do I read a tire size like 265/70R17?",
    a: "The first number (265) is the tire width in millimeters. The second (70) is the aspect ratio — the sidewall height as a percentage of the width. R means radial construction, and 17 is the wheel diameter in inches.",
  },
  {
    q: "How much can my tire diameter change safely?",
    a: "The industry rule of thumb is to stay within 3% of your original overall diameter. Within that range, your speedometer, odometer, ABS, and traction control keep working accurately. Within 2% is ideal.",
  },
  {
    q: "What happens if I put bigger wheels on my vehicle?",
    a: "When you increase wheel diameter, you need a tire with a shorter sidewall to keep the same overall diameter — this is called plus sizing. Our calculator shows exactly which tire sizes work for each wheel diameter.",
  },
  {
    q: "Will a different tire size affect my speedometer?",
    a: "Yes. A larger overall diameter makes your speedometer read slower than your true speed, and a smaller diameter makes it read faster. The calculator shows your actual speed at an indicated 60 mph for every alternate size.",
  },
];

export default function TireSizeCalculatorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-red-600">Free Tool</p>
        <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Tire Size Calculator
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
          Find every alternate tire size for any wheel diameter, compare sizes side by side, and
          see exactly how a change affects your speedometer — then shop the size in one click.
        </p>
      </div>

      {/* Alternate size finder (the main event) */}
      <div className="mt-10">
        <AlternateSizeFinder />
      </div>

      {/* Compare two sizes */}
      <div className="mt-10">
        <h2 className="mb-4 text-2xl font-bold text-neutral-900">
          Compare Two Tire Sizes
        </h2>
        <SpeedometerCalculator />
      </div>

      {/* How it works / SEO copy */}
      <section className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <h2 className="text-2xl font-bold text-neutral-900">How Tire Size Math Works</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-bold text-neutral-900">Overall Diameter</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Overall diameter = wheel diameter + 2 × sidewall height. Sidewall height is the
              tire width × aspect ratio. For a 265/70R17: sidewall = 265mm × 70% = 185.5mm
              (7.3"), so overall diameter = 17" + 2 × 7.3" = 31.6".
            </p>
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">The 3% Rule</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Any replacement size within ±3% of your original overall diameter is generally
              safe — your speedometer stays accurate and your drivetrain components see the
              gearing they were designed for. We flag sizes within ±2% as Best Match.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">Plus Sizing</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Going from 17" to 20" wheels? Pick the 20" chip above and you'll see every tire
              size that keeps your overall diameter within 3% — shorter sidewall, bigger wheel,
              same speedometer reading.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">Revolutions per Mile</h3>
            <p className="mt-1 text-sm text-neutral-600">
              A tire travels its circumference each revolution. Fewer revs per mile means a
              taller tire — which also means lower effective gearing and a speedometer that
              reads under your true speed.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-neutral-900">Tire Size FAQs</h2>
        <div className="mt-4 space-y-4">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-neutral-200 bg-white p-4"
            >
              <summary className="cursor-pointer list-none font-semibold text-neutral-900">
                {faq.q}
              </summary>
              <p className="mt-2 text-sm text-neutral-600">{faq.a}</p>
            </details>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            }),
          }}
        />
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl bg-neutral-900 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">Found Your Size?</h2>
        <p className="mx-auto mt-2 max-w-xl text-neutral-300">
          Shop tires by size or get a complete wheel &amp; tire package with guaranteed fitment
          for your vehicle.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/tires"
            className="rounded-full bg-red-600 px-6 py-3 font-bold text-white transition-colors hover:bg-red-700"
          >
            Shop Tires
          </Link>
          <Link
            href="/packages"
            className="rounded-full border border-white/30 px-6 py-3 font-bold text-white transition-colors hover:bg-white/10"
          >
            Wheel &amp; Tire Packages
          </Link>
        </div>
      </section>
    </main>
  );
}
