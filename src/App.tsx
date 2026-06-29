import { useState, useEffect } from "react";
import Login from "./components/Login";
import StudentDashboard from "./components/StudentDashboard";
import LecturerDashboard from "./components/LecturerDashboard";
import { User } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, Clock, LogOut } from "lucide-react";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Theme State
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("futo_theme") as "light" | "dark") || "light"
  );

  // Global Session Expiration States
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(10);

  // Sync Theme with DOM root
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("futo_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Load session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("edu_token");
    const storedUser = localStorage.getItem("edu_user");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored session details", err);
        handleLogout();
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (newToken: string, loggedInUser: any) => {
    setToken(newToken);
    setUser(loggedInUser);
    localStorage.setItem("edu_token", newToken);
    localStorage.setItem("edu_user", JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("edu_token");
    localStorage.removeItem("edu_user");
  };

  // 1. Proactive Client-Side JWT Expiration Check (Runs every 5s)
  useEffect(() => {
    if (!token) {
      setShowSessionExpired(false);
      return;
    }

    const checkTokenExpiration = () => {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const payload = JSON.parse(atob(base64));
          
          if (payload && payload.exp) {
            const expTime = payload.exp * 1000;
            const currentTime = Date.now();
            
            if (currentTime >= expTime) {
              if (!showSessionExpired) {
                setShowSessionExpired(true);
                setSessionCountdown(10);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error inspecting token for expiration", err);
      }
    };

    // Run immediately on token change
    checkTokenExpiration();

    const interval = setInterval(checkTokenExpiration, 5000);
    return () => clearInterval(interval);
  }, [token, showSessionExpired]);

  // 2. Reactive Network Response Interceptor (Catching 401 & 403 status codes)
  useEffect(() => {
    if (!token) return;

    let restored = false;
    const originalFetch = window.fetch;

    try {
      const customFetch = async (...args: any[]) => {
        try {
          const response = await originalFetch(...(args as [RequestInfo | URL, RequestInit?]));
          if (response.status === 401 || response.status === 403) {
            if (!showSessionExpired) {
              setShowSessionExpired(true);
              setSessionCountdown(10);
            }
          }
          return response;
        } catch (err) {
          return Promise.reject(err);
        }
      };

      try {
        // Try direct assignment first
        (window as any).fetch = customFetch;
      } catch {
        // If direct assignment fails, try Object.defineProperty
        Object.defineProperty(window, "fetch", {
          value: customFetch,
          configurable: true,
          writable: true,
        });
      }
    } catch (err) {
      console.warn("FUTO Platform: Global fetch interceptor disabled due to browser container restrictions:", err);
    }

    return () => {
      if (!restored) {
        try {
          (window as any).fetch = originalFetch;
        } catch {
          try {
            Object.defineProperty(window, "fetch", {
              value: originalFetch,
              configurable: true,
              writable: true,
            });
          } catch {
            // ignore
          }
        }
        restored = true;
      }
    };
  }, [token, showSessionExpired]);

  // 3. Graceful Logout Countdown Handler
  useEffect(() => {
    if (!showSessionExpired) return;

    const interval = setInterval(() => {
      setSessionCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleLogout();
          setShowSessionExpired(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showSessionExpired]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d]">
        <div className="flex flex-col items-center gap-4">
          {/* Gradient spinner */}
          <div className="relative w-11 h-11">
            <div className="absolute inset-0 rounded-full border-[2.5px] border-emerald-100/60 dark:border-emerald-900/40" />
            <div
              className="absolute inset-0 rounded-full border-[2.5px] border-transparent"
              style={{
                borderTopColor: "#047857",
                borderRightColor: "#10b981",
                animation: "spin-smooth 0.85s linear infinite",
              }}
            />
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Initializing
            </p>
            <p className="text-[9.5px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest">
              FUTO Secure Platform
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 min-h-screen selection:bg-emerald-500/20 selection:text-emerald-900 relative transition-colors duration-300">
      <AnimatePresence mode="wait">
        {!token || !user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Login theme={theme} onToggleTheme={toggleTheme} onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        ) : user.role === "student" ? (
          <motion.div
            key="student-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <StudentDashboard
              token={token}
              user={{
                id: user.id,
                fullName: user.fullName || "John Doe",
                regNumber: user.regNumber || "FUTO/2026/10423",
                department: user.department || "Computer Science",
                year: user.year || "Year 1",
              }}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
            />
          </motion.div>
        ) : (
          <motion.div
            key="lecturer-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <LecturerDashboard
              token={token}
              user={{
                id: user.id,
                name: user.name || "Dr. Charles Xavier",
                email: user.email || "xavier@futo.edu.ng",
              }}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Session Expiration Modal — Premium Glass Design */}
      <AnimatePresence>
        {showSessionExpired && (
          <motion.div
            id="session-expired-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(2, 2, 20, 0.72)", backdropFilter: "blur(16px)" }}
          >
            <motion.div
              initial={{ scale: 0.90, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.90, opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="glass-card max-w-sm w-full rounded-[24px] p-8 text-center space-y-5"
            >
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 flex items-center justify-center">
                  <ShieldAlert className="h-6 w-6 text-red-500 dark:text-red-400 animate-pulse" />
                </div>
              </div>

              {/* Text */}
              <div className="space-y-1">
                <h3 className="text-[18px] font-bold text-slate-900 dark:text-white font-display tracking-tight">
                  Session Expired
                </h3>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  FUTO Secure Exam Integrity Gate
                </p>
              </div>

              <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Your authentication token has expired. You will be signed out automatically to preserve academic integrity and protect your record.
              </p>

              {/* Countdown */}
              <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] rounded-[14px] p-4 space-y-2.5">
                <div className="flex items-center justify-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-300 font-semibold">
                  <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  Signing out in{" "}
                  <span className="font-mono text-slate-900 dark:text-white text-[15px] font-black tabular-nums">
                    {sessionCountdown}s
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: sessionCountdown, ease: "linear" }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #047857, #ef4444)" }}
                  />
                </div>
              </div>

              {/* CTA */}
              <button
                id="session-expired-logout-btn"
                type="button"
                onClick={() => { handleLogout(); setShowSessionExpired(false); }}
                className="btn-gradient"
              >
                <LogOut className="h-4 w-4" />
                Sign Out Now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
