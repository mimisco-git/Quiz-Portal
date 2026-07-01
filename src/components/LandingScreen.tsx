import React, { useState, useEffect, useRef } from "react";
import {
  GraduationCap, BookOpen, ShieldAlert, ArrowRight,
  ClipboardCheck, ArrowLeft, KeyRound, HelpCircle,
  CheckCircle, Sun, Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingScreenProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLoginSuccess: (token: string, user: any) => void;
}

export default function LandingScreen({
  theme,
  onToggleTheme,
  onLoginSuccess,
}: LandingScreenProps) {

  /* ─── boot phase ─────────────────────────────────────── */
  const alreadyBooted = sessionStorage.getItem("quizos_booted");
  const [phase, setPhase]           = useState<"boot" | "login">(alreadyBooted ? "login" : "boot");
  const [logoVisible, setLogoVisible] = useState(false);
  const [barVisible, setBarVisible]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "boot") return;
    const t1 = setTimeout(() => setLogoVisible(true), 350);
    const t2 = setTimeout(() => setBarVisible(true),  950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  useEffect(() => {
    if (!barVisible) return;
    const DURATION = 3000;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / DURATION, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          sessionStorage.setItem("quizos_booted", "1");
          setPhase("login");
        }, 520);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [barVisible]);

  /* ─── login state ────────────────────────────────────── */
  const [selectedUser, setSelectedUser] = useState<"student" | "lecturer" | null>(null);
  const [mode, setMode]     = useState<"login" | "register" | "security-fix">("login");
  const [activeTab, setActiveTab] = useState<"student" | "lecturer">("student");

  const [studentRegNumber, setStudentRegNumber] = useState("");
  const [studentYear, setStudentYear]           = useState("Year 1");
  const [lecturerEmail, setLecturerEmail]       = useState("");
  const [lecturerPassword, setLecturerPassword] = useState("");

  const [regFullName, setRegFullName]         = useState("");
  const [regEmail, setRegEmail]               = useState("");
  const [regRegNumber, setRegRegNumber]       = useState("");
  const [regDepartment, setRegDepartment]     = useState("");
  const [regYear, setRegYear]                 = useState("Year 1");
  const [securityQuestion, setSecurityQuestion] = useState("What is your high school name?");
  const [securityAnswer, setSecurityAnswer]   = useState("");

  const [regLecturerName, setRegLecturerName]           = useState("");
  const [regLecturerEmail, setRegLecturerEmail]         = useState("");
  const [regLecturerPassword, setRegLecturerPassword]   = useState("");

  const [fixRegNumber, setFixRegNumber] = useState("");
  const [fixQuestion, setFixQuestion]   = useState("");
  const [fixAnswer, setFixAnswer]       = useState("");
  const [fixNewYear, setFixNewYear]     = useState("Year 1");
  const [fixStep, setFixStep]           = useState<"enter-reg" | "answer-question">("enter-reg");

  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/departments")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDepartmentsList(data.map((d: any) => d.name)); })
      .catch(() => {});
  }, []);

  /* ─── handlers ───────────────────────────────────────── */
  // Safe JSON parser — prevents raw "Unexpected token" errors reaching the UI
  const apiJSON = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error("Server error. Please try again."); }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/student-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regNumber: studentRegNumber, year: studentYear }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Failed to log in");
      setSuccess("Login successful! Redirecting…");
      setTimeout(() => onLoginSuccess(data.token, data.user), 500);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/student-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: regFullName, email: regEmail, regNumber: regRegNumber, department: regDepartment, year: regYear, securityQuestion, securityAnswer }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setSuccess("Account registered! Welcome aboard.");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLecturerLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/lecturer-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: lecturerEmail, password: lecturerPassword }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Lecturer verification failed");
      setSuccess("Authorization granted!");
      setTimeout(() => onLoginSuccess(data.token, data.user), 500);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLecturerRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/lecturer-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: regLecturerName, email: regLecturerEmail, password: regLecturerPassword }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Lecturer registration failed");
      setSuccess("Lecturer account created!");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGetSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/student-get-security-question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regNumber: fixRegNumber }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setFixQuestion(data.securityQuestion); setFixStep("answer-question");
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleFixYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/student-fix-year", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regNumber: fixRegNumber, securityAnswer: fixAnswer, newYear: fixNewYear }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Incorrect answer");
      setSuccess("Year updated! Logging in…");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleSelectUser = (type: "student" | "lecturer") => {
    setSelectedUser(type); setActiveTab(type);
    setMode("login"); setError(null); setSuccess(null);
  };

  const handleBack = () => {
    setSelectedUser(null); setMode("login");
    setError(null); setSuccess(null);
  };

  /* ─── helpers ────────────────────────────────────────── */
  const yearsOptions = ["Year 1","Year 2","Year 3","Year 4","Year 5","Extra Year","Postgraduate"];
  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const inp = [
    "w-full px-4 py-[11px] rounded-xl text-[14px] text-white placeholder-white/35 font-medium",
    "bg-white/[0.10] border border-white/[0.13] outline-none",
    "focus:bg-white/[0.15] focus:border-white/[0.30]",
    "transition-all duration-200 backdrop-blur-sm",
  ].join(" ");

  const lbl  = "block text-[11px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1.5";
  const link = "text-[13px] text-emerald-400 font-semibold hover:text-emerald-300 transition-colors cursor-pointer";

  const USERS = [
    {
      id:       "student" as const,
      label:    "Student",
      sub:      "Sign in to portal",
      icon:     BookOpen,
      gradient: "linear-gradient(145deg, #064e3b 0%, #0d9488 100%)",
      ring:     "rgba(16,185,129,0.50)",
      btn:      "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.32)]",
    },
    {
      id:       "lecturer" as const,
      label:    "Lecturer",
      sub:      "Staff / Academic",
      icon:     GraduationCap,
      gradient: "linear-gradient(145deg, #1e3a5f 0%, #2563eb 100%)",
      ring:     "rgba(96,165,250,0.50)",
      btn:      "bg-blue-600 hover:bg-blue-500 shadow-[0_0_24px_rgba(96,165,250,0.28)]",
    },
  ];
  const activeUser = USERS.find(u => u.id === selectedUser);

  /* ─── render ─────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 overflow-hidden font-sans antialiased">

      {/* ══ LAYER 0 — wallpaper with 10-layer Apple radial gradients ══ */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: alreadyBooted ? 1 : 0 }}
        animate={{ opacity: phase === "login" ? 1 : 0 }}
        transition={{ duration: 1.1, ease: [0.25, 0, 0.25, 1] }}
        style={{ background: "#050a07" }}
      >
        {/* 10 radial gradient colour pools — mixed, blurred, layered */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 12% 18%, rgba(4,120,87,0.28) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 55% 50% at 88% 82%, rgba(29,78,216,0.16) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 40% 35% at 50% 50%, rgba(4,120,87,0.11) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 40% at 75% 20%, rgba(16,185,129,0.08) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 25% 75%, rgba(6,95,70,0.18) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 35% 30% at 90% 10%, rgba(52,211,153,0.06) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 45% 40% at 5% 90%, rgba(4,120,87,0.10) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 30% 25% at 60% 85%, rgba(37,99,235,0.07) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(0,0,0,0.40) 0%, transparent 100%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 100% 50% at 50% 100%, rgba(0,0,0,0.50) 0%, transparent 80%)" }} />
        {/* Film grain noise — adds natural richness to the gradients */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "220px 220px",
          opacity: 0.058,
        }} />
        {/* Edge vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 130% 130% at 50% 48%, transparent 50%, rgba(0,0,0,0.60) 100%)" }} />
      </motion.div>

      {/* ══ LAYER 1 — boot screen ══ */}
      <AnimatePresence>
        {phase === "boot" && (
          <motion.div
            key="boot"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[52px]"
            style={{ backgroundColor: "#000" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.25, 0, 0.25, 1] }}
          >
            {/* boot grain */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.028]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "256px 256px",
            }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 38% 32% at 50% 47%, rgba(255,255,255,0.045) 0%, transparent 100%)" }} />

            {/* centered logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: logoVisible ? 1 : 0 }}
              transition={{ duration: 1.1, ease: [0.25, 0, 0.25, 1] }}
              style={{ filter: "drop-shadow(0 0 32px rgba(255,255,255,0.10)) drop-shadow(0 0 8px rgba(255,255,255,0.06))" }}
            >
              <img src="/logo-dark.png" alt="QuizOS" draggable={false} style={{ height: 88, width: "auto", userSelect: "none" }} />
            </motion.div>

            {/* progress bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: barVisible ? 1 : 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div style={{ width: 220, height: 3, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden", boxShadow: "0 0 0 0.5px rgba(255,255,255,0.04)" }}>
                <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "rgba(255,255,255,0.86)", boxShadow: "0 0 8px rgba(255,255,255,0.35)", transition: "width 60ms linear" }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ LAYER 2 — macOS login content ══ */}
      <AnimatePresence>
        {phase === "login" && (
          <motion.div
            key="login-ui"
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.25, 0, 0.25, 1] }}
          >
            {/* ── top bar: clock + theme ── */}
            <div className="absolute top-0 inset-x-0 flex items-start justify-between px-8 sm:px-12 pt-8 pointer-events-none z-30">
              {/* Clock */}
              <div className="pointer-events-auto select-none">
                <p className="text-white/90 font-light leading-none" style={{ fontSize: "clamp(26px,3.6vw,42px)", letterSpacing: "-0.02em" }}>
                  {timeStr}
                </p>
                <p className="text-white/40 text-[12.5px] font-medium mt-3">{dateStr}</p>
              </div>

              {/* Logo (small) + theme toggle */}
              <div className="flex items-center gap-2 pointer-events-auto mt-1">
                <img
                  src="/logo-dark.png"
                  alt="QuizOS"
                  className="h-10 w-auto select-none opacity-65"
                  style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.07))" }}
                />
                <button
                  onClick={onToggleTheme}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/12 backdrop-blur text-white/65 hover:bg-white/18 hover:text-white transition-all cursor-pointer"
                >
                  {theme === "dark" ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
                </button>
              </div>
            </div>

            {/* ── main content ── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <AnimatePresence mode="wait">

                {/* USER SELECTION */}
                {selectedUser === null && (
                  <motion.div
                    key="user-select"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-[84px]"
                  >
                    {/* Logo — anchor composition */}
                    <motion.div
                      className="flex flex-col items-center gap-4"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="relative flex items-center justify-center">
                        {/* Outermost ambient bloom — wide, very soft, breathes */}
                        <motion.div
                          className="absolute pointer-events-none"
                          animate={{ opacity: [0.7, 0.38, 0.7] }}
                          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                          style={{ width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(10,148,99,0.16) 0%, rgba(4,120,87,0.06) 50%, transparent 75%)", transform: "translateY(12px)", filter: "blur(28px)" }}
                        />
                        {/* Mid glow — softer, breathes slightly offset */}
                        <motion.div
                          className="absolute pointer-events-none"
                          animate={{ opacity: [0.8, 0.45, 0.8] }}
                          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                          style={{ width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(18,184,122,0.13) 0%, rgba(4,120,87,0.05) 55%, transparent 75%)", filter: "blur(14px)" }}
                        />
                        {/* Tight inner glow */}
                        <div className="absolute pointer-events-none" style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(52,211,153,0.09) 0%, transparent 70%)", filter: "blur(6px)" }} />
                        <img
                          src="/logo-dark.png"
                          alt="QuizOS"
                          draggable={false}
                          className="relative select-none rounded-[22px]"
                          style={{
                            height: 152,
                            width: "auto",
                            filter: "drop-shadow(0 2px 24px rgba(4,120,87,0.32)) drop-shadow(0 1px 5px rgba(0,0,0,0.60)) brightness(1.06) contrast(1.02)",
                          }}
                        />
                      </div>
                      <p className="text-white/35 text-[11px] font-mono tracking-[0.27em] uppercase select-none">
                        FUTO Academic Portal
                      </p>
                    </motion.div>

                    {/* User circles */}
                    <div className="flex items-start gap-10 sm:gap-16">
                      {USERS.map((u, idx) => {
                        const Icon = u.icon;
                        return (
                          <motion.button
                            key={u.id}
                            onClick={() => handleSelectUser(u.id)}
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.06, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.18 + idx * 0.07 }}
                            className="group flex flex-col items-center gap-4 cursor-pointer outline-none"
                          >
                            <div
                              className="relative h-[108px] w-[108px] rounded-full flex items-center justify-center"
                              style={{
                                background: u.gradient,
                                boxShadow: `0 2px 4px rgba(0,0,0,0.40), 0 8px 32px rgba(0,0,0,0.55), 0 24px 60px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`,
                                transition: "box-shadow 0.28s cubic-bezier(0.34,1.56,0.64,1)",
                              }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 4px rgba(0,0,0,0.40), 0 14px 48px rgba(0,0,0,0.62), 0 36px 80px rgba(0,0,0,0.32), 0 0 0 2px ${u.ring} inset, 0 0 0 1px rgba(255,255,255,0.16) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`;
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 4px rgba(0,0,0,0.40), 0 8px 32px rgba(0,0,0,0.55), 0 24px 60px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`;
                              }}
                            >
                              {/* Physical sphere layers */}
                              <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
                                {/* Main top highlight — diffuse */}
                                <div style={{ position: "absolute", top: "-8%", left: "8%", right: "8%", height: "52%", background: "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 55%, transparent 100%)", borderRadius: "50% 50% 58% 58% / 58% 58% 42% 42%", filter: "blur(1.5px)" }} />
                                {/* Tight rim light at top edge */}
                                <div style={{ position: "absolute", top: "3%", left: "20%", right: "20%", height: "6%", background: "rgba(255,255,255,0.22)", borderRadius: "50%", filter: "blur(2px)" }} />
                                {/* Subtle inner gradient — darker at sides */}
                                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.18) 100%)", borderRadius: "50%" }} />
                                {/* Bottom soft reflection */}
                                <div style={{ position: "absolute", bottom: "6%", left: "22%", right: "22%", height: "20%", background: "linear-gradient(0deg, rgba(255,255,255,0.09) 0%, transparent 100%)", borderRadius: "50%", filter: "blur(2px)" }} />
                              </div>
                              <Icon className="h-12 w-12 text-white relative z-10 drop-shadow-sm" strokeWidth={1.4} />
                            </div>
                            <div className="text-center">
                              <p className="text-white text-[15px] font-semibold leading-tight select-none">{u.label}</p>
                              <p className="text-white/30 text-[11px] mt-0.5 select-none">{u.sub}</p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                  </motion.div>
                )}

                {/* FORM VIEW */}
                {selectedUser !== null && (
                  <motion.div
                    key="form-view"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-7 w-full max-w-[360px]"
                  >
                    {/* Selected user avatar (hidden during security-fix) */}
                    {mode !== "security-fix" && activeUser && (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col items-center gap-3"
                      >
                        <div
                          className="h-[90px] w-[90px] rounded-full flex items-center justify-center relative overflow-hidden"
                          style={{
                            background: activeUser.gradient,
                            boxShadow: `0 4px 8px rgba(0,0,0,0.30), 0 12px 40px rgba(0,0,0,0.55), 0 0 0 2.5px ${activeUser.ring} inset, 0 0 0 1px rgba(255,255,255,0.12) inset`,
                          }}
                        >
                          <div style={{ position: "absolute", top: "-10%", left: "10%", right: "10%", height: "55%", background: "linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)", borderRadius: "50% 50% 60% 60% / 60% 60% 40% 40%", filter: "blur(1px)" }} />
                          {React.createElement(activeUser.icon, { className: "h-10 w-10 text-white relative z-10 drop-shadow-sm", strokeWidth: 1.4 })}
                        </div>
                        <div className="text-center">
                          <p className="text-white text-[18px] font-semibold leading-tight tracking-[-0.01em]">{activeUser.label}</p>
                          <p className="text-white/38 text-[12px] mt-0.5">{activeUser.sub}</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Glass form panel */}
                    <div
                      className="w-full rounded-[22px] overflow-hidden"
                      style={{
                        background: "rgba(10,18,13,0.74)",
                        backdropFilter: "blur(48px) saturate(180%)",
                        WebkitBackdropFilter: "blur(48px) saturate(180%)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.70), 0 1px 0 rgba(255,255,255,0.08) inset",
                      }}
                    >
                      <div className="px-7 py-7 space-y-5">

                        {/* Alerts */}
                        <AnimatePresence>
                          {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                              className="flex items-start gap-2.5 bg-red-500/15 border border-red-400/25 rounded-xl p-3 text-red-300">
                              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                              <p className="text-[12.5px] leading-relaxed">{error}</p>
                            </motion.div>
                          )}
                          {success && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                              className="flex items-start gap-2.5 bg-emerald-500/15 border border-emerald-400/25 rounded-xl p-3 text-emerald-300">
                              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              <p className="text-[12.5px] leading-relaxed">{success}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence mode="wait">

                          {/* SECURITY FIX */}
                          {mode === "security-fix" && (
                            <motion.div key="sec-fix" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                              <div className="flex items-center gap-2.5">
                                <button onClick={() => { setMode("login"); setError(null); setFixStep("enter-reg"); }}
                                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white/60 transition cursor-pointer">
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-white/70 text-[12px] font-semibold flex items-center gap-1.5">
                                  <KeyRound className="h-3.5 w-3.5 text-emerald-400" /> Year Recovery Portal
                                </span>
                              </div>
                              <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 text-[12px] text-amber-300/90 leading-relaxed">
                                Verify your identity to update your year of study in the registry.
                              </div>
                              {fixStep === "enter-reg" ? (
                                <form onSubmit={handleGetSecurityQuestion} className="space-y-4">
                                  <div><label className={lbl}>Registration Number</label>
                                    <input type="text" required value={fixRegNumber} onChange={e => setFixRegNumber(e.target.value.toUpperCase())} placeholder="FUTO/2026/10423" className={inp + " font-mono"} /></div>
                                  <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer">
                                    {loading ? "Verifying…" : "Retrieve Challenge"} <ArrowRight className="h-4 w-4" />
                                  </button>
                                </form>
                              ) : (
                                <form onSubmit={handleFixYearSubmit} className="space-y-4">
                                  <div className="flex items-start gap-2 bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
                                    <HelpCircle className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Security Question</p>
                                      <p className="text-[13px] text-white/80 font-medium">{fixQuestion}</p>
                                    </div>
                                  </div>
                                  <div><label className={lbl}>Your Answer</label>
                                    <input type="text" required value={fixAnswer} onChange={e => setFixAnswer(e.target.value)} placeholder="Your secret answer" className={inp} /></div>
                                  <div><label className={lbl}>Correct Year</label>
                                    <select value={fixNewYear} onChange={e => setFixNewYear(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                      {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select></div>
                                  <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer">
                                    {loading ? "Updating…" : "Verify & Update"} <ArrowRight className="h-4 w-4" />
                                  </button>
                                </form>
                              )}
                            </motion.div>
                          )}

                          {/* STUDENT LOGIN */}
                          {selectedUser === "student" && mode === "login" && (
                            <motion.form key="s-login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} onSubmit={handleStudentLogin} className="space-y-4">
                              <div><label className={lbl}>Registration Number</label>
                                <input id="login-student-reg" type="text" required value={studentRegNumber} onChange={e => setStudentRegNumber(e.target.value.toUpperCase())} placeholder="FUTO/2026/10423" className={inp + " font-mono"} autoFocus /></div>
                              <div><label className={lbl}>Year of Study</label>
                                <select id="login-student-year" value={studentYear} onChange={e => setStudentYear(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                  {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select></div>
                              <button id="student-submit-btn" type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer mt-1 ${USERS[0].btn}`}>
                                {loading ? "Signing in…" : "Sign In"} {!loading && <ArrowRight className="h-4 w-4" />}
                              </button>
                              <div className="flex items-center justify-between pt-0.5">
                                <button type="button" onClick={() => { setMode("register"); setError(null); }} className={link}>New student?</button>
                                <button type="button" onClick={() => { setMode("security-fix"); setError(null); setFixRegNumber(studentRegNumber); }} className="flex items-center gap-1 text-[12px] text-white/35 hover:text-white/60 transition cursor-pointer">
                                  <KeyRound className="h-3 w-3" /> Fix year
                                </button>
                              </div>
                            </motion.form>
                          )}

                          {/* STUDENT REGISTER */}
                          {selectedUser === "student" && mode === "register" && (
                            <motion.form key="s-reg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} onSubmit={handleStudentRegister} className="space-y-3.5">
                              <p className="text-[10.5px] font-bold text-emerald-400/80 uppercase tracking-[0.16em] flex items-center gap-1.5"><ClipboardCheck className="h-3 w-3" /> New Student Registration</p>
                              <div><label className={lbl}>Full Name</label>
                                <input type="text" required value={regFullName} onChange={e => setRegFullName(e.target.value)} placeholder="John Chijioke Okafor" className={inp} autoFocus /></div>
                              <div><label className={lbl}>Email</label>
                                <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@futo.edu.ng" className={inp} /></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Reg. Number</label>
                                  <input type="text" required value={regRegNumber} onChange={e => setRegRegNumber(e.target.value)} placeholder="FUTO/2026/…" className={inp + " font-mono uppercase"} /></div>
                                <div><label className={lbl}>Year</label>
                                  <select value={regYear} onChange={e => setRegYear(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                    {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select></div>
                              </div>
                              <div><label className={lbl}>Department</label>
                                <input type="text" required list="depts-list" value={regDepartment} onChange={e => setRegDepartment(e.target.value)} placeholder="Computer Science" className={inp} />
                                <datalist id="depts-list">{departmentsList.map(d => <option key={d} value={d} />)}</datalist></div>
                              <div className="pt-1 border-t border-white/[0.07]">
                                <p className="text-[9.5px] text-white/28 uppercase tracking-widest font-bold mb-3">Year Recovery Setup</p>
                                <div className="space-y-3">
                                  <div><label className={lbl}>Security Question</label>
                                    <select value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                      <option>What is your high school name?</option>
                                      <option>What was your childhood nickname?</option>
                                      <option>What is your favorite academic course?</option>
                                      <option>What is your mother's maiden name?</option>
                                    </select></div>
                                  <div><label className={lbl}>Your Answer</label>
                                    <input type="text" required value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} placeholder="Your secret answer" className={inp} /></div>
                                </div>
                              </div>
                              <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer ${USERS[0].btn}`}>
                                {loading ? "Creating…" : "Complete Registration"} {!loading && <ArrowRight className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setMode("login"); setError(null); }} className={link + " block text-center w-full"}>Already registered? Sign in</button>
                            </motion.form>
                          )}

                          {/* LECTURER LOGIN */}
                          {selectedUser === "lecturer" && mode === "login" && (
                            <motion.form key="l-login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} onSubmit={handleLecturerLogin} className="space-y-4">
                              <div><label className={lbl}>Email Address</label>
                                <input id="login-lecturer-email" type="email" required value={lecturerEmail} onChange={e => setLecturerEmail(e.target.value)} placeholder="xavier@futo.edu.ng" className={inp} autoFocus /></div>
                              <div><label className={lbl}>Password</label>
                                <input id="login-lecturer-pwd" type="password" required value={lecturerPassword} onChange={e => setLecturerPassword(e.target.value)} placeholder="••••••••••" className={inp} /></div>
                              <button id="lecturer-submit-btn" type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer mt-1 ${USERS[1].btn}`}>
                                {loading ? "Signing in…" : "Sign In"} {!loading && <ArrowRight className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setMode("register"); setError(null); }} className={link}>New staff? Register</button>
                            </motion.form>
                          )}

                          {/* LECTURER REGISTER */}
                          {selectedUser === "lecturer" && mode === "register" && (
                            <motion.form key="l-reg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} onSubmit={handleLecturerRegister} className="space-y-4">
                              <p className="text-[10.5px] font-bold text-blue-400/80 uppercase tracking-[0.16em] flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> Staff Registration</p>
                              <div><label className={lbl}>Full Name</label>
                                <input type="text" required value={regLecturerName} onChange={e => setRegLecturerName(e.target.value)} placeholder="Professor Charles Xavier" className={inp} autoFocus /></div>
                              <div><label className={lbl}>Staff Email</label>
                                <input type="email" required value={regLecturerEmail} onChange={e => setRegLecturerEmail(e.target.value)} placeholder="staff@futo.edu.ng" className={inp} /></div>
                              <div><label className={lbl}>Password</label>
                                <input type="password" required value={regLecturerPassword} onChange={e => setRegLecturerPassword(e.target.value)} placeholder="Create a strong password" className={inp} /></div>
                              <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer ${USERS[1].btn}`}>
                                {loading ? "Creating…" : "Register Staff Account"} {!loading && <ArrowRight className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setMode("login"); setError(null); }} className={link + " block text-center w-full"}>Already staff? Sign in</button>
                            </motion.form>
                          )}

                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Back to user selection */}
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-[13px] font-medium transition cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Other Users
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── bottom tagline ── */}
            <div className="absolute bottom-5 inset-x-0 text-center pointer-events-none select-none">
              <p className="text-white/14 text-[9.5px] font-mono tracking-[0.28em] uppercase">
                © 2026 · FUTO Academic Portal
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
