/**
 * Related Links Component
 * 
 * Internal linking for SEO
 */

import Link from "next/link";
import type { RelatedLink } from "@/lib/seo/content";

interface Props {
  links: RelatedLink[];
  title?: string;
}

export function RelatedLinks({ links, title = "Related" }: Props) {
  if (links.length === 0) return null;
  
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-neutral-900">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((link, idx) => (
          <li key={idx}>
            <Link
              href={link.href}
              className="inline-block rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
