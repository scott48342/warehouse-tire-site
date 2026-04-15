"use client";

import { useState, useEffect } from "react";

const SESSION_KEY = "pos_authenticated";
const STORAGE_KEY = "pos_pin";

// Default PIN - can be changed in admin settings
const DEFAULT_PIN = "1234";

export function POSAuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  
  // Check authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem(SESSION_KEY) === "true";
    setAuthenticated(isAuth);
  }, []);
  
  // Get stored PIN or use default
  const getStoredPin = (): string => {
    if (typeof window === "undefined") return DEFAULT_PIN;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PIN;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = getStoredPin();
    
    if (pin === storedPin) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };
  
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPin.length < 4) {
      alert("PIN must be at least 4 characters");
      return;
    }
    
    if (newPin !== confirmPin) {
      alert("PINs do not match");
      return;
    }
    
    localStorage.setItem(STORAGE_KEY, newPin);
    setShowChange(false);
    setNewPin("");
    setConfirmPin("");
    alert("PIN changed successfully!");
  };
  
  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
    setPin("");
  };
  
  // Loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-pulse text-neutral-500">Loading...</div>
      </div>
    );
  }
  
  // Not authenticated - show PIN entry
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-white">POS Access</h1>
            <p className="text-neutral-400 mt-2">Enter PIN to continue</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="Enter PIN"
                autoFocus
                className={`
                  w-full h-14 text-center text-2xl tracking-[0.5em] font-mono
                  rounded-xl bg-neutral-800 border-2 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${error ? "border-red-500 shake" : "border-neutral-700"}
                `}
              />
              {error && (
                <p className="text-red-400 text-sm text-center mt-2">
                  Incorrect PIN. Try again.
                </p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={!pin}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold transition-colors"
            >
              Unlock
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowChange(!showChange)}
              className="text-neutral-500 hover:text-neutral-400 text-sm"
            >
              {showChange ? "Cancel" : "Change PIN"}
            </button>
          </div>
          
          {showChange && (
            <form onSubmit={handleChangePin} className="mt-4 space-y-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
              <div className="text-sm text-neutral-400 mb-2">Set new PIN:</div>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN"
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-center tracking-widest"
              />
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-center tracking-widest"
              />
              <button
                type="submit"
                disabled={!newPin || !confirmPin}
                className="w-full h-10 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 text-white font-medium text-sm"
              >
                Save New PIN
              </button>
            </form>
          )}
          
          <p className="mt-8 text-center text-xs text-neutral-600">
            Warehouse Tire Direct • Employee Access Only
          </p>
        </div>
        
        <style jsx>{`
          .shake {
            animation: shake 0.3s ease-in-out;
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
        `}</style>
      </div>
    );
  }
  
  // Authenticated - render children with logout option available
  return (
    <>
      {children}
      {/* Hidden logout button - accessible via admin panel or URL */}
      <button
        onClick={handleLogout}
        className="fixed bottom-4 left-4 p-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700 text-neutral-500 hover:text-white text-xs opacity-30 hover:opacity-100 transition-all z-50"
        title="Lock POS"
      >
        🔒
      </button>
    </>
  );
}
