import React, { useState, useEffect, useRef } from "react";
import {
  GraduationCap, BookOpen, ShieldAlert, ArrowRight,
  ClipboardCheck, ArrowLeft, KeyRound, HelpCircle,
  CheckCircle, Sun, Moon, Eye, Shuffle, WifiOff, Shield, Timer, HardDrive,
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

  const handleDemoLogin = async (role: "student" | "lecturer") => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/demo-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const data = await apiJSON(res);
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      setSuccess("Demo access granted! Loading…");
      setTimeout(() => onLoginSuccess(data.token, data.user), 500);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
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

      {/* ══ LAYER 0 — wallpaper image ══ */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: alreadyBooted ? 1 : 0 }}
        animate={{ opacity: phase === "login" ? 1 : 0 }}
        transition={{ duration: 1.1, ease: [0.25, 0, 0.25, 1] }}
      >
        <img src="/login-wallpaper.png" alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        {/* Dark overlay so white UI elements stay readable */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.38)" }} />
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
            {/* ── top bar: clock ── */}
            <div className="absolute top-0 inset-x-0 flex items-start justify-between px-8 sm:px-12 pt-8 pointer-events-none z-30">
              <motion.div
                className="pointer-events-auto select-none"
                initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.2, type: "spring", stiffness: 380, damping: 28 }}
              >
                <motion.p
                  className="text-white/90 font-light leading-none"
                  style={{ fontSize: "clamp(26px,3.6vw,42px)", letterSpacing: "-0.02em" }}
                  key={timeStr}
                  animate={{ opacity: [0.7, 1] }}
                  transition={{ duration: 0.3 }}
                >{timeStr}</motion.p>
                <p className="text-white/40 text-[12.5px] font-medium mt-3">{dateStr}</p>
              </motion.div>
              <div />
            </div>

            {/* ── main content ── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 gap-[52px]">

              {/* Logo — floats gently at rest, shrinks when form opens */}
              <motion.div
                className="flex flex-col items-center gap-4 pointer-events-none select-none"
                animate={{
                  scale:   selectedUser !== null ? 0.70 : 1,
                  opacity: selectedUser !== null ? 0.45 : 1,
                  y:       selectedUser !== null ? -10 : [0, -8, 0],
                  filter:  selectedUser !== null ? "blur(2px)" : "blur(0px)",
                }}
                transition={selectedUser !== null ? {
                  duration: 0.55, ease: [0.16, 1, 0.3, 1],
                } : {
                  y:      { duration: 4.4, repeat: Infinity, ease: "easeInOut" },
                  scale:  { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
                  opacity:{ duration: 0.55, ease: [0.16, 1, 0.3, 1] },
                  filter: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
                }}
              >
                <div className="relative flex items-center justify-center">
                  <motion.div className="absolute pointer-events-none"
                    animate={{ opacity: [0.7, 0.32, 0.7], scale: [1, 1.08, 1] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(10,148,99,0.16) 0%, rgba(4,120,87,0.06) 50%, transparent 75%)", transform: "translateY(12px)", filter: "blur(28px)" }} />
                  <motion.div className="absolute pointer-events-none"
                    animate={{ opacity: [0.8, 0.40, 0.8], scale: [1, 1.12, 1] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                    style={{ width: 290, height: 290, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(18,184,122,0.13) 0%, rgba(4,120,87,0.05) 55%, transparent 75%)", filter: "blur(14px)" }} />
                  <div className="absolute pointer-events-none" style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(52,211,153,0.09) 0%, transparent 70%)", filter: "blur(6px)" }} />
                  <motion.img src="/logo-dark.png" alt="QuizOS" draggable={false} className="relative rounded-[22px]"
                    whileHover={{ scale: 1.04 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{ height: 152, width: "auto", filter: "drop-shadow(0 2px 24px rgba(4,120,87,0.32)) drop-shadow(0 1px 5px rgba(0,0,0,0.60)) brightness(1.06) contrast(1.02)" }} />
                </div>
                <motion.p
                  className="text-white/35 text-[11px] font-mono tracking-[0.27em] uppercase"
                  animate={{ opacity: selectedUser !== null ? 0 : [0.35, 0.55, 0.35] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >FUTO Academic Portal</motion.p>
              </motion.div>

              {/* Interactive zone — circles or inline form */}
              <AnimatePresence mode="wait">

                {/* USER SELECTION — two circles */}
                {selectedUser === null && (
                  <motion.div
                    key="user-select"
                    initial={{ opacity: 0, y: 20, filter: "blur(12px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.88, y: -14, filter: "blur(14px)" }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-8"
                  >
                    {/* User circles */}
                    <div className="flex items-start gap-10 sm:gap-16">
                    {USERS.map((u, idx) => {
                      const Icon = u.icon;
                      return (
                        <motion.button
                          key={u.id}
                          onClick={() => handleSelectUser(u.id)}
                          initial={{ opacity: 0, y: 22, scale: 0.88 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          whileHover={{ scale: 1.09, y: -5 }}
                          whileTap={{ scale: 0.93 }}
                          transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.06 + idx * 0.09 }}
                          className="flex flex-col items-center gap-4 cursor-pointer outline-none"
                        >
                          <div className="relative h-[108px] w-[108px] rounded-full flex items-center justify-center"
                            style={{ background: u.gradient, boxShadow: `0 2px 4px rgba(0,0,0,0.40), 0 8px 32px rgba(0,0,0,0.55), 0 24px 60px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`, transition: "box-shadow 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 4px rgba(0,0,0,0.40), 0 18px 52px rgba(0,0,0,0.65), 0 40px 80px rgba(0,0,0,0.32), 0 0 0 2.5px ${u.ring} inset, 0 0 0 1px rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 4px rgba(0,0,0,0.40), 0 8px 32px rgba(0,0,0,0.55), 0 24px 60px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,255,255,0.14) inset, 0 -1px 0 rgba(0,0,0,0.30) inset`; }}
                          >
                            <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
                              <div style={{ position: "absolute", top: "-8%", left: "8%", right: "8%", height: "52%", background: "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 55%, transparent 100%)", borderRadius: "50% 50% 58% 58% / 58% 58% 42% 42%", filter: "blur(1.5px)" }} />
                              <div style={{ position: "absolute", top: "3%", left: "20%", right: "20%", height: "6%", background: "rgba(255,255,255,0.22)", borderRadius: "50%", filter: "blur(2px)" }} />
                              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.18) 100%)", borderRadius: "50%" }} />
                              <div style={{ position: "absolute", bottom: "6%", left: "22%", right: "22%", height: "20%", background: "linear-gradient(0deg, rgba(255,255,255,0.09) 0%, transparent 100%)", borderRadius: "50%", filter: "blur(2px)" }} />
                            </div>
                            <Icon className="h-12 w-12 text-white relative z-10 drop-shadow-sm" strokeWidth={1.4} />
                          </div>
                          <motion.div className="text-center"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.14 + idx * 0.09, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <p className="text-white text-[15px] font-semibold leading-tight select-none">{u.label}</p>
                            <p className="text-white/30 text-[11px] mt-0.5 select-none">{u.sub}</p>
                          </motion.div>
                        </motion.button>
                      );
                    })}
                    </div>

                    {/* Demo Access */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.32, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col items-center gap-2.5"
                    >
                      <p className="text-white/22 text-[10.5px] font-mono uppercase tracking-[0.20em] select-none">— or explore a demo —</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleDemoLogin("student")}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-emerald-300 border border-emerald-800/50 bg-emerald-950/30 hover:bg-emerald-950/60 hover:border-emerald-600/60 transition-all disabled:opacity-40 cursor-pointer backdrop-blur-sm"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Demo Student
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleDemoLogin("lecturer")}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-blue-300 border border-blue-800/50 bg-blue-950/30 hover:bg-blue-950/60 hover:border-blue-600/60 transition-all disabled:opacity-40 cursor-pointer backdrop-blur-sm"
                        >
                          <GraduationCap className="h-3.5 w-3.5" />
                          Demo Lecturer
                        </button>
                      </div>
                      {error && (
                        <p className="text-red-400 text-[11px] text-center mt-1">{error}</p>
                      )}
                    </motion.div>

                    {/* Security feature badges */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.44, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-wrap justify-center gap-2 max-w-xs sm:max-w-md"
                    >
                      {[
                        { icon: Shield,    label: "Tab-Switch Detection" },
                        { icon: Eye,       label: "Fullscreen Enforced" },
                        { icon: Timer,     label: "Time-Boxed Sessions" },
                        { icon: HardDrive, label: "Answers Auto-Saved" },
                        { icon: Shuffle,   label: "Questions Randomised" },
                        { icon: WifiOff,   label: "Auto-Submit on Drop" },
                      ].map(({ icon: Icon, label }) => (
                        <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white/35 border border-white/[0.09] bg-white/[0.04] select-none">
                          <Icon className="h-3 w-3 flex-shrink-0" strokeWidth={1.8} />
                          {label}
                        </span>
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {/* INLINE FORM — springs in where the circles were */}
                {selectedUser !== null && (
                  <motion.div
                    key="form-view"
                    initial={{ opacity: 0, y: 28, scale: 0.93, filter: "blur(16px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: 14, scale: 0.95, filter: "blur(10px)" }}
                    transition={{ type: "spring", stiffness: 480, damping: 32 }}
                    className="w-full max-w-[340px]"
                  >
                    {/* Glass panel */}
                    <div className="rounded-[22px] overflow-hidden" style={{ background: "rgba(8,13,10,0.78)", backdropFilter: "blur(56px) saturate(200%)", WebkitBackdropFilter: "blur(56px) saturate(200%)", border: "1px solid rgba(255,255,255,0.11)", boxShadow: "0 32px 72px rgba(0,0,0,0.75), 0 1px 0 rgba(255,255,255,0.10) inset, 0 -1px 0 rgba(0,0,0,0.20) inset" }}>

                      {/* Panel header — pulsing dot + back */}
                      <motion.div
                        className="flex items-center justify-between px-6 pt-5 pb-0"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                            style={{ background: activeUser?.id === "student" ? "#10b981" : "#3b82f6", boxShadow: activeUser?.id === "student" ? "0 0 8px rgba(16,185,129,0.8)" : "0 0 8px rgba(59,130,246,0.8)" }}
                          />
                          <span className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em]">{activeUser?.label} Sign In</span>
                        </div>
                        <motion.button
                          onClick={handleBack}
                          whileHover={{ x: -3 }}
                          whileTap={{ scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="flex items-center gap-1 text-white/30 hover:text-white/65 text-[12px] transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="h-3 w-3" /> Back
                        </motion.button>
                      </motion.div>

                      <div className="px-6 py-5 space-y-4">
                        {/* Alerts */}
                        <AnimatePresence>
                          {error && (
                            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="flex items-start gap-2.5 bg-red-500/15 border border-red-400/25 rounded-xl p-3 text-red-300">
                              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                              <p className="text-[12.5px] leading-relaxed">{error}</p>
                            </motion.div>
                          )}
                          {success && (
                            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
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
                            <motion.form key="s-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} onSubmit={handleStudentLogin} className="space-y-4">
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.05, type: "spring", stiffness: 500, damping: 32 }}>
                                <label className={lbl}>Registration Number</label>
                                <input id="login-student-reg" type="text" required value={studentRegNumber} onChange={e => setStudentRegNumber(e.target.value.toUpperCase())} placeholder="FUTO/2026/10423" className={inp + " font-mono"} autoFocus />
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.10, type: "spring", stiffness: 500, damping: 32 }}>
                                <label className={lbl}>Year of Study</label>
                                <select id="login-student-year" value={studentYear} onChange={e => setStudentYear(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                  {yearsOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.16, type: "spring", stiffness: 500, damping: 32 }}>
                                <motion.button id="student-submit-btn" type="submit" disabled={loading} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer ${USERS[0].btn}`}>
                                  {loading ? "Signing in…" : "Sign In"} {!loading && <ArrowRight className="h-4 w-4" />}
                                </motion.button>
                              </motion.div>
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22, duration: 0.3 }} className="flex items-center justify-between pt-0.5">
                                <button type="button" onClick={() => { setMode("register"); setError(null); }} className={link}>New student?</button>
                                <button type="button" onClick={() => { setMode("security-fix"); setError(null); setFixRegNumber(studentRegNumber); }} className="flex items-center gap-1 text-[12px] text-white/35 hover:text-white/60 transition cursor-pointer">
                                  <KeyRound className="h-3 w-3" /> Fix year
                                </button>
                              </motion.div>
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
                                {departmentsList.length > 0 ? (
                                  <select required value={regDepartment} onChange={e => setRegDepartment(e.target.value)} className={inp + " [&>option]:bg-slate-900"}>
                                    <option value="">Select your department…</option>
                                    {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                ) : (
                                  <input type="text" required value={regDepartment} onChange={e => setRegDepartment(e.target.value)} placeholder="e.g. Computer Science" className={inp} />
                                )}
                              </div>
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
                            <motion.form key="l-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} onSubmit={handleLecturerLogin} className="space-y-4">
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.05, type: "spring", stiffness: 500, damping: 32 }}>
                                <label className={lbl}>Email Address</label>
                                <input id="login-lecturer-email" type="email" required value={lecturerEmail} onChange={e => setLecturerEmail(e.target.value)} placeholder="xavier@futo.edu.ng" className={inp} autoFocus />
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.10, type: "spring", stiffness: 500, damping: 32 }}>
                                <label className={lbl}>Password</label>
                                <input id="login-lecturer-pwd" type="password" required value={lecturerPassword} onChange={e => setLecturerPassword(e.target.value)} placeholder="••••••••••" className={inp} />
                              </motion.div>
                              <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.16, type: "spring", stiffness: 500, damping: 32 }}>
                                <motion.button id="lecturer-submit-btn" type="submit" disabled={loading} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer ${USERS[1].btn}`}>
                                  {loading ? "Signing in…" : "Sign In"} {!loading && <ArrowRight className="h-4 w-4" />}
                                </motion.button>
                              </motion.div>
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22, duration: 0.3 }}>
                                <button type="button" onClick={() => { setMode("register"); setError(null); }} className={link}>New staff? Register</button>
                              </motion.div>
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
