'use client';

import { useState } from 'react';

type Props = {
  imageUrl?: string | null;
  brand?: string | null;
  model?: string | null;
  imageClassName?: string;
  fallbackClassName?: string;
};

/** Shows a clearly labeled illustration when the supplier photo is absent or fails to load. */
export function TireProductImage({ imageUrl, brand, model, imageClassName, fallbackClassName }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const knownPlaceholder = /no[-_]?image|placeholder|default|missing|not[-_]?found|unavailable|blank|\/null|\/undefined/i.test(imageUrl || '');
  const showPhoto = Boolean(imageUrl && !knownPlaceholder && imageUrl !== failedUrl);

  if (showPhoto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl!} alt={`${brand || 'Tire'} ${model || ''}`.trim()} loading="lazy" className={imageClassName} onError={() => setFailedUrl(imageUrl!)} />;
  }

  return (
    <div className={fallbackClassName || 'tire-card-image-placeholder'} aria-label={`${brand || 'Tire'} illustration; product photo unavailable`}>
      {/* The illustration is generic; the text identifies the actual product. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/default-tire.svg" alt="" aria-hidden="true" className="h-24 w-24 object-contain" />
      <span className="mt-1 max-w-full truncate text-xs font-extrabold text-neutral-900">{brand || 'Tire'}</span>
      {model ? <span className="max-w-full truncate text-[11px] text-neutral-600">{model}</span> : null}
      <span className="mt-1 text-[10px] text-neutral-500">Illustration · photo unavailable</span>
    </div>
  );
}
