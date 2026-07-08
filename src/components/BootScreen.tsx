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
          style={{ backgroundColor: "#000" }}
        >
          {/* ── ultra-subtle noise for perceived depth ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "256px 256px",
              opacity: 0.028,
            }}
          />

          {/* ── very faint radial bloom behind logo ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 38% 32% at 50% 47%, rgba(255,255,255,0.045) 0%, transparent 100%)",
            }}
          />

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
