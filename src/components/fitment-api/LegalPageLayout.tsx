'use client';

import Link from 'next/link';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link 
            href="/fitment-api" 
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Fitment API
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{title}</h1>
          <p className="text-zinc-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-zinc-500 text-sm">
              © {new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/fitment-api/terms" className="text-zinc-500 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="/fitment-api/privacy" className="text-zinc-500 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link href="/fitment-api" className="text-zinc-500 hover:text-white text-sm transition-colors">
                Fitment API
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Section component for consistent styling */
export function LegalSection({ 
  number, 
  title, 
  children 
}: { 
  number: string; 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4 text-white">
        {number}. {title}
      </h2>
      <div className="text-zinc-300 space-y-4 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/* Subsection for nested content */
export function LegalSubsection({ 
  title, 
  children 
}: { 
  title?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      {title && <h3 className="text-lg font-medium mb-2 text-zinc-100">{title}</h3>}
      <div className="text-zinc-300 space-y-2">
        {children}
      </div>
    </div>
  );
}

/* Bullet list styling */
export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-outside ml-6 space-y-2 text-zinc-300">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
