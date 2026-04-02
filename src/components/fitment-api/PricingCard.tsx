'use client';

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta?: string;
}

export function PricingCard({ 
  name, 
  price, 
  period = '/mo', 
  description, 
  features, 
  highlighted = false,
  cta = 'Request Access'
}: PricingCardProps) {
  return (
    <div className={`rounded-2xl p-8 ${
      highlighted 
        ? 'bg-gradient-to-b from-blue-600 to-blue-700 border-2 border-blue-400 shadow-xl shadow-blue-500/20' 
        : 'bg-zinc-900 border border-zinc-800'
    }`}>
      {highlighted && (
        <div className="text-blue-200 text-sm font-semibold mb-4 uppercase tracking-wide">
          Most Popular
        </div>
      )}
      <div className={`text-xl font-bold mb-2 ${highlighted ? 'text-white' : 'text-zinc-100'}`}>
        {name}
      </div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-white'}`}>
          {price}
        </span>
        <span className={highlighted ? 'text-blue-200' : 'text-zinc-400'}>
          {period}
        </span>
      </div>
      <p className={`mb-6 ${highlighted ? 'text-blue-100' : 'text-zinc-400'}`}>
        {description}
      </p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <svg 
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${highlighted ? 'text-blue-200' : 'text-green-500'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className={highlighted ? 'text-white' : 'text-zinc-300'}>{feature}</span>
          </li>
        ))}
      </ul>
      <a 
        href="#request-access"
        className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all ${
          highlighted 
            ? 'bg-white text-blue-600 hover:bg-blue-50' 
            : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
        }`}
      >
        {cta}
      </a>
    </div>
  );
}
