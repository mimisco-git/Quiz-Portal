import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Database, Brain, Radio, Wifi, Lock, ArrowRight, BookOpen } from "lucide-react";

const BOOT_SEQUENCE = [
  { tag: "BIOS",  icon: Shield,   text: "FUTO SecureBoot v2.1 — hardware integrity check passed" },
  { tag: "INIT",  icon: Database, text: "Turso cloud database cluster connected" },
  { tag: "AUTH",  icon: Lock,     text: "JWT authentication subsystem online" },
  { tag: "KERN",  icon: Brain,    text: "NVIDIA AI grading engine loaded" },
  { tag: "NET",   icon: Wifi,     text: "Live lecture broadcast system active" },
  { tag: "ACAD",  icon: BookOpen, text: "Academic modules: courses, quizzes, exams ready" },
  { tag: "STRM",  icon: Radio,    text: "Jitsi audio/video relay established" },
  { tag: "SYS",   icon: Shield,   text: "All systems operational — QuizOS ready" },
];

interface Props {
  onDone: () => void;
}

export default function BootScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<"bios" | "boot" | "ready">("bios");
  const [visibleLines, setVisibleLines] = useState(0);
  const [cursor, setCursor] = useState(true);
  const [progress, setProgress] = useState(0);

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(t);
  }, []);

  // Phase: BIOS flash → boot sequence
  useEffect(() => {
    const t = setTimeout(() => setPhase("boot"), 1100);
    return () => clearTimeout(t);
  }, []);

  // Boot sequence: reveal lines one by one
  useEffect(() => {
    if (phase !== "boot") return;
    if (visibleLines >= BOOT_SEQUENCE.length) {
      const t = setTimeout(() => setPhase("ready"), 600);
      return () => clearTimeout(t);
    }
    const delay = visibleLines === 0 ? 80 : 360;
    const t = setTimeout(() => {
      setVisibleLines(v => v + 1);
      setProgress(Math.round(((visibleLines + 1) / BOOT_SEQUENCE.length) * 100));
    }, delay);
    return () => clearTimeout(t);
  }, [phase, visibleLines]);

  return (
    <div className="fixed inset-0 z-50 bg-[#020d06] flex flex-col items-center justify-center overflow-hidden select-none">

      {/* Noise grain */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
      }} />

      {/* Ambient core glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 55% 55% at 50% 48%, rgba(4,120,87,0.16) 0%, transparent 72%)",
      }} />

      {/* Scan lines overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)",
      }} />

      <div className="relative z-10 w-full max-w-[560px] px-6 sm:px-10 space-y-10">

        {/* ── BIOS phase ── */}
        <AnimatePresence>
          {phase === "bios" && (
            <motion.div
              key="bios"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-[11px] text-emerald-600/60 space-y-1 absolute top-8 left-6 sm:left-10"
            >
              <p>QuizOS UEFI SecureBoot v2.1</p>
              <p>Copyright (C) 2026 FUTO Academic Systems. All rights reserved.</p>
              <p className="mt-2">CPU: FUTO-Cortex-X3 @ 4.2GHz  RAM: 16384 MB</p>
              <p>Checking NVME0n1... <span className="text-emerald-500">OK</span></p>
              <p>Verifying boot signature... <span className="text-emerald-500">PASS</span></p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Logo ── */}
        <AnimatePresence>
          {phase !== "bios" && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                {/* Glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ boxShadow: "0 0 48px 12px rgba(4,120,87,0.35)", borderRadius: 16 }}
                />
                <img
                  src="/logo-dark.png"
                  alt="QuizOS"
                  className="h-20 w-auto relative z-10 rounded-xl"
                />
              </div>
              <div className="text-center">
                <p className="text-[9px] font-mono font-bold tracking-[0.38em] text-emerald-600/70 uppercase">
                  Federal University of Technology Owerri
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Boot log ── */}
        {phase !== "bios" && (
          <div className="space-y-2 min-h-[200px]">
            {BOOT_SEQUENCE.slice(0, visibleLines).map((line, i) => {
              const Icon = line.icon;
              const isLast = i === visibleLines - 1;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 font-mono"
                >
                  <span className="text-emerald-400 text-[10px] font-bold w-[38px] shrink-0">
                    [ {line.tag} ]
                  </span>
                  <Icon className="h-3 w-3 text-emerald-600/80 shrink-0" />
                  <span className="text-[11.5px] text-slate-400 leading-tight">
                    {line.text}
                    {isLast && phase !== "ready" && (
                      <span className={`ml-0.5 text-emerald-400 transition-opacity ${cursor ? "opacity-100" : "opacity-0"}`}>▌</span>
                    )}
                  </span>
                  {phase === "ready" || i < visibleLines - 1 ? (
                    <span className="ml-auto text-emerald-500 text-[10px] font-bold shrink-0">OK</span>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Progress bar ── */}
        {phase !== "bios" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[9.5px] text-slate-600 tracking-widest uppercase">QuizOS v1.0.0-academic</span>
              <span className="font-mono text-[9.5px] text-emerald-600 font-bold">{progress}%</span>
            </div>
            <div className="h-[3px] bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{ background: "linear-gradient(90deg, #065f46, #10b981)" }}
              />
            </div>
          </div>
        )}

        {/* ── Ready state ── */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-mono text-[11px] text-emerald-400/80 tracking-[0.2em] uppercase">
                System ready{cursor ? "_" : " "}
              </p>
              <button
                onClick={onDone}
                className="group flex items-center gap-2.5 px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold rounded-2xl transition-all duration-200 shadow-[0_0_24px_rgba(4,120,87,0.40)] hover:shadow-[0_0_36px_rgba(16,185,129,0.50)]"
              >
                Enter Portal
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <p className="font-mono text-[9.5px] text-slate-700 tracking-widest">
                PRESS ENTER OR CLICK TO CONTINUE
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
