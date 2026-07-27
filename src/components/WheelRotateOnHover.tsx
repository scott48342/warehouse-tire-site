"use client";

/**
 * WheelRotateOnHover - Slowly rotates wheel image on hover
 * Inspired by diablowheelsusa.com wheel collection effect
 * 
 * Usage:
 *   <WheelRotateOnHover>
 *     <img src={wheelImage} alt="Wheel" />
 *   </WheelRotateOnHover>
 * 
 * Props:
 *   - duration: rotation duration in seconds (default: 20)
 *   - className: additional classes for the wrapper
 *   - disabled: disable rotation (e.g., for staggered wheels that shouldn't rotate)
 */

import { type ReactNode } from "react";

interface WheelRotateOnHoverProps {
  children: ReactNode;
  duration?: number;
  className?: string;
  disabled?: boolean;
}

export function WheelRotateOnHover({
  children,
  duration = 20,
  className = "",
  disabled = false,
}: WheelRotateOnHoverProps) {
  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`wheel-rotate-container ${className}`}
      style={{
        // CSS custom property for duration
        "--wheel-rotate-duration": `${duration}s`,
      } as React.CSSProperties}
    >
      {children}
      <style jsx>{`
        .wheel-rotate-container :global(img) {
          transition: transform 0.3s ease-out;
        }
        .wheel-rotate-container:hover :global(img) {
          animation: wheel-spin var(--wheel-rotate-duration, 20s) linear infinite;
        }
        @keyframes wheel-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Alternative: CSS-only approach via global styles
 * Add this to globals.css if you prefer not using styled-jsx:
 * 
 * .wheel-rotate-hover img {
 *   transition: transform 0.3s ease-out;
 * }
 * .wheel-rotate-hover:hover img {
 *   animation: wheel-spin 20s linear infinite;
 * }
 * @keyframes wheel-spin {
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(360deg); }
 * }
 */
