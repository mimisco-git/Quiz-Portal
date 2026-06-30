import React, { useState, useEffect } from "react";
import {
  GraduationCap, BookOpen, ShieldAlert, ArrowRight,
  ClipboardCheck, ArrowLeft, KeyRound, HelpCircle,
  CheckCircle, Sun, Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import FUTOLogo from "./FUTOLogo";

interface LoginProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ theme, onToggleTheme, onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"student" | "lecturer">("student");
  const [mode, setMode] = useState<"login" | "register" | "security-fix">("login");

  // Login States
  const [studentRegNumber, setStudentRegNumber] = useState("");
  const [studentYear, setStudentYear] = useState("Year 1");
  const [lecturerEmail, setLecturerEmail] = useState("");
  const [lecturerPassword, setLecturerPassword] = useState("");

  // Student Register States
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRegNumber, setRegRegNumber] = useState("");
  const [regDepartment, setRegDepartment] = useState("");
  const [regYear, setRegYear] = useState("Year 1");
  const [securityQuestion, setSecurityQuestion] = useState("What is your high school name?");
  const [securityAnswer, setSecurityAnswer] = useState("");

  // Lecturer Register States
  const [regLecturerName, setRegLecturerName] = useState("");
  const [regLecturerEmail, setRegLecturerEmail] = useState("");
  const [regLecturerPassword, setRegLecturerPassword] = useState("");

  // Year Recovery / Security Fix States
  const [fixRegNumber, setFixRegNumber] = useState("");
  const [fixQuestion, setFixQuestion] = useState("");
  const [fixAnswer, setFixAnswer] = useState("");
  const [fixNewYear, setFixNewYear] = useState("Year 1");
  const [fixStep, setFixStep] = useState<"enter-reg" | "answer-question">("enter-reg");

  // General App State
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartmentsList(data.map((d) => d.name));
      })
      .catch((e) => console.error("Error fetching departments:", e));
  }, []);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: studentRegNumber, year: studentYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log in");
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => onLoginSuccess(data.token, data.user), 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/student-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: regFullName, email: regEmail, regNumber: regRegNumber, department: regDepartment, year: regYear, securityQuestion, securityAnswer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setSuccess("Account registered successfully! Welcome aboard.");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLecturerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/lecturer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lecturerEmail, password: lecturerPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lecturer verification failed");
      setSuccess("Administrative authorization granted!");
      setTimeout(() => onLoginSuccess(data.token, data.user), 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLecturerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/lecturer-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regLecturerName, email: regLecturerEmail, password: regLecturerPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lecturer registration failed");
      setSuccess("Lecturer account created! Logging in...");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/student-get-security-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: fixRegNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setFixQuestion(data.securityQuestion);
      setFixStep("answer-question");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFixYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/student-fix-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: fixRegNumber, securityAnswer: fixAnswer, newYear: fixNewYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect answer or session error");
      setSuccess("Year of study updated! Logged in directly.");
      setTimeout(() => onLoginSuccess(data.token, data.user), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (type: "student" | "lecturer" | "new-student") => {
    setError(null);
    if (type === "student") {
      setMode("login"); setActiveTab("student");
      setStudentRegNumber("FUTO/2026/10423"); setStudentYear("Year 3");
      setCopiedText("John Doe");
    } else if (type === "lecturer") {
      setMode("login"); setActiveTab("lecturer");
      setLecturerEmail("xavier@futo.edu.ng"); setLecturerPassword("admin123");
      setCopiedText("Dr. Xavier");
    } else if (type === "new-student") {
      setMode("register"); setActiveTab("student");
      setRegFullName("Nwachukwu Chinedu"); setRegEmail("chinedu@futo.edu.ng");
      setRegRegNumber("FUTO/2026/80421"); setRegDepartment("Computer Science");
      setRegYear("Year 1"); setSecurityQuestion("What is your high school name?");
      setSecurityAnswer("FUTO Staff School"); setCopiedText("New Student Form");
    }
    setTimeout(() => setCopiedText(null), 2000);
  };

  const yearsOptions = ["Year 1","Year 2","Year 3","Year 4","Year 5","Extra Year","Postgraduate"];

  const labelClass = "block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.10em] mb-2";
  const linkClass  = "text-[13px] text-emerald-700 dark:text-emerald-400 font-semibold hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-pointer";

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans antialiased">

      {/* ── L1: Base gradient ── */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d]" />

      {/* ── L2: Center bloom ── */}
      <div
        className="fixed inset-0 pointer-events-none dark:opacity-0"
        style={{ background: "radial-gradient(ellipse 80% 65% at 50% 38%, rgba(167,243,208,0.32) 0%, transparent 70%)" }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-0 dark:opacity-100"
        style={{ background: "radial-gradient(ellipse 80% 65% at 50% 38%, rgba(4,120,87,0.17) 0%, transparent 70%)" }}
      />

      {/* ── L3: Noise texture ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.045]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      {/* ── L4: Vignette ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 50%, rgba(0,0,0,0.07) 100%)" }}
      />

      {/* ── Ambient orbs – light mode ── */}
      <div
        className="fixed -top-[18%] -left-[8%] w-[60%] aspect-square rounded-full pointer-events-none orb-1 dark:opacity-0"
        style={{ background: "radial-gradient(circle, rgba(110,231,183,0.34) 0%, transparent 68%)" }}
      />
      <div
        className="fixed -bottom-[18%] -right-[8%] w-[52%] aspect-square rounded-full pointer-events-none orb-2 dark:opacity-0"
        style={{ background: "radial-gradient(circle, rgba(167,243,208,0.28) 0%, transparent 68%)" }}
      />
      <div
        className="fixed top-[35%] right-[12%] w-[32%] aspect-square rounded-full pointer-events-none orb-3 dark:opacity-0"
        style={{ background: "radial-gradient(circle, rgba(209,250,229,0.34) 0%, transparent 70%)" }}
      />

      {/* ── Ambient orbs – dark mode ── */}
      <div
        className="fixed top-[5%] left-[2%] w-[50%] aspect-square rounded-full pointer-events-none orb-1 opacity-0 dark:opacity-100"
        style={{ background: "radial-gradient(circle, rgba(4,120,87,0.26) 0%, transparent 68%)" }}
      />
      <div
        className="fixed bottom-[5%] right-[2%] w-[45%] aspect-square rounded-full pointer-events-none orb-2 opacity-0 dark:opacity-100"
        style={{ background: "radial-gradient(circle, rgba(5,150,105,0.20) 0%, transparent 68%)" }}
      />

      {/* ── Theme toggle ── */}
      <div className="fixed top-4 right-4 z-30 sm:top-6 sm:right-6">
        <button
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          className="flex items-center justify-center w-9 h-9 rounded-full
            bg-white/75 dark:bg-white/10
            border border-white/65 dark:border-white/10
            backdrop-blur-xl shadow-sm
            text-slate-600 dark:text-slate-300
            hover:bg-white dark:hover:bg-white/16
            hover:shadow-md
            transition-all duration-200 cursor-pointer"
        >
          {theme === "dark" ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
        </button>
      </div>

      {/* ── Page layout ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-14">
        <motion.div
          id="login-container"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[472px] relative"
        >

          {/* Offset decorative glows — visual asymmetry, light behind card */}
          <div
            className="absolute -top-12 -right-8 w-44 h-44 rounded-full pointer-events-none blur-[56px] opacity-55 dark:opacity-28"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,0.55) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-8 -left-10 w-36 h-36 rounded-full pointer-events-none blur-[48px] opacity-40 dark:opacity-18"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.50) 0%, transparent 70%)" }}
          />

          {/* ╔══════════════════════════════╗
              ║     GLASS CARD               ║
              ╚══════════════════════════════╝ */}
          <div className="glass-card rounded-[28px] overflow-hidden relative">
            {/* Top-edge specular — light catches the card rim */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none z-10 dark:via-white/22" />
            <div className="px-8 pt-9 pb-8 sm:px-10 sm:pt-10 sm:pb-9">

              {/* ── Logo & Header ── */}
              <div className="text-center mb-7">

                {/* Logo badge */}
                <div className="inline-flex items-center justify-center mb-3 relative">
                  <div
                    className="absolute inset-[-44px] rounded-full pointer-events-none"
                    style={{
                      background: "radial-gradient(circle, rgba(16,185,129,0.24) 0%, rgba(4,120,87,0.10) 44%, transparent 70%)",
                      animation: "logo-glow 3.5s ease-in-out infinite",
                    }}
                  />
                  <img
                    src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
                    alt="QuizOS"
                    className="relative h-[118px] w-auto select-none rounded-[22px] logo-float
                      shadow-[0_4px_24px_rgba(30,58,110,0.20),0_16px_48px_rgba(4,120,87,0.12)]
                      dark:shadow-[0_4px_32px_rgba(0,0,0,0.55),0_16px_48px_rgba(0,0,0,0.32)]"
                  />
                </div>

                {/* Motto */}
                <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-slate-400 dark:text-slate-500 mt-2">
                  Assess · Learn · Excel
                </p>

                <div className="mt-5 mb-4 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700/60 to-transparent" />

                {/* Description */}
                <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-[1.72] max-w-[285px] mx-auto tracking-[-0.01em]">
                  FUTO's secure academic portal: timed examinations, live lectures &amp; instant results.
                </p>
              </div>

              {/* ── Pill Tab Switcher ── */}
              {mode !== "security-fix" && (
                <div role="tablist" className="relative bg-slate-100/90 dark:bg-white/[0.055] rounded-[14px] p-1 mb-6 flex">
                  {/* Sliding indicator — uses transform (GPU composited, no layout thrash) */}
                  <div
                    className="absolute top-1 bottom-1 rounded-[10px] bg-white dark:bg-white/[0.14] shadow-sm
                      transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      width: "calc(50% - 4px)",
                      left: "4px",
                      transform: activeTab === "student" ? "translateX(0)" : "translateX(100%)",
                      willChange: "transform",
                    }}
                  />
                  <button
                    id="student-tab-btn"
                    role="tab"
                    aria-selected={activeTab === "student"}
                    aria-controls="student-tab-panel"
                    onClick={() => { setActiveTab("student"); setError(null); setSuccess(null); }}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold rounded-[10px] transition-colors duration-200 cursor-pointer ${
                      activeTab === "student"
                        ? "text-slate-800 dark:text-white"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Student
                  </button>
                  <button
                    id="lecturer-tab-btn"
                    role="tab"
                    aria-selected={activeTab === "lecturer"}
                    aria-controls="lecturer-tab-panel"
                    onClick={() => { setActiveTab("lecturer"); setError(null); setSuccess(null); }}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold rounded-[10px] transition-colors duration-200 cursor-pointer ${
                      activeTab === "lecturer"
                        ? "text-slate-800 dark:text-white"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Lecturer
                  </button>
                </div>
              )}

              {/* ── Alert Banners ── */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    id="login-error-alert"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/25 border border-red-100 dark:border-red-900/30 rounded-[12px] p-3.5 text-red-700 dark:text-red-400">
                      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-red-500 dark:text-red-500 mb-0.5">Error</p>
                        <p className="text-[12.5px] leading-relaxed">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    id="login-success-alert"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/30 rounded-[12px] p-3.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 mb-0.5">Success</p>
                        <p className="text-[12.5px] leading-relaxed">{success}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Forms (animated swap) ── */}
              <AnimatePresence mode="wait">

                {/* 1 ── YEAR FIX / SECURITY RECOVERY ── */}
                {mode === "security-fix" && (
                  <motion.div
                    key="security-fix"
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 14 }}
                    transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <button
                        onClick={() => { setMode("login"); setError(null); setSuccess(null); setFixStep("enter-reg"); }}
                        className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors cursor-pointer -ml-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                        Year Maintenance Portal
                      </span>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-700/25 rounded-[12px] p-3.5 text-[12.5px] text-amber-800 dark:text-amber-400 leading-relaxed">
                      <strong className="font-semibold">Notice:</strong> Verify your identity with your registered security question to update your study year in the University Registry.
                    </div>

                    {fixStep === "enter-reg" ? (
                      <form onSubmit={handleGetSecurityQuestion} className="space-y-4">
                        <div>
                          <label htmlFor="fix-reg" className={labelClass}>Registration Number</label>
                          <input id="fix-reg" type="text" required value={fixRegNumber} onChange={(e) => setFixRegNumber(e.target.value.toUpperCase())} placeholder="e.g. FUTO/2026/10423" className="premium-input font-mono" />
                        </div>
                        <button type="submit" disabled={loading} className="btn-gradient">
                          {loading ? "Verifying..." : "Retrieve Security Challenge"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleFixYearSubmit} className="space-y-4">
                        <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] rounded-[12px] p-3.5">
                          <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Security Question</p>
                            <p className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">{fixQuestion}</p>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="fix-ans" className={labelClass}>Your Answer</label>
                          <input id="fix-ans" type="text" required value={fixAnswer} onChange={(e) => setFixAnswer(e.target.value)} placeholder="Enter your secret answer" className="premium-input" />
                        </div>
                        <div>
                          <label htmlFor="fix-year" className={labelClass}>Correct Year of Study</label>
                          <select id="fix-year" value={fixNewYear} onChange={(e) => setFixNewYear(e.target.value)} className="premium-input">
                            {yearsOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <button type="submit" disabled={loading} className="btn-gradient">
                          {loading ? "Updating..." : "Verify & Update Records"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}

                {/* 2 ── STUDENT LOGIN ── */}
                {activeTab === "student" && mode === "login" && (
                  <motion.form
                    key="student-login"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    onSubmit={handleStudentLogin}
                    className="space-y-4"
                  >
                    <div className="text-center pb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        <ClipboardCheck className="h-3 w-3" /> Student Login
                      </span>
                    </div>

                    <div>
                      <label htmlFor="login-student-reg" className={labelClass}>Registration Number</label>
                      <input id="login-student-reg" type="text" required value={studentRegNumber} onChange={(e) => setStudentRegNumber(e.target.value.toUpperCase())} placeholder="e.g. FUTO/2026/10423" className="premium-input font-mono" />
                    </div>

                    <div>
                      <label htmlFor="login-student-year" className={labelClass}>Year of Study</label>
                      <select id="login-student-year" value={studentYear} onChange={(e) => setStudentYear(e.target.value)} className="premium-input">
                        {yearsOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <button type="button" onClick={() => { setMode("register"); setError(null); setSuccess(null); }} className={linkClass}>
                        New student? Register
                      </button>
                      <button type="button" onClick={() => { setMode("security-fix"); setError(null); setSuccess(null); setFixRegNumber(studentRegNumber); }} className="flex items-center gap-1 text-[11.5px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium font-mono transition-colors cursor-pointer">
                        <KeyRound className="h-3 w-3" /> Fix year
                      </button>
                    </div>

                    <button id="student-submit-btn" type="submit" disabled={loading} className="btn-gradient">
                      {loading ? "Signing in..." : "Sign In"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.form>
                )}

                {/* 3 ── STUDENT REGISTER ── */}
                {activeTab === "student" && mode === "register" && (
                  <motion.form
                    key="student-register"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    onSubmit={handleStudentRegister}
                    className="space-y-3.5"
                  >
                    <div className="text-center pb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        <ClipboardCheck className="h-3 w-3" /> New Student Registration
                      </span>
                    </div>

                    <div>
                      <label htmlFor="reg-fullname" className={labelClass}>Full Name</label>
                      <input id="reg-fullname" type="text" required value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="e.g. John Chijioke Okafor" className="premium-input" />
                    </div>

                    <div>
                      <label htmlFor="reg-email" className={labelClass}>Email Address</label>
                      <input id="reg-email" type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="chinedu@futo.edu.ng" className="premium-input" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-number" className={labelClass}>Reg. Number</label>
                        <input id="reg-number" type="text" required value={regRegNumber} onChange={(e) => setRegRegNumber(e.target.value)} placeholder="FUTO/2026/..." className="premium-input font-mono uppercase" />
                      </div>
                      <div>
                        <label htmlFor="reg-year" className={labelClass}>Entry Year</label>
                        <select id="reg-year" value={regYear} onChange={(e) => setRegYear(e.target.value)} className="premium-input">
                          {yearsOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-dept" className={labelClass}>Department</label>
                      <input id="reg-dept" type="text" required list="departments-datalist" value={regDepartment} onChange={(e) => setRegDepartment(e.target.value)} placeholder="Type or select your department" className="premium-input" />
                      <datalist id="departments-datalist">
                        {departmentsList.map((dept) => <option key={dept} value={dept} />)}
                        <option value="Computer Science" />
                        <option value="Information Technology" />
                        <option value="Software Engineering" />
                        <option value="Cybersecurity" />
                        <option value="Electrical Engineering" />
                      </datalist>
                    </div>

                    {/* Security setup */}
                    <div className="pt-0.5">
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700/60 to-transparent mb-3.5" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Year Recovery Setup</p>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="reg-security-q" className={labelClass}>Security Question</label>
                          <select id="reg-security-q" value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} className="premium-input">
                            <option value="What is your high school name?">What is your high school name?</option>
                            <option value="What was your childhood nickname?">What was your childhood nickname?</option>
                            <option value="What is your favorite academic course?">What is your favorite academic course?</option>
                            <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="reg-security-a" className={labelClass}>Your Answer</label>
                          <input id="reg-security-a" type="text" required value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="Answer used to recover your year records" className="premium-input" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-start pt-0.5">
                      <button type="button" onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className={linkClass}>
                        Already registered? Sign in
                      </button>
                    </div>

                    <button type="submit" disabled={loading} className="btn-gradient">
                      {loading ? "Creating account..." : "Complete Registration"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.form>
                )}

                {/* 4 ── LECTURER LOGIN ── */}
                {activeTab === "lecturer" && mode === "login" && (
                  <motion.form
                    key="lecturer-login"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    onSubmit={handleLecturerLogin}
                    className="space-y-4"
                  >
                    <div className="text-center pb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        <GraduationCap className="h-3 w-3" /> Academic Staff Login
                      </span>
                    </div>

                    <div>
                      <label htmlFor="login-lecturer-email" className={labelClass}>Email Address</label>
                      <input id="login-lecturer-email" type="email" required value={lecturerEmail} onChange={(e) => setLecturerEmail(e.target.value)} placeholder="xavier@futo.edu.ng" className="premium-input" />
                    </div>

                    <div>
                      <label htmlFor="login-lecturer-pwd" className={labelClass}>Password</label>
                      <input id="login-lecturer-pwd" type="password" required value={lecturerPassword} onChange={(e) => setLecturerPassword(e.target.value)} placeholder="••••••••" className="premium-input" />
                    </div>

                    <div className="flex justify-start pt-0.5">
                      <button type="button" onClick={() => { setMode("register"); setError(null); setSuccess(null); }} className={linkClass}>
                        New staff? Register here
                      </button>
                    </div>

                    <button id="lecturer-submit-btn" type="submit" disabled={loading} className="btn-gradient">
                      {loading ? "Signing in..." : "Sign In"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.form>
                )}

                {/* 5 ── LECTURER REGISTER ── */}
                {activeTab === "lecturer" && mode === "register" && (
                  <motion.form
                    key="lecturer-register"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    onSubmit={handleLecturerRegister}
                    className="space-y-4"
                  >
                    <div className="text-center pb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        <GraduationCap className="h-3 w-3" /> Staff Registration
                      </span>
                    </div>

                    <div>
                      <label htmlFor="reg-staff-name" className={labelClass}>Full Name</label>
                      <input id="reg-staff-name" type="text" required value={regLecturerName} onChange={(e) => setRegLecturerName(e.target.value)} placeholder="e.g. Professor Charles Xavier" className="premium-input" />
                    </div>

                    <div>
                      <label htmlFor="reg-staff-email" className={labelClass}>Staff Email</label>
                      <input id="reg-staff-email" type="email" required value={regLecturerEmail} onChange={(e) => setRegLecturerEmail(e.target.value)} placeholder="staff@futo.edu.ng" className="premium-input" />
                    </div>

                    <div>
                      <label htmlFor="reg-staff-pwd" className={labelClass}>Password</label>
                      <input id="reg-staff-pwd" type="password" required value={regLecturerPassword} onChange={(e) => setRegLecturerPassword(e.target.value)} placeholder="Create a strong password" className="premium-input" />
                    </div>

                    <div className="flex justify-start pt-0.5">
                      <button type="button" onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className={linkClass}>
                        Already staff? Sign in
                      </button>
                    </div>

                    <button type="submit" disabled={loading} className="btn-gradient">
                      {loading ? "Creating account..." : "Register Staff Account"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* ── Sandbox Presets ── */}
              <div className="mt-6 pt-5 border-t border-slate-100/80 dark:border-white/[0.055]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                    Sandbox Presets
                  </span>
                  <AnimatePresence>
                    {copiedText && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8, x: 6 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 6 }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold"
                      >
                        ✓ {copiedText}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "student",     label: "Student",   name: "John Doe",    sub: "Year 3", action: "student"     as const },
                    { id: "new-student", label: "New Reg.",  name: "Nwachukwu C.",sub: "Year 1", action: "new-student" as const },
                    { id: "lecturer",    label: "Lecturer",  name: "Dr. Xavier",  sub: "Admin",  action: "lecturer"    as const },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleQuickFill(p.action)}
                      className="group flex flex-col items-start p-2.5
                        bg-slate-50/80 dark:bg-white/[0.04]
                        hover:bg-emerald-50 dark:hover:bg-emerald-950/30
                        border border-slate-200/55 dark:border-white/[0.055]
                        hover:border-emerald-200 dark:hover:border-emerald-800/40
                        rounded-[10px] transition-all duration-200 cursor-pointer text-left"
                    >
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 font-mono uppercase group-hover:text-emerald-600 transition-colors">{p.label}</span>
                      <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5 leading-tight">{p.name}</span>
                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 mt-0.5">{p.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Below-card tagline */}
          <p className="text-center mt-4 text-[10px] text-slate-400/70 dark:text-slate-700 select-none">
            © 2026 · Assess. Learn. Excel.
          </p>

        </motion.div>
      </div>
    </div>
  );
}
