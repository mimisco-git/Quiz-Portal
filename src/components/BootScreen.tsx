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
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: "#0a0e1a" }}
        >
          {/* Abstract layered gradient background */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 20% 30%, rgba(16,185,129,0.22) 0%, transparent 60%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 80% 70%, rgba(59,130,246,0.20) 0%, transparent 60%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 55% 15%, rgba(139,92,246,0.18) 0%, transparent 55%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 10% 85%, rgba(6,182,212,0.14) 0%, transparent 60%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 35% at 90% 10%, rgba(52,211,153,0.12) 0%, transparent 55%)" }} />
          {/* Diagonal light sweep */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(59,130,246,0.06) 100%)" }} />
          {/* Noise grain for depth */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "180px 180px", opacity: 0.055 }} />

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
