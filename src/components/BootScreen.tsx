import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  onDone: () => void;
}

export default function BootScreen({ onDone }: Props) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [barVisible, setBarVisible]   = useState(false);
  const [progress,   setProgress]     = useState(0);
  const [exiting,    setExiting]      = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  /* ── sequence ──────────────────────────────────────────── */
  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 350);
    const t2 = setTimeout(() => setBarVisible(true),  950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* ── eased progress fill (macOS feel: slow-fast-slow) ─── */
  useEffect(() => {
    if (!barVisible) return;

    const DURATION = 3200; // ms — total fill time

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / DURATION, 1);
      // ease-in-out cubic: slow → fast → slow
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      setProgress(Math.round(eased * 100));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // brief pause at 100 %, then fade the whole screen out
        setTimeout(() => {
          setExiting(true);
          setTimeout(onDone, 700);
        }, 480);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [barVisible, onDone]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.25, 0, 0.25, 1] }}
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: "#e8ddd5",
            backgroundImage: "url('/loader-wallpaper.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Dark overlay so logo and progress bar stay visible */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />

          {/* ── centred content cluster ── */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[52px] sm:gap-[72px]">

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: logoVisible ? 1 : 0 }}
              transition={{ duration: 1.1, ease: [0.25, 0, 0.25, 1] }}
              style={{
                filter:
                  "drop-shadow(0 0 48px rgba(255,255,255,0.13)) drop-shadow(0 0 12px rgba(255,255,255,0.08))",
              }}
            >
              <img
                src="/logo-dark.png"
                alt="QuizOS"
                draggable={false}
                className="h-[96px] sm:h-[200px] w-auto select-none"
              />
            </motion.div>

            {/* Progress bar — macOS proportions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: barVisible ? 1 : 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              {/* Track */}
              <div
                className="w-[220px] sm:w-[360px] h-[3px] sm:h-[4px] rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  boxShadow: "0 0 0 0.5px rgba(255,255,255,0.04)",
                }}
              >
                {/* Fill */}
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.86)",
                    boxShadow: "0 0 10px rgba(255,255,255,0.40)",
                    transition: "width 60ms linear",
                  }}
                />
              </div>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
