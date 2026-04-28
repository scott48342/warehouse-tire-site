"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import {
  usePOS,
  POSStepIndicator,
  POSFooter,
  POSVehicleStep,
  POSBuildTypeStep,
} from "@/components/pos";

// Error Boundary
class POSErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[POS ERROR]", error);
    console.error("[POS STACK]", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-950 text-white p-8">
          <h1 className="text-2xl font-bold text-red-400 mb-4">POS Error</h1>
          <pre className="text-sm text-red-200 bg-red-900/50 p-4 rounded mb-4 overflow-auto whitespace-pre-wrap">
            {this.state.error?.message}
          </pre>
          <pre className="text-xs text-red-300 bg-red-900/30 p-4 rounded overflow-auto whitespace-pre-wrap">
            {this.state.error?.stack}
          </pre>
          {this.state.errorInfo && (
            <pre className="text-xs text-red-300 bg-red-900/30 p-4 rounded mt-4 overflow-auto whitespace-pre-wrap">
              Component Stack:{this.state.errorInfo.componentStack}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 rounded hover:bg-red-500"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Placeholder for steps we're not testing
function PlaceholderStep({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="mt-4 text-neutral-400">This step is disabled for testing</p>
    </div>
  );
}

// Step Router
function StepRouter() {
  const { state } = usePOS();
  
  console.log("[StepRouter] Current step:", state.step);
  
  switch (state.step) {
    case "vehicle":
      return <POSVehicleStep />;
    case "build-type":
      return <POSBuildTypeStep />;
    case "package":
      return <PlaceholderStep name="Package Step" />;
    case "pricing":
      return <PlaceholderStep name="Pricing Step" />;
    case "quote":
      return <PlaceholderStep name="Quote Step" />;
    default:
      return <POSVehicleStep />;
  }
}

// Main POS Page Client
export function POSPageClient() {
  return (
    <POSErrorBoundary>
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
        <POSStepIndicator />
        <main className="flex-1">
          <StepRouter />
        </main>
        <POSFooter />
      </div>
    </POSErrorBoundary>
  );
}
