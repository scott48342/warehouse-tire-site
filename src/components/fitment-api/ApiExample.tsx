'use client';

import { useState } from 'react';

interface ApiExampleProps {
  title: string;
  endpoint: string;
  response: object;
}

export function ApiExample({ title, endpoint, response }: ApiExampleProps) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 border-b border-zinc-800">
        <span className="text-zinc-300 font-medium">{title}</span>
        <button 
          onClick={copyToClipboard}
          className="text-zinc-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      
      {/* Request */}
      <div className="p-4 border-b border-zinc-800">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Request</div>
        <code className="text-sm">
          <span className="text-green-400">GET</span>{' '}
          <span className="text-blue-400">{endpoint}</span>
        </code>
      </div>
      
      {/* Response */}
      <div className="p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Response</div>
        <pre className="text-sm text-zinc-300 overflow-x-auto">
          <code>{JSON.stringify(response, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}
