'use client';

/**
 * Revenue Diagnostics - Conversion Funnel Dashboard
 * 
 * URL: /admin/analytics
 */

import { useState, useEffect } from 'react';

interface FunnelStep {
  name: string;
  label: string;
  count: number;
  rate: number;
  overallRate: number;
}

interface DropOff {
  from: string;
  to: string;
  dropRate: number;
  lost: number;
}

interface FunnelData {
  ok: boolean;
  period: string;
  startDate: string;
  endDate: string;
  mainFunnel: FunnelStep[];
  popupFunnel: FunnelStep[];
  segments: any;
  dropOffs: DropOff[];
  summary: {
    totalSessions: number;
    totalPurchases: number;
    conversionRate: string;
  };
}

function FunnelBar({ step, maxCount, index }: { step: FunnelStep; maxCount: number; index: number }) {
  const width = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
  const colors = [
    'bg-blue-500', 'bg-blue-400', 'bg-green-500', 'bg-green-400',
    'bg-yellow-500', 'bg-yellow-400', 'bg-orange-500', 'bg-red-500'
  ];
  
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{step.label}</span>
        <span className="text-gray-600">
          {step.count.toLocaleString()} 
          {index > 0 && (
            <span className={step.rate >= 50 ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
              ({step.rate}% ↓)
            </span>
          )}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
        <div
          className={`h-6 rounded-full ${colors[index % colors.length]} transition-all duration-500 flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(width, 2)}%` }}
        >
          <span className="text-xs text-white font-medium">
            {step.overallRate}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DropOffCard({ dropOff }: { dropOff: DropOff }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="text-sm text-red-800 font-medium">
        {dropOff.from} → {dropOff.to}
      </div>
      <div className="text-2xl font-bold text-red-600">
        -{dropOff.dropRate.toFixed(1)}%
      </div>
      <div className="text-xs text-red-600">
        {dropOff.lost.toLocaleString()} users lost
      </div>
    </div>
  );
}

function SegmentTable({ data, title }: { data: Record<string, Record<string, number>>; title: string }) {
  if (!data || Object.keys(data).length === 0) return null;
  
  const segments = Object.keys(data);
  const events = ['session_start', 'product_view', 'add_to_cart', 'begin_checkout', 'purchase'];
  const eventLabels: Record<string, string> = {
    session_start: 'Sessions',
    product_view: 'Views',
    add_to_cart: 'Cart',
    begin_checkout: 'Checkout',
    purchase: 'Purchase',
  };
  
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Segment</th>
              {events.map(e => (
                <th key={e} className="text-right py-2 px-3">{eventLabels[e]}</th>
              ))}
              <th className="text-right py-2 px-3">Conv %</th>
            </tr>
          </thead>
          <tbody>
            {segments.slice(0, 10).map(seg => {
              const sessions = data[seg]?.session_start || 0;
              const purchases = data[seg]?.purchase || 0;
              const convRate = sessions > 0 ? ((purchases / sessions) * 100).toFixed(2) : '0';
              
              return (
                <tr key={seg} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">{seg}</td>
                  {events.map(e => (
                    <td key={e} className="text-right py-2 px-3">
                      {(data[seg]?.[e] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="text-right py-2 px-3 font-semibold">
                    {convRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [segment, setSegment] = useState<'device' | 'storeMode' | 'trafficSource'>('device');
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/admin/analytics/funnel?period=${period}&segment=${segment}`);
        const json = await res.json();
        
        if (json.ok) {
          setData(json);
        } else {
          setError(json.error || 'Failed to load data');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [period, segment]);
  
  const maxCount = data?.mainFunnel?.[0]?.count || 1;
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Revenue Diagnostics</h1>
              <p className="text-gray-600">Conversion Funnel Analytics</p>
            </div>
            
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as '7d' | '30d')}
                  className="border rounded px-3 py-2 bg-white"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">Segment By</label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as any)}
                  className="border rounded px-3 py-2 bg-white"
                >
                  <option value="device">Device Type</option>
                  <option value="storeMode">Local vs National</option>
                  <option value="trafficSource">Traffic Source</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading funnel data...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
            <p className="text-sm text-red-600 mt-2">
              Make sure the funnel_events table exists and has data.
            </p>
          </div>
        )}
        
        {data && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">Total Sessions</div>
                <div className="text-3xl font-bold text-gray-900">
                  {data.summary.totalSessions.toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">Total Purchases</div>
                <div className="text-3xl font-bold text-green-600">
                  {data.summary.totalPurchases.toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">Conversion Rate</div>
                <div className="text-3xl font-bold text-blue-600">
                  {data.summary.conversionRate}%
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500">Period</div>
                <div className="text-lg font-medium text-gray-700">
                  {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Funnel */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Purchase Funnel</h2>
                {data.mainFunnel.map((step, i) => (
                  <FunnelBar key={step.name} step={step} maxCount={maxCount} index={i} />
                ))}
              </div>
              
              {/* Drop-offs */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">🔴 Biggest Drop-offs</h2>
                <div className="space-y-3">
                  {data.dropOffs.map((d, i) => (
                    <DropOffCard key={i} dropOff={d} />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Popup Funnel */}
            {data.popupFunnel && data.popupFunnel[0]?.count > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4">First Order Popup Funnel</h2>
                <div className="max-w-2xl">
                  {data.popupFunnel.map((step, i) => (
                    <FunnelBar key={step.name} step={step} maxCount={data.popupFunnel[0].count} index={i} />
                  ))}
                </div>
              </div>
            )}
            
            {/* Segments */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold mb-4">Segment Analysis</h2>
              
              {segment === 'device' && data.segments?.byDevice && (
                <SegmentTable data={data.segments.byDevice} title="By Device Type" />
              )}
              
              {segment === 'storeMode' && data.segments?.byStoreMode && (
                <SegmentTable data={data.segments.byStoreMode} title="Local vs National" />
              )}
              
              {segment === 'trafficSource' && data.segments?.byTrafficSource && (
                <SegmentTable data={data.segments.byTrafficSource} title="By Traffic Source" />
              )}
              
              {(!data.segments || Object.keys(data.segments).length === 0) && (
                <p className="text-gray-500 italic">No segment data available yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
