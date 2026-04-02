'use client';

import { useState } from 'react';
import Link from 'next/link';

// Use case options
const USE_CASES = [
  { value: 'ecommerce', label: 'Tire & Wheel Ecommerce' },
  { value: 'marketplace', label: 'Automotive Marketplace' },
  { value: 'dealership', label: 'Dealership / DMS Software' },
  { value: 'developer', label: 'Developer / Side Project' },
  { value: 'other', label: 'Other' },
];

export function AccessRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/fitment-api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          company: formData.get('company'),
          website: formData.get('website') || undefined,
          useCase: formData.get('useCase'),
          useCaseDetails: formData.get('useCaseDetails') || undefined,
          expectedUsage: formData.get('usage'),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to submit request. Please try again.');
        setLoading(false);
        return;
      }
      
      setSubmitted(true);
    } catch (err) {
      console.error('Request submission error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Request Received!</h3>
        <p className="text-zinc-400 mb-4">
          We&apos;ll review your application and get back to you within 24 hours with your API credentials.
        </p>
        <p className="text-zinc-500 text-sm">
          Check your email for a confirmation message.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-zinc-300 text-sm font-medium mb-2">
            Name *
          </label>
          <input 
            type="text" 
            name="name"
            required
            minLength={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-zinc-300 text-sm font-medium mb-2">
            Company / Project *
          </label>
          <input 
            type="text" 
            name="company"
            required
            minLength={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Acme Wheels Inc."
          />
        </div>
        <div>
          <label className="block text-zinc-300 text-sm font-medium mb-2">
            Email *
          </label>
          <input 
            type="email" 
            name="email"
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="john@acmewheels.com"
          />
        </div>
        <div>
          <label className="block text-zinc-300 text-sm font-medium mb-2">
            Website
          </label>
          <input 
            type="url" 
            name="website"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="https://acmewheels.com"
          />
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block text-zinc-300 text-sm font-medium mb-2">
          What are you building? *
        </label>
        <select 
          name="useCase"
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">Select a use case...</option>
          {USE_CASES.map(uc => (
            <option key={uc.value} value={uc.value}>{uc.label}</option>
          ))}
        </select>
      </div>
      
      <div className="mb-6">
        <label className="block text-zinc-300 text-sm font-medium mb-2">
          Expected Monthly API Calls
        </label>
        <select 
          name="usage"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="< 10k">Less than 10,000</option>
          <option value="10k-50k">10,000 - 50,000</option>
          <option value="50k-100k">50,000 - 100,000</option>
          <option value="100k+">100,000+</option>
        </select>
      </div>
      
      <div className="mb-6">
        <label className="block text-zinc-300 text-sm font-medium mb-2">
          Tell us more (optional)
        </label>
        <textarea 
          name="useCaseDetails"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          placeholder="Any additional details about your project or integration plans..."
        />
      </div>
      
      {/* Terms Agreement Checkbox */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 border-2 border-zinc-600 rounded bg-zinc-800 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors">
              <svg 
                className={`w-full h-full text-white p-0.5 ${agreedToTerms ? 'opacity-100' : 'opacity-0'} transition-opacity`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
            I agree to the{' '}
            <Link 
              href="/fitment-api/terms" 
              target="_blank"
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link 
              href="/fitment-api/privacy" 
              target="_blank"
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
            {' '}*
          </span>
        </label>
      </div>
      
      <button 
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Submitting...
          </>
        ) : (
          'Request API Access'
        )}
      </button>
      
      <p className="text-zinc-500 text-sm text-center mt-4">
        We typically respond within 24 hours.
      </p>
    </form>
  );
}
