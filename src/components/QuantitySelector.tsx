"use client";

import { useState, useEffect } from "react";

type QuantitySelectorProps = {
  value: number;
  onChange: (qty: number) => void;
  presets?: number[];
  min?: number;
  max?: number;
  label?: string;
  className?: string;
};

/**
 * Quantity selector with preset buttons and optional custom input.
 * Default presets: 1, 2, 4, 5 (4 selected by default)
 */
export function QuantitySelector({
  value,
  onChange,
  presets = [1, 2, 4, 5],
  min = 1,
  max = 20,
  label = "Quantity",
  className = "",
}: QuantitySelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());

  // Check if current value is a preset
  const isPreset = presets.includes(value);

  // Update custom value when value changes externally
  useEffect(() => {
    if (!isPreset) {
      setCustomValue(value.toString());
      setShowCustom(true);
    }
  }, [value, isPreset]);

  const handlePresetClick = (qty: number) => {
    setShowCustom(false);
    onChange(qty);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomValue(raw);
    
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
  };

  const handleCustomBlur = () => {
    const num = parseInt(customValue, 10);
    if (isNaN(num) || num < min) {
      setCustomValue(min.toString());
      onChange(min);
    } else if (num > max) {
      setCustomValue(max.toString());
      onChange(max);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-600">{label}</span>
        {!showCustom && (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-700 underline"
          >
            Custom
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {presets.map((qty) => (
          <button
            key={qty}
            type="button"
            onClick={() => handlePresetClick(qty)}
            className={`
              flex h-10 min-w-[44px] items-center justify-center rounded-lg border text-sm font-bold transition-all
              ${value === qty && !showCustom
                ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
              }
            `}
          >
            {qty}
          </button>
        ))}
        
        {showCustom && (
          <div className="relative">
            <input
              type="number"
              min={min}
              max={max}
              value={customValue}
              onChange={handleCustomChange}
              onBlur={handleCustomBlur}
              className={`
                h-10 w-16 rounded-lg border text-center text-sm font-bold transition-all
                ${!isPreset
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700"
                }
                focus:outline-none focus:ring-2 focus:ring-neutral-400
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              `}
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}
