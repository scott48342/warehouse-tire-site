'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

/**
 * iConfigurator Integration Test Page
 * 
 * HIDDEN TEST ROUTE - Do not link from nav/homepage until verified:
 * 
 * Questions to verify:
 * 1. Does the full configurator stay embedded, or redirect externally?
 * 2. Can selected wheels be added to OUR cart, or only iConfigurator quote?
 * 3. Does it only show our WheelPros wheels, or all wheels in their system?
 * 4. Can we pass vehicle/wheel data in and receive selections back?
 */

const ICONFIG_KEY = 'A6F5E900D32C0357FAF8';

export default function VisualizerTestPage() {
  const [events, setEvents] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(true);

  // Listen for any postMessage events from iConfigurator
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Log all postMessage events to see what iConfigurator sends
      const timestamp = new Date().toLocaleTimeString();
      const eventData = typeof event.data === 'object' 
        ? JSON.stringify(event.data, null, 2) 
        : String(event.data);
      
      setEvents(prev => [
        `[${timestamp}] Origin: ${event.origin}\nData: ${eventData}`,
        ...prev.slice(0, 19) // Keep last 20 events
      ]);
      
      console.log('[iConfigurator Event]', {
        origin: event.origin,
        data: event.data,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check for URL hash changes (some configurators use this)
  useEffect(() => {
    const handleHashChange = () => {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [
        `[${timestamp}] Hash changed: ${window.location.hash}`,
        ...prev.slice(0, 19)
      ]);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Test Header - Not customer facing */}
      <div className="bg-red-900/30 border-b border-red-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-red-400">⚠️ INTERNAL TEST PAGE - DO NOT SHARE</h1>
              <p className="text-sm text-red-300">iConfigurator Integration Verification</p>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 py-1 bg-gray-800 rounded text-sm"
            >
              {showDebug ? 'Hide' : 'Show'} Debug Panel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Verification Checklist */}
        {showDebug && (
          <div className="mb-6 bg-gray-900 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">📋 Verification Checklist</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" />
                  <span><strong>Q1:</strong> Does configurator stay embedded on this page, or redirect to iconfigurators.app?</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" />
                  <span><strong>Q2:</strong> When selecting a wheel, can it add to OUR cart? Or only &quot;Request Quote&quot; inside iConfig?</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" />
                  <span><strong>Q3:</strong> Do wheels shown match our WheelPros catalog? Or shows ALL wheels in their system?</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" />
                  <span><strong>Q4:</strong> Check Event Log below - does iConfig send wheel selection data we can capture?</span>
                </label>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-gray-800 rounded text-xs font-mono">
              <p className="text-gray-400 mb-1">Embed Key:</p>
              <p className="text-green-400">{ICONFIG_KEY}</p>
            </div>
          </div>
        )}

        {/* Event Log */}
        {showDebug && (
          <div className="mb-6 bg-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">📡 Event Log (postMessage listener)</h2>
              <button
                onClick={() => setEvents([])}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <div className="bg-gray-800 rounded p-3 h-48 overflow-auto font-mono text-xs">
              {events.length === 0 ? (
                <p className="text-gray-500">Listening for postMessage events from iConfigurator...</p>
              ) : (
                events.map((event, i) => (
                  <pre key={i} className="text-green-400 mb-2 whitespace-pre-wrap border-b border-gray-700 pb-2">
                    {event}
                  </pre>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              If iConfigurator sends wheel selection data via postMessage, it will appear here.
            </p>
          </div>
        )}

        {/* iConfigurator Embed */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold">Wheel Visualizer</h2>
            <span className="text-xs text-gray-500">Powered by iConfigurator</span>
          </div>
          
          {/* The actual iConfigurator embed */}
          <div className="min-h-[700px] bg-white">
            <div id="icf_page"></div>
          </div>
        </div>

        {/* Alternative: Vehicle Selector Dropdown Test */}
        {showDebug && (
          <div className="mt-6 bg-gray-900 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">🚗 Vehicle Selector Dropdown (Alternative Embed)</h2>
            <p className="text-sm text-gray-400 mb-4">
              This is the dropdown-only version. It should link to the full configurator.
            </p>
            <div className="bg-white rounded p-4">
              <div id="icon-vehicle-select"></div>
            </div>
          </div>
        )}

        {/* Integration Notes */}
        {showDebug && (
          <div className="mt-6 bg-blue-900/20 rounded-xl p-6 border border-blue-700/50">
            <h2 className="text-lg font-semibold mb-4 text-blue-400">📝 Integration Notes</h2>
            <div className="text-sm space-y-2 text-gray-300">
              <p><strong>If Q1 = Stays embedded:</strong> Great, we can host it on our domain.</p>
              <p><strong>If Q2 = Has callbacks:</strong> We can capture wheel SKU and add to our cart.</p>
              <p><strong>If Q2 = Quote only:</strong> May need to contact iConfigurator about cart integration API.</p>
              <p><strong>If Q3 = Shows all wheels:</strong> Check admin panel &quot;Map Configurator to Brands&quot; settings.</p>
              <p><strong>If Q4 = No events:</strong> Check their API docs or contact support for integration options.</p>
            </div>
          </div>
        )}
      </div>

      {/* Load iConfigurator Scripts */}
      <Script
        src={`//iconfigurators.app/src/embed.cfm?ky=${ICONFIG_KEY}`}
        strategy="afterInteractive"
      />
      
      {/* Vehicle selector dropdown script */}
      <Script
        src="https://iconfigurators.app/src/icon-vehicle-select/simple-embed.js"
        data-key={ICONFIG_KEY}
        data-target-url={`${typeof window !== 'undefined' ? window.location.origin : ''}/visualizer/#/init`}
        strategy="afterInteractive"
      />
    </div>
  );
}
