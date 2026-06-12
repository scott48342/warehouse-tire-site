"use client";

import { useState, useEffect } from "react";
import { Phone, Copy, Check, X } from "lucide-react";

interface CallButtonProps {
  phoneNumber: string; // Raw digits: "2483324120"
  phoneDisplay: string; // Formatted: "(248) 332-4120"
  className?: string;
  children?: React.ReactNode;
}

/**
 * Smart Call Button
 * - Mobile: Opens phone dialer via tel: link
 * - Desktop: Shows modal with copyable phone number
 */
export function CallButton({ 
  phoneNumber, 
  phoneDisplay, 
  className = "",
  children 
}: CallButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(true); // Default to mobile (safer for SSR)

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      // Check for touch capability and screen size
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobile(hasTouch && isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isMobile) {
      // Mobile: let the tel: link work naturally
      return;
    }
    // Desktop: prevent default and show modal
    e.preventDefault();
    setShowModal(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phoneDisplay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = phoneDisplay;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <a
        href={`tel:${phoneNumber}`}
        onClick={handleClick}
        className={className}
      >
        {children || (
          <>
            <Phone className="w-5 h-5" />
            Call Now
          </>
        )}
      </a>

      {/* Desktop Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                Give Us a Call
              </h3>
              
              <p className="text-neutral-600 mb-4">
                Our team is ready to help with your tire needs
              </p>

              {/* Phone number display */}
              <div className="bg-neutral-100 rounded-xl p-4 mb-4">
                <p className="text-2xl font-bold text-neutral-900 tracking-wide">
                  {phoneDisplay}
                </p>
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className={`w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                  copied 
                    ? "bg-green-600" 
                    : "bg-neutral-900 hover:bg-neutral-800"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Phone Number
                  </>
                )}
              </button>

              <p className="text-sm text-neutral-500 mt-4">
                Mon-Fri 8AM-5PM • Sat 8AM-3PM
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
