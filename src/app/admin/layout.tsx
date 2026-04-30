"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// PWA setup for admin
function usePWASetup() {
  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (!manifest) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/admin-manifest.json';
      document.head.appendChild(link);
    }

    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.setAttribute('name', 'theme-color');
      themeColor.setAttribute('content', '#171717');
      document.head.appendChild(themeColor);
    }

    const appleMeta = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'WT Admin' },
    ];
    
    appleMeta.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    });

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/admin-icon-192.png';
      document.head.appendChild(icon);
    }

    // Prevent zoom on input focus (iOS)
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    }
  }, []);
}

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { href: "/admin/live", label: "Live", icon: "🟢" },
  { href: "/admin/sessions", label: "Sessions", icon: "🕐" },
  { href: "/admin/analytics", label: "Funnel", icon: "📈" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/abandoned-carts", label: "Carts", icon: "🛒" },
  { href: "/admin/email-automation", label: "Automation", icon: "🤖" },
  { href: "/admin/subscribers", label: "Subscribers", icon: "📬" },
  { href: "/admin/email-campaigns", label: "Campaigns", icon: "📧" },
  { href: "/admin/fitment-api", label: "API Keys", icon: "🔑" },
  { href: "/admin/fitment", label: "Fitment", icon: "🔧" },
  { href: "/admin/fitment-coverage", label: "Coverage", icon: "📈" },
  { href: "/admin/fitment-audit", label: "Export", icon: "📤" },
  { href: "/admin/products", label: "Products", icon: "🛞" },
  { href: "/admin/tire-images", label: "Images", icon: "🖼️" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "🏭" },
  { href: "/admin/logs", label: "Logs", icon: "📋" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

// Quick access items for bottom nav on mobile
const QUICK_NAV = [
  { href: "/admin", label: "Home", icon: "📊", exact: true },
  { href: "/admin/live", label: "Live", icon: "🟢" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/abandoned-carts", label: "Carts", icon: "🛒" },
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
                className="w-full h-12 rounded-lg bg-neutral-700 border border-neutral-600 px-4 text-white text-base placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              className="w-full h-12 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const currentPage = NAV_ITEMS.find(item => 
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
  ) || NAV_ITEMS[0];

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
      <button
        onClick={onMenuOpen}
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-800 text-xl"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <span className="text-lg">{currentPage.icon}</span>
        <span className="font-semibold text-white">{currentPage.label}</span>
      </div>
      <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-800 text-sm">
        🏠
      </Link>
    </header>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-900 border-t border-neutral-800 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around py-2">
        {QUICK_NAV.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg min-w-[60px] ${
                isActive ? "text-red-500" : "text-neutral-400"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Menu panel */}
      <div className="absolute left-0 top-0 bottom-0 w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <div className="font-bold text-white">Admin</div>
              <div className="text-xs text-neutral-500">Warehouse Tire</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-800 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact 
              ? pathname === item.href 
              : pathname.startsWith(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 space-y-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 hover:bg-neutral-800 active:bg-neutral-700"
          >
            <span>🏠</span>
            <span>Back to Shop</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-neutral-800 active:bg-neutral-700"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    window.location.reload();
  };

  return (
    <aside className="hidden lg:flex w-64 bg-neutral-800 border-r border-neutral-700 flex-col">
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
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);
          
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
      <div className="p-4 border-t border-neutral-700 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Shop</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function DesktopHeader() {
  return (
    <header className="hidden lg:flex h-14 bg-neutral-800 border-b border-neutral-700 items-center justify-between px-6">
      <div className="text-sm text-neutral-400">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  usePWASetup();

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_auth");
    if (stored) {
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

  // Close menu on route change
  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (authed === null) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex">
      {/* Desktop sidebar */}
      <DesktopSidebar />
      
      {/* Mobile menu overlay */}
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <MobileHeader onMenuOpen={() => setMenuOpen(true)} />
        
        {/* Desktop header */}
        <DesktopHeader />
        
        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-24 lg:pb-6">
          {children}
        </main>
        
        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
