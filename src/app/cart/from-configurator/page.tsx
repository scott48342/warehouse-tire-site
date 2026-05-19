'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCart, type CartWheelItem } from '@/lib/cart/CartContext';
import Link from 'next/link';

/**
 * iConfigurator Cart Handler Page
 * 
 * Receives encoded cart data from /api/cart/from-configurator
 * Adds items to cart and redirects to cart page
 */

interface ConfiguratorItem {
  sku: string;
  brand: string;
  model: string;
  price: number;
  quantity: number;
  imageUrl: string;
  description: string;
}

interface CartData {
  items: ConfiguratorItem[];
  tireSize: string | null;
  acesId: string;
  source: string;
  timestamp: number;
}

export default function FromConfiguratorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem, isHydrated, setIsOpen } = useCart();
  
  const [status, setStatus] = useState<'loading' | 'adding' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your selection...');
  const [itemsAdded, setItemsAdded] = useState<ConfiguratorItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const processedRef = useRef(false);

  useEffect(() => {
    // Wait for cart to hydrate
    if (!isHydrated) return;
    
    // Prevent double processing
    if (processedRef.current) return;
    processedRef.current = true;

    const encodedData = searchParams.get('data');
    
    if (!encodedData) {
      setStatus('error');
      setError('No cart data received from configurator');
      return;
    }

    try {
      // Decode the data
      const jsonString = Buffer.from(encodedData, 'base64url').toString('utf-8');
      const cartData: CartData = JSON.parse(jsonString);

      console.log('[from-configurator] Processing cart data:', cartData);

      if (!cartData.items || cartData.items.length === 0) {
        setStatus('error');
        setError('No items in cart data');
        return;
      }

      setStatus('adding');
      setMessage(`Adding ${cartData.items.length} item(s) to your cart...`);

      // Add each item to cart
      const addedItems: ConfiguratorItem[] = [];
      
      for (const item of cartData.items) {
        try {
          // Parse model/finish from description or model name
          const modelParts = item.model.split(' - ');
          const model = modelParts[0] || item.model;
          const finish = modelParts[1] || item.description || undefined;

          // Create cart item
          const cartItem: CartWheelItem = {
            type: 'wheel',
            sku: item.sku,
            brand: item.brand,
            model: model,
            finish: finish,
            imageUrl: item.imageUrl,
            unitPrice: item.price,
            quantity: item.quantity || 4,
            source: 'iconfigurator',
          };

          // Add to cart
          addItem(cartItem, 'iconfigurator');
          addedItems.push(item);
          
          console.log('[from-configurator] Added item:', item.sku);
        } catch (itemError) {
          console.error('[from-configurator] Error adding item:', item.sku, itemError);
        }
      }

      setItemsAdded(addedItems);

      if (addedItems.length > 0) {
        setStatus('success');
        setMessage(`Added ${addedItems.length} wheel(s) to your cart!`);
        
        // Open cart drawer
        setIsOpen(true);
        
        // Redirect to cart after short delay
        setTimeout(() => {
          router.push('/cart');
        }, 2000);
      } else {
        setStatus('error');
        setError('Failed to add items to cart');
      }

    } catch (parseError) {
      console.error('[from-configurator] Error parsing cart data:', parseError);
      setStatus('error');
      setError('Invalid cart data received');
    }
  }, [isHydrated, searchParams, addItem, setIsOpen, router]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
        {/* Status Icon */}
        <div className="text-6xl mb-6">
          {status === 'loading' && '⏳'}
          {status === 'adding' && '🛒'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>

        {/* Status Message */}
        <h1 className="text-2xl font-bold mb-2">
          {status === 'loading' && 'Processing...'}
          {status === 'adding' && 'Adding to Cart'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Error'}
        </h1>
        
        <p className="text-gray-400 mb-6">
          {error || message}
        </p>

        {/* Loading Spinner */}
        {(status === 'loading' || status === 'adding') && (
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Success: Show added items */}
        {status === 'success' && itemsAdded.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-400 mb-2">Items added:</p>
            {itemsAdded.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="w-12 h-12 object-contain bg-white rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.brand} {item.model}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === 'success' && (
            <>
              <Link 
                href="/cart" 
                className="block w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                View Cart
              </Link>
              <Link 
                href="/visualizer" 
                className="block w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                Continue Shopping
              </Link>
            </>
          )}
          
          {status === 'error' && (
            <>
              <Link 
                href="/visualizer" 
                className="block w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                Try Again
              </Link>
              <Link 
                href="/" 
                className="block w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                Go Home
              </Link>
            </>
          )}
        </div>

        {/* Debug Info (hidden by default) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer">Debug Info</summary>
            <pre className="mt-2 text-xs bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify({ status, itemsAdded, error }, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
