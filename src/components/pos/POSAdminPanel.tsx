"use client";

import { useState } from "react";
import { usePOS, type POSAdminSettings } from "./POSContext";

export function POSAdminPanel() {
  const { state, setAdminSettings, toggleAdminPanel } = usePOS();
  const { adminSettings, showAdminPanel } = state;
  
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newAddonPerUnit, setNewAddonPerUnit] = useState(false);
  
  if (!showAdminPanel) return null;
  
  const handleUpdateSetting = (key: keyof POSAdminSettings, value: number) => {
    setAdminSettings({ [key]: value });
  };
  
  const handleAddCustomAddon = () => {
    if (!newAddonName.trim() || !newAddonPrice) return;
    
    const newAddon = {
      id: `custom_${Date.now()}`,
      name: newAddonName.trim(),
      price: parseFloat(newAddonPrice),
      perUnit: newAddonPerUnit,
    };
    
    setAdminSettings({
      customAddOns: [...adminSettings.customAddOns, newAddon],
    });
    
    setNewAddonName("");
    setNewAddonPrice("");
    setNewAddonPerUnit(false);
  };
  
  const handleRemoveCustomAddon = (id: string) => {
    setAdminSettings({
      customAddOns: adminSettings.customAddOns.filter((a) => a.id !== id),
    });
  };
  
  const handleUpdateCustomAddon = (id: string, updates: Partial<typeof adminSettings.customAddOns[0]>) => {
    setAdminSettings({
      customAddOns: adminSettings.customAddOns.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    });
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">⚙️ Admin Settings</h2>
            <p className="text-sm text-neutral-400">Configure pricing for labor and add-ons</p>
          </div>
          <button
            onClick={toggleAdminPanel}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Tax Rate Notice */}
          <div className="rounded-xl bg-blue-900/30 border border-blue-700/50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="font-semibold text-blue-300">Tax Rate: 6%</div>
                <div className="text-sm text-blue-400">Michigan sales tax - fixed rate</div>
              </div>
            </div>
          </div>
          
          {/* Labor Pricing */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">💪 Labor Pricing</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Mount & Balance (per wheel)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">$</span>
                  <input
                    type="number"
                    value={adminSettings.laborPerWheel}
                    onChange={(e) => handleUpdateSetting("laborPerWheel", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right"
                  />
                  <span className="text-neutral-400">× 4 = ${(adminSettings.laborPerWheel * 4).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Standard Add-ons */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">🔧 Standard Add-ons</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  TPMS Sensor/Programming (per sensor)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">$</span>
                  <input
                    type="number"
                    value={adminSettings.tpmsPerSensor}
                    onChange={(e) => handleUpdateSetting("tpmsPerSensor", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right"
                  />
                  <span className="text-neutral-400">× 4 = ${(adminSettings.tpmsPerSensor * 4).toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Tire Disposal (per tire)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">$</span>
                  <input
                    type="number"
                    value={adminSettings.disposalPerTire}
                    onChange={(e) => handleUpdateSetting("disposalPerTire", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right"
                  />
                  <span className="text-neutral-400">× 4 = ${(adminSettings.disposalPerTire * 4).toFixed(2)}</span>
                </div>
              </div>
              
            </div>
          </div>
          
          {/* Credit Card Fee */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">💳 Credit Card Fee</h3>
            
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Processing Fee (% of total)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  value={adminSettings.creditCardFeePercent}
                  onChange={(e) => handleUpdateSetting("creditCardFeePercent", parseFloat(e.target.value) || 0)}
                  className="w-24 h-10 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right"
                />
                <span className="text-neutral-400">%</span>
                <span className="text-sm text-neutral-500">Applied when customer pays with card</span>
              </div>
            </div>
          </div>
          
          {/* Custom Add-ons */}
          <div className="rounded-xl bg-neutral-800 border border-neutral-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">✨ Custom Add-ons</h3>
            
            {/* Existing custom add-ons */}
            {adminSettings.customAddOns.length > 0 && (
              <div className="space-y-3 mb-4">
                {adminSettings.customAddOns.map((addon) => (
                  <div key={addon.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-700/50">
                    <input
                      type="text"
                      value={addon.name}
                      onChange={(e) => handleUpdateCustomAddon(addon.id, { name: e.target.value })}
                      className="flex-1 h-9 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-sm"
                    />
                    <span className="text-neutral-400">$</span>
                    <input
                      type="number"
                      value={addon.price}
                      onChange={(e) => handleUpdateCustomAddon(addon.id, { price: parseFloat(e.target.value) || 0 })}
                      className="w-20 h-9 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        checked={addon.perUnit}
                        onChange={(e) => handleUpdateCustomAddon(addon.id, { perUnit: e.target.checked })}
                        className="rounded"
                      />
                      ×4
                    </label>
                    <button
                      onClick={() => handleRemoveCustomAddon(addon.id)}
                      className="p-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new custom add-on */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-700/30 border border-dashed border-neutral-600">
              <input
                type="text"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                placeholder="Add-on name..."
                className="flex-1 h-9 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-sm placeholder-neutral-500"
              />
              <span className="text-neutral-400">$</span>
              <input
                type="number"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                placeholder="0"
                className="w-20 h-9 rounded-lg bg-neutral-700 border border-neutral-600 text-white px-3 text-right text-sm placeholder-neutral-500"
              />
              <label className="flex items-center gap-1 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  checked={newAddonPerUnit}
                  onChange={(e) => setNewAddonPerUnit(e.target.checked)}
                  className="rounded"
                />
                ×4
              </label>
              <button
                onClick={handleAddCustomAddon}
                disabled={!newAddonName.trim() || !newAddonPrice}
                className="px-3 h-9 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              Settings are saved automatically
            </p>
            <button
              onClick={toggleAdminPanel}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
