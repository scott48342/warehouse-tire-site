"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/abandoned-carts", label: "Abandoned Carts", icon: "🛒" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/fitment", label: "Fitment", icon: "🔧" },
  { href: "/admin/fitment-api", label: "Fitment API", icon: "🔑" },
  { href: "/admin/validation", label: "Validation", icon: "✅" },
  { href: "/admin/products", label: "Products", icon: "🛞" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "🏭" },
  { href: "/admin/api-usage", label: "API Usage", icon: "🔍" },
  { href: "/admin/logs", label: "Logs", icon: "📋" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

function LoginForm({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        onLogin(password);
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-neutral-800 rounded-2xl p-8 shadow-xl border border-neutral-700">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔐</div>
            <h1 className="text-xl font-bold text-white">Admin Portal</h1>
            <p className="text-sm text-neutral-400 mt-1">Warehouse Tire</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-lg bg-neutral-700 border border-neutral-600 px-4 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
              ← Back to shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-neutral-800 border-r border-neutral-700 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-neutral-700">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <div className="font-bold text-white">Admin Portal</div>
            <div className="text-xs text-neutral-400">Warehouse Tire</div>
          </div>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/admin" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-red-600 text-white"
                  : "text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-700">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Shop</span>
        </Link>
      </div>
    </aside>
  );
}

function AdminHeader() {
  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    window.location.reload();
  };

  return (
    <header className="h-14 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
      <div className="text-sm text-neutral-400">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-neutral-400 hover:text-white transition-colors"
      >
        Sign Out
      </button>
    </header>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if already authenticated
    const stored = sessionStorage.getItem("admin_auth");
    if (stored) {
      // Verify the session is still valid
      fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: stored }),
      })
        .then((res) => setAuthed(res.ok))
        .catch(() => setAuthed(false));
    } else {
      setAuthed(false);
    }
  }, []);

  const handleLogin = (password: string) => {
    sessionStorage.setItem("admin_auth", password);
    setAuthed(true);
  };

  // Loading state
  if (authed === null) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!authed) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Authenticated
  return (
    <div className="min-h-screen bg-neutral-900 flex">
      <AdminNav />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
