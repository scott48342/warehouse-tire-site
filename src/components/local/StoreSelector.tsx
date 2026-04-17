'use client';

/**
 * Store Selector - Local Mode Only
 * 
 * Allows customers to select their preferred installation location
 * (Pontiac or Waterford). Only rendered in local mode.
 * 
 * CRITICAL: This component should NEVER be imported or rendered
 * on the national site. Use <LocalOnly> wrapper or check mode first.
 */

import React from 'react';
import { useShopContext, LocalOnly } from '@/contexts/ShopContextProvider';
import { STORES, LocalStore } from '@/lib/shopContext';

interface StoreSelectorProps {
  variant?: 'dropdown' | 'cards' | 'minimal';
  showHours?: boolean;
  showPhone?: boolean;
  className?: string;
}

export function StoreSelector({
  variant = 'cards',
  showHours = false,
  showPhone = true,
  className = '',
}: StoreSelectorProps) {
  return (
    <LocalOnly>
      <StoreSelectorInner 
        variant={variant}
        showHours={showHours}
        showPhone={showPhone}
        className={className}
      />
    </LocalOnly>
  );
}

function StoreSelectorInner({
  variant,
  showHours,
  showPhone,
  className,
}: StoreSelectorProps) {
  const { selectedStore, selectStore, storeInfo } = useShopContext();
  const stores = Object.values(STORES);
  
  if (variant === 'dropdown') {
    return (
      <div className={`store-selector-dropdown ${className}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Installation Location
        </label>
        <select
          value={selectedStore || ''}
          onChange={(e) => selectStore(e.target.value as LocalStore)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
        >
          <option value="" disabled>Select a store</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  
  if (variant === 'minimal') {
    return (
      <div className={`store-selector-minimal flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-600">Install at:</span>
        <div className="flex gap-1">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => selectStore(store.id)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedStore === store.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {store.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  // Default: cards variant
  return (
    <div className={`store-selector-cards ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Choose Installation Location
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stores.map((store) => {
          const isSelected = selectedStore === store.id;
          return (
            <button
              key={store.id}
              onClick={() => selectStore(store.id)}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all
                ${isSelected 
                  ? 'border-red-600 bg-red-50 ring-2 ring-red-600 ring-offset-2' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }
              `}
            >
              {/* Selection indicator */}
              <div className={`
                absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${isSelected ? 'border-red-600 bg-red-600' : 'border-gray-300'}
              `}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              
              {/* Store name */}
              <div className="font-semibold text-gray-900 pr-8">
                {store.name}
              </div>
              
              {/* Address */}
              <div className="text-sm text-gray-600 mt-1">
                {store.address}
                <br />
                {store.city}, {store.state} {store.zip}
              </div>
              
              {/* Phone */}
              {showPhone && (
                <div className="text-sm text-gray-600 mt-2">
                  📞 {store.phone}
                </div>
              )}
              
              {/* Hours */}
              {showHours && (
                <div className="text-xs text-gray-500 mt-2">
                  Mon-Fri: {store.hours.weekday}
                  <br />
                  Sat: {store.hours.saturday}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact store badge showing selected store.
 * For use in headers/nav in local mode.
 */
export function SelectedStoreBadge({ className = '' }: { className?: string }) {
  return (
    <LocalOnly>
      <SelectedStoreBadgeInner className={className} />
    </LocalOnly>
  );
}

function SelectedStoreBadgeInner({ className }: { className?: string }) {
  const { storeInfo } = useShopContext();
  
  if (!storeInfo) return null;
  
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-gray-500">Installing at:</span>
      <span className="font-medium text-gray-900">
        {storeInfo.displayName}
      </span>
    </div>
  );
}

/**
 * Store info card for checkout/confirmation.
 */
export function StoreInfoCard({ className = '' }: { className?: string }) {
  return (
    <LocalOnly>
      <StoreInfoCardInner className={className} />
    </LocalOnly>
  );
}

function StoreInfoCardInner({ className }: { className?: string }) {
  const { storeInfo } = useShopContext();
  
  if (!storeInfo) return null;
  
  return (
    <div className={`bg-gray-50 rounded-xl p-4 border border-gray-200 ${className}`}>
      <h4 className="font-semibold text-gray-900 mb-2">
        Installation Location
      </h4>
      <div className="text-sm text-gray-700">
        <div className="font-medium">{storeInfo.name}</div>
        <div>{storeInfo.address}</div>
        <div>{storeInfo.city}, {storeInfo.state} {storeInfo.zip}</div>
        <div className="mt-2">
          <a 
            href={`tel:${storeInfo.phone.replace(/-/g, '')}`}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            📞 {storeInfo.phone}
          </a>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <div>Mon-Fri: {storeInfo.hours.weekday}</div>
          <div>Sat: {storeInfo.hours.saturday}</div>
        </div>
      </div>
    </div>
  );
}
