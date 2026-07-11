import React, { useState } from "react";
import { ShieldAlert, ArrowRight, LogOut } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  token: string;
  regNumber: string;
  onPasswordChanged: (newToken: string, newUser: any) => void;
  onLogout: () => void;
}

export default function ForceChangePasswordScreen({ token, regNumber, onPasswordChanged, onLogout }: Props) {
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword.toUpperCase() === regNumber.toUpperCase()) {
      setError("Your password cannot be the same as your registration number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/student-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      let data: any;
      try { data = await res.json(); } catch { data = {}; }

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      onPasswordChanged(data.token, data.user);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inp = [
    "w-full px-4 py-3 rounded-xl text-[14px] font-medium",
    "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
    "text-slate-900 dark:text-white placeholder-slate-400",
    "outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500",
    "transition-all duration-200",
  ].join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-[17px] font-bold leading-tight">Create Your New Password</h1>
              <p className="text-white/70 text-[12px] mt-0.5">One-time security requirement</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-[13px] text-amber-800 dark:text-amber-300 leading-relaxed">
            <p className="font-semibold mb-1">Security Notice</p>
            <p className="text-amber-700 dark:text-amber-400/80">
              For security, your temporary password was your registration number. Please set a new password now to protect your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className={inp}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className={inp}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] text-red-600 dark:text-red-400 font-medium"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? "Saving…" : "Set Password & Continue"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out instead
          </button>
        </div>
      </motion.div>
    </div>
  );
}
