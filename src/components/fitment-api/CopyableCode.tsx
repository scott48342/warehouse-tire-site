'use client';

import { useState } from 'react';

interface CopyableCodeProps {
  code: string;
  label?: string;
}

/** Dark code block with a one-click copy button. */
export function CopyableCode({ code, label = 'Copy' }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (very old browser / insecure context) — user can still select the text
    }
  }

  return (
    <div className="relative rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={copy}
        className="absolute top-3 right-3 text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
      >
        {copied ? 'Copied ✓' : label}
      </button>
      <pre className="p-5 pr-24 overflow-x-auto text-sm text-zinc-100 font-mono whitespace-pre-wrap break-all">
        <code>{code}</code>
      </pre>
    </div>
  );
}
