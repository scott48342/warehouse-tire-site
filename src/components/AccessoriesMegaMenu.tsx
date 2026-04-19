"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ACCESSORY_CATEGORIES, Category, SubCategory, buildAccessoryUrl } from "@/lib/accessories/categories";

/**
 * Accessories Mega Menu
 * 
 * Hover-based dropdown with two-level hierarchy:
 * - Level 1: Main categories (Wheel Installation, Wheel Accessories, Lighting)
 * - Level 2: Subcategories appear when hovering over level 1
 */

export function AccessoriesMegaMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Delay close to allow mouse movement between elements
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setActiveCategory(null);
    }, 150);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleCategoryHover = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveCategory(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeParent = ACCESSORY_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div 
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger - matches Header nav style */}
      <button
        type="button"
        className="list-none cursor-pointer inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200"
      >
        ACCESSORIES <span className="text-xs">▾</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 flex bg-white border border-gray-200 rounded-lg shadow-xl min-w-[600px]">
          {/* Level 1: Main Categories */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 py-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Categories
            </div>
            {ACCESSORY_CATEGORIES.map((category) => (
              <div
                key={category.id}
                onMouseEnter={() => handleCategoryHover(category.id)}
                className={`
                  px-4 py-3 cursor-pointer flex items-center justify-between
                  ${activeCategory === category.id 
                    ? "bg-white border-r-2 border-blue-600 text-blue-600" 
                    : "hover:bg-gray-100 text-gray-700"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{category.icon}</span>
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-xs text-gray-500">{category.description}</div>
                  </div>
                </div>
                {category.children && category.children.length > 0 && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
            
            {/* View All */}
            <Link
              href="/accessories"
              className="block px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-200 mt-2"
            >
              View All Accessories →
            </Link>
          </div>

          {/* Level 2: Subcategories */}
          <div className="w-72 py-2 px-4">
            {activeParent ? (
              <>
                <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {activeParent.name}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {activeParent.children?.map((sub) => (
                    <Link
                      key={sub.id}
                      href={buildAccessoryUrl(activeParent.id, sub.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors group"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="text-lg opacity-70 group-hover:opacity-100">{sub.icon}</span>
                      <span className="text-gray-700 group-hover:text-gray-900">{sub.name}</span>
                    </Link>
                  ))}
                </div>
                
                {/* View All for this category */}
                <Link
                  href={`/accessories?category=${activeParent.id === 'wheel_installation' ? 'lug_nut' : activeParent.id === 'wheel_accessories' ? 'center_cap' : 'lighting'}`}
                  className="block mt-4 px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setIsOpen(false)}
                >
                  View All {activeParent.name} →
                </Link>
              </>
            ) : (
              <div className="py-8 text-center text-gray-400">
                <div className="text-2xl mb-2">👈</div>
                <div className="text-sm">Hover a category to see options</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile or smaller layouts
 */
export function AccessoriesMenuMobile({ onClose }: { onClose?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="py-2">
      {ACCESSORY_CATEGORIES.map((category) => (
        <div key={category.id} className="border-b border-gray-100 last:border-0">
          <button
            onClick={() => setExpanded(expanded === category.id ? null : category.id)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <span>{category.icon}</span>
              <span className="font-medium text-gray-900">{category.name}</span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded === category.id ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expanded === category.id && category.children && (
            <div className="bg-gray-50 px-4 py-2">
              {category.children.map((sub) => (
                <Link
                  key={sub.id}
                  href={buildAccessoryUrl(category.id, sub.id)}
                  className="block py-2 px-4 text-gray-600 hover:text-blue-600"
                  onClick={onClose}
                >
                  {sub.icon} {sub.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
      
      <Link
        href="/accessories"
        className="block px-4 py-3 text-blue-600 font-medium"
        onClick={onClose}
      >
        View All Accessories
      </Link>
    </div>
  );
}
