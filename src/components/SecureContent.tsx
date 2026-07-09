import React, { useEffect, useRef, useMemo } from "react";

interface Props {
  studentName: string;
  regNumber?: string;
  children: React.ReactNode;
  className?: string;
  /** Watermark text colour — "light" for dark backgrounds, "dark" for light backgrounds */
  mode?: "light" | "dark";
}

/**
 * Wraps assessment content with:
 *  - Text selection + copy/cut blocked
 *  - Right-click suppressed
 *  - Keyboard shortcuts blocked (Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+U, Ctrl+P, Ctrl+S, F12, PrintScreen)
 *  - Diagonal watermark with student identity (screenshot deterrent — traceable if shared)
 *
 * NOTE: OS-level screenshots cannot be fully prevented by any browser API.
 * The watermark ensures any shared screenshot reveals the student's identity.
 */
export default function SecureContent({ studentName, regNumber, children, className = "", mode = "dark" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const label = regNumber ? `${studentName}  ·  ${regNumber}` : studentName;

  // Generate a repeating diagonal watermark as an SVG data URL
  const watermarkUrl = useMemo(() => {
    const color = mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
    const escaped = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">
      <text
        x="50%" y="50%"
        font-size="13"
        font-family="system-ui,sans-serif"
        font-weight="700"
        fill="${color}"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-30 170 100)"
        letter-spacing="1"
      >${escaped}</text>
    </svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [label, mode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventEvent = (e: Event) => e.preventDefault();

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Ctrl / Cmd combinations
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (["c", "a", "x", "u", "p", "s", "v"].includes(key)) { e.preventDefault(); return; }
        if (e.shiftKey && ["i", "j", "c", "u"].includes(key)) { e.preventDefault(); return; }
      }
      // Standalone keys
      if (key === "f12" || key === "printscreen") { e.preventDefault(); return; }
    };

    container.addEventListener("contextmenu", preventEvent);
    container.addEventListener("copy", preventEvent);
    container.addEventListener("cut", preventEvent);
    // Capture phase so it fires before React handlers
    document.addEventListener("keydown", blockKeys, true);

    return () => {
      container.removeEventListener("contextmenu", preventEvent);
      container.removeEventListener("copy", preventEvent);
      container.removeEventListener("cut", preventEvent);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {children}

      {/* Watermark overlay — pointer-events:none so clicks pass through */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: watermarkUrl,
          backgroundRepeat: "repeat",
          zIndex: 50,
          borderRadius: "inherit",
        }}
      />
    </div>
  );
}
