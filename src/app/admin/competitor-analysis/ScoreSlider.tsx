"use client";

interface ScoreSliderProps {
  label: string;
  description?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

export function ScoreSlider({ label, description, value, onChange, disabled }: ScoreSliderProps) {
  const displayValue = value ?? 5;
  
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400 bg-green-900/30";
    if (score >= 6) return "text-blue-400 bg-blue-900/30";
    if (score >= 4) return "text-yellow-400 bg-yellow-900/30";
    return "text-red-400 bg-red-900/30";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-neutral-300">{label}</label>
          {description && (
            <p className="text-xs text-neutral-500">{description}</p>
          )}
        </div>
        <div className={`px-2 py-0.5 rounded text-sm font-bold ${getScoreColor(displayValue)}`}>
          {value !== null ? value : "-"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={displayValue}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-neutral-500 hover:text-neutral-300"
          title="Clear score"
        >
          ✕
        </button>
      </div>
      <div className="flex justify-between text-xs text-neutral-600">
        <span>0 - Poor</span>
        <span>5 - Average</span>
        <span>10 - Excellent</span>
      </div>
    </div>
  );
}

interface ScoreComparisonProps {
  category: string;
  ourScore: number | null;
  competitorScore: number | null;
}

export function ScoreComparison({ category, ourScore, competitorScore }: ScoreComparisonProps) {
  const our = ourScore ?? 0;
  const comp = competitorScore ?? 0;
  const diff = our - comp;
  
  const getBarColor = (isUs: boolean, score: number) => {
    if (score >= 8) return isUs ? "bg-green-500" : "bg-green-600/50";
    if (score >= 6) return isUs ? "bg-blue-500" : "bg-blue-600/50";
    if (score >= 4) return isUs ? "bg-yellow-500" : "bg-yellow-600/50";
    return isUs ? "bg-red-500" : "bg-red-600/50";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400">{category}</span>
        <span className={`font-medium ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-neutral-400"}`}>
          {diff > 0 ? `+${diff}` : diff}
        </span>
      </div>
      <div className="flex gap-1 h-4">
        <div className="flex-1 flex items-center">
          <div 
            className={`h-full rounded-l ${getBarColor(true, our)}`}
            style={{ width: `${our * 10}%` }}
          />
          <span className="text-xs text-neutral-400 ml-1">{ourScore ?? "-"}</span>
        </div>
        <div className="w-px bg-neutral-600" />
        <div className="flex-1 flex items-center justify-end">
          <span className="text-xs text-neutral-400 mr-1">{competitorScore ?? "-"}</span>
          <div 
            className={`h-full rounded-r ${getBarColor(false, comp)}`}
            style={{ width: `${comp * 10}%` }}
          />
        </div>
      </div>
    </div>
  );
}
