import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  content: string;
  slideNumber: number;
  totalSlides: number;
  topic: string;
  courseCode?: string;
  /** When provided, caller handles navigation (lecturer pushes to all students) */
  onPrev?: () => void;
  onNext?: () => void;
  canNavigate?: boolean;
}

function parseSlide(raw: string) {
  const lines = raw.split("\n").map((l) => l.trimEnd()).filter((l) => l !== "");
  let title = "";
  let subtitle = "";
  const bullets: string[] = [];
  const body: string[] = [];

  for (const line of lines) {
    if (!title && line.startsWith("# ")) {
      title = line.replace(/^# /, "").trim();
    } else if (!subtitle && line.startsWith("## ")) {
      subtitle = line.replace(/^## /, "").trim();
    } else if (line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
      bullets.push(line.replace(/^([-•*]|\d+\.)\s+/, "").trim());
    } else if (line.startsWith("### ")) {
      body.push(line.replace(/^### /, "").trim());
    } else {
      body.push(line.trim());
    }
  }

  if (!title && lines.length > 0) {
    title = lines[0];
    const idx = body.indexOf(title);
    if (idx !== -1) body.splice(idx, 1);
  }

  return { title, subtitle, bullets, body };
}

// The actual slide canvas — used in both inline and fullscreen modes
function SlideCanvas({
  content, slideNumber, totalSlides, topic, courseCode, fullscreen = false,
}: {
  content: string; slideNumber: number; totalSlides: number;
  topic: string; courseCode?: string; fullscreen?: boolean;
}) {
  const { title, subtitle, bullets, body } = parseSlide(content);
  const isTitleSlide = bullets.length === 0 && body.length === 0;
  const dots = Math.min(totalSlides, 24);

  const fs = fullscreen;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideNumber}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.01 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full h-full flex flex-col"
        style={{
          background: "linear-gradient(145deg, #0a0f1a 0%, #0d1b2e 40%, #091422 70%, #0e1f35 100%)",
          fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        }}
      >
        {/* Decorative grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-70" />

        {/* Header bar */}
        <div className={`flex-shrink-0 flex items-center justify-between ${fs ? "px-10 pt-7 pb-2" : "px-5 pt-4 pb-1.5"}`}>
          <span className={`font-mono font-bold text-slate-500 uppercase tracking-[0.14em] truncate mr-3 ${fs ? "text-[13px]" : "text-[9px]"}`}>
            {courseCode && <span className="text-emerald-500">{courseCode}</span>}
            {courseCode && " · "}
            {topic}
          </span>
          <span className={`font-mono text-slate-600 tabular-nums flex-shrink-0 ${fs ? "text-[13px]" : "text-[9px]"}`}>
            {slideNumber} / {totalSlides}
          </span>
        </div>

        {/* Content area */}
        <div
          className={`flex-1 flex flex-col min-h-0 overflow-hidden ${fs ? "px-16 pb-4" : "px-5 pb-2"} ${
            isTitleSlide ? "items-center justify-center text-center" : "justify-center"
          }`}
        >
          {title && (
            <h1
              className={`font-black leading-[1.12] text-white tracking-tight break-words ${
                isTitleSlide
                  ? fs ? "text-[56px] max-w-[88%] mb-3" : "text-[18px] mb-2"
                  : fs ? "text-[40px] mb-4" : "text-[14px] mb-1.5"
              }`}
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            >
              {title}
            </h1>
          )}

          {subtitle && (
            <p
              className={`font-semibold text-emerald-400 leading-snug break-words ${
                isTitleSlide
                  ? fs ? "text-[24px] max-w-[78%]" : "text-[12px]"
                  : fs ? "text-[20px] mb-4" : "text-[10.5px] mb-1.5"
              }`}
            >
              {subtitle}
            </p>
          )}

          {/* Divider under title for content slides */}
          {title && !isTitleSlide && (
            <div className={`bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full flex-shrink-0 ${fs ? "w-20 h-[3px] mb-7" : "w-8 h-[2px] mb-2"}`} />
          )}

          {bullets.length > 0 && (
            <ul className={`${fs ? "space-y-4 mt-1" : "space-y-[4px] mt-0.5"}`}>
              {bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="flex items-start gap-3 min-w-0"
                >
                  <span
                    className={`flex-shrink-0 rounded-full bg-emerald-500 ${fs ? "mt-[10px] w-2.5 h-2.5" : "mt-[5px] w-1.5 h-1.5"}`}
                  />
                  <span
                    className={`text-slate-200 leading-snug break-words min-w-0 flex-1 ${
                      fs ? "text-[20px]" : "text-[11px]"
                    }`}
                  >
                    {b}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}

          {body.length > 0 && (
            <div className={`${fs ? "mt-5 space-y-3" : "mt-1.5 space-y-[3px]"}`}>
              {body.map((line, i) => (
                <p
                  key={i}
                  className={`text-slate-300 leading-relaxed break-words ${fs ? "text-[17px]" : "text-[10px]"}`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer: progress dots */}
        <div className={`flex-shrink-0 flex items-center justify-between ${fs ? "px-10 pb-7 pt-3" : "px-5 pb-3 pt-1.5"} border-t border-white/[0.06]`}>
          <div className="flex gap-1 flex-wrap max-w-[75%]">
            {Array.from({ length: dots }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === slideNumber - 1
                    ? "bg-emerald-400"
                    : "bg-white/15"
                } ${fs ? (i === slideNumber - 1 ? "w-8 h-1" : "w-2.5 h-1") : (i === slideNumber - 1 ? "w-4 h-[2px]" : "w-[5px] h-[2px]")}`}
              />
            ))}
          </div>
          <span className={`font-mono text-slate-700 uppercase tracking-widest ${fs ? "text-[10px]" : "text-[7px]"}`}>Quiz Portal</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function SlideView({ content, slideNumber, totalSlides, topic, courseCode, onPrev, onNext, canNavigate = false }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const enterFullscreen = useCallback(async () => {
    if (containerRef.current?.requestFullscreen) {
      await containerRef.current.requestFullscreen().catch(() => {});
    }
    setFullscreen(true);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setFullscreen(false);
  }, []);

  // Sync state with browser fullscreen events (e.g. Esc key)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard navigation in fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); onNext?.(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); onPrev?.(); }
      if (e.key === "Escape") { exitFullscreen(); }
      if (e.key === "f" || e.key === "F") { exitFullscreen(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, onNext, onPrev, exitFullscreen]);

  return (
    <>
      {/* Inline slide — 16:9 box that always fits its container */}
      <div className="w-full max-w-full rounded-2xl overflow-hidden relative group" style={{ aspectRatio: "16/9" }}>
        <div ref={containerRef} className="absolute inset-0">
          <SlideCanvas
            content={content}
            slideNumber={slideNumber}
            totalSlides={totalSlides}
            topic={topic}
            courseCode={courseCode}
            fullscreen={false}
          />
        </div>

        {/* Fullscreen button */}
        <button
          onClick={enterFullscreen}
          title="Fullscreen presentation (F or button)"
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-7 h-7 rounded-lg bg-black/50 hover:bg-black/80 text-white cursor-pointer"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Fullscreen portal — renders on top of everything when active */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex flex-col bg-black"
          >
            {/* Slide fills the full screen in 16:9 letterboxed */}
            <div className="flex-1 flex items-center justify-center p-0">
              <div
                className="relative w-full h-full"
                style={{ maxWidth: "min(100vw, 177.78vh)", maxHeight: "min(100vh, 56.25vw)", margin: "auto" }}
              >
                <SlideCanvas
                  content={content}
                  slideNumber={slideNumber}
                  totalSlides={totalSlides}
                  topic={topic}
                  courseCode={courseCode}
                  fullscreen
                />

                {/* Nav arrows — overlaid, visible on hover */}
                {canNavigate && (
                  <>
                    <button
                      onClick={onPrev}
                      disabled={slideNumber <= 1}
                      className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white disabled:opacity-20 transition cursor-pointer"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={onNext}
                      disabled={slideNumber >= totalSlides}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 text-white disabled:opacity-20 transition cursor-pointer"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Exit fullscreen button */}
                <button
                  onClick={exitFullscreen}
                  className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white transition cursor-pointer"
                  title="Exit fullscreen (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bottom HUD */}
            <div className="flex-shrink-0 flex items-center justify-center gap-6 py-3 bg-black/60 text-slate-500 text-[11px] font-mono">
              <span>← → navigate</span>
              <span className="text-slate-400 font-semibold">{slideNumber} / {totalSlides}</span>
              <span>Esc to exit</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
