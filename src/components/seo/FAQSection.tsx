/**
 * FAQ Section Component
 * 
 * Displays FAQs with expandable answers
 */

"use client";

import { useState } from "react";
import type { FAQItem } from "@/lib/seo/content";

interface Props {
  faqs: FAQItem[];
  title?: string;
}

export function FAQSection({ faqs, title = "Frequently Asked Questions" }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
  if (faqs.length === 0) return null;
  
  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-bold text-neutral-900">{title}</h2>
      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-neutral-200 bg-white"
          >
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-medium text-neutral-900">{faq.question}</span>
              <svg
                className={`h-5 w-5 text-neutral-400 transition-transform ${
                  openIndex === idx ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {openIndex === idx && (
              <div className="border-t border-neutral-100 px-4 py-3 text-neutral-600">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
