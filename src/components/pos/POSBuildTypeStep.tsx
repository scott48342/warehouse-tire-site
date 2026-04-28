"use client";

import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { useRouter } from "next/navigation";
import { usePOS, type POSBuildType, type POSLiftConfig, type SetupMode } from "./POSContext";
import {
  type StaggeredFitmentInfo,
  supportsStaggeredFitment,
  getDefaultSetupMode,
} from "@/lib/fitment/staggeredFitment";
import {
  getLiftProfile,
  getRecommendationForLiftHeight,
  type LiftLevel,
} from "@/lib/liftedRecommendations";

// Error Boundary for debugging
class BuildStepErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[POSBuildTypeStep] Error caught:", error);
    console.error("[POSBuildTypeStep] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="text-xl font-bold text-red-500 mb-4">Build Type Step Error</h1>
          <pre className="text-left text-xs text-red-300 bg-red-900/20 p-4 rounded overflow-auto">
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Quick Preset Type
// ============================================================================

type QuickPreset = {
  buildType: POSBuildType;
  liftInches: number;
  targetTireSize: number;
  presetId: "daily" | "offroad" | "extreme";
  label: string;
  description: string;
};

// ============================================================================
// Component
// ============================================================================

function POSBuildTypeStepInner() {
  const router = useRouter();
  const { state, setBuildType, setStaggeredInfo, setSetupMode, goToStep } = usePOS();
  
  // Debug logging
  console.log("[POSBuildTypeStep] state.vehicle:", state.vehicle);
  console.log("[POSBuildTypeStep] typeof state.vehicle:", typeof state.vehicle);

  // Local state - MUST be defined before any early returns (React hooks rule)
  const [selectedBuildType, setSelectedBuildType] = useState<POSBuildType>(state.buildType);
  const [liftHeight, setLiftHeight] = useState<number>(state.liftConfig?.liftInches || 4);
  const [targetTireSize, setTargetTireSize] = useState<number | undefined>(state.liftConfig?.targetTireSize);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [staggeredLoading, setStaggeredLoading] = useState(false);
  const [localStaggeredInfo, setLocalStaggeredInfo] = useState<StaggeredFitmentInfo | null>(state.staggeredInfo);
  const [selectedSetupMode, setSelectedSetupMode] = useState<SetupMode>(state.setupMode);

  // Fetch staggered info when component mounts
  useEffect(() => {
    if (!state.vehicle) return;

    const fetchStaggeredInfo = async () => {
      setStaggeredLoading(true);
      try {
        const params = new URLSearchParams({
          year: String(state.vehicle!.year),
          make: String(state.vehicle!.make),
          model: String(state.vehicle!.model),
        });
        if (state.vehicle!.trim) params.set("trim", String(state.vehicle!.trim));

        const res = await fetch(`/api/wheels/fitment-search?${params}&pageSize=1`);
        if (res.ok) {
          const data = await res.json();
          const staggered = data.fitment?.staggered;
          if (staggered) {
            const info: StaggeredFitmentInfo = {
              isStaggered: staggered.isStaggered,
              reason: staggered.reason,
              frontSpec: staggered.frontSpec,
              rearSpec: staggered.rearSpec,
            };
            setLocalStaggeredInfo(info);
            setStaggeredInfo(info);
            if (supportsStaggeredFitment(info)) {
              setSelectedSetupMode(getDefaultSetupMode(info));
            }
          }
        }
      } catch (err) {
        console.error("[POSBuildTypeStep] Failed to fetch staggered info:", err);
      } finally {
        setStaggeredLoading(false);
      }
    };

    fetchStaggeredInfo();
  }, [state.vehicle, setStaggeredInfo]);

  // Safety check - if no vehicle, show loading
  if (!state.vehicle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
        <p>Loading vehicle data...</p>
      </div>
    );
  }
  
  // TEMPORARY: Simple test render
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
      <h1 className="text-2xl font-bold">Build Type Step</h1>
      <p className="mt-4">Vehicle: {String(state.vehicle.year)} {String(state.vehicle.make)} {String(state.vehicle.model)}</p>
      <p className="mt-2">Trim: {state.vehicle.trim ? String(state.vehicle.trim) : "N/A"}</p>
      <p className="mt-4 text-green-400">If you see this, the component renders without error!</p>
      <button
        onClick={() => goToStep("vehicle")}
        className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg"
      >
        ← Back to Vehicle
      </button>
    </div>
  );
}

// Exported wrapper with error boundary
export function POSBuildTypeStep() {
  return (
    <BuildStepErrorBoundary>
      <POSBuildTypeStepInner />
    </BuildStepErrorBoundary>
  );
}
