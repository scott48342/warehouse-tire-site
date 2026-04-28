"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class POSLayoutErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[POS LAYOUT ERROR]", error);
    console.error("[POS LAYOUT STACK]", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-950 text-white p-8">
          <h1 className="text-2xl font-bold text-red-400 mb-4">POS Layout Error</h1>
          <p className="text-red-200 mb-4">
            Something went wrong in the POS system. Please try refreshing the page.
          </p>
          <div className="bg-red-900/50 p-4 rounded mb-4">
            <h2 className="text-lg font-bold text-red-300 mb-2">Error Message:</h2>
            <pre className="text-sm text-red-200 overflow-auto whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
          </div>
          <div className="bg-red-900/30 p-4 rounded mb-4">
            <h2 className="text-lg font-bold text-red-300 mb-2">Stack Trace:</h2>
            <pre className="text-xs text-red-300 overflow-auto whitespace-pre-wrap max-h-64">
              {this.state.error?.stack}
            </pre>
          </div>
          {this.state.errorInfo && (
            <div className="bg-red-900/20 p-4 rounded mb-4">
              <h2 className="text-lg font-bold text-red-300 mb-2">Component Stack:</h2>
              <pre className="text-xs text-red-300 overflow-auto whitespace-pre-wrap max-h-64">
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-red-600 rounded hover:bg-red-500 font-bold"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
