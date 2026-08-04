import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, LogOut, Check, X, Trash2, Users, Clock, CheckCircle, XCircle, RefreshCw, GraduationCap, KeyRound, Copy, Eye, EyeOff } from "lucide-react";

interface Lecturer {
  id: string;
  name: string;
  email: string;
  status: string;
  departments: string;
}

interface Props {
  token: string;
  user: any;
  onLogout: () => void;
}

export default function AdminDashboard({ token, user, onLogout }: Props) {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resetModal, setResetModal] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [showTempPw, setShowTempPw] = useState(false);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLecturers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lecturers", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLecturers(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLecturers(); }, [fetchLecturers]);

  const act = async (id: string, action: "approve" | "reject" | "delete") => {
    setActionId(id);
    try {
      const res = await fetch(
        action === "delete" ? `/api/admin/lecturers/${id}` : `/api/admin/lecturers/${id}/${action}`,
        { method: action === "delete" ? "DELETE" : "PUT", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        showToast(action === "approve" ? "Lecturer approved — email sent." : action === "reject" ? "Lecturer rejected — email sent." : "Lecturer deleted.");
        fetchLecturers();
      } else {
        const d = await res.json();
        showToast(d.error || "Action failed.", false);
      }
    } catch { showToast("Network error.", false); }
    finally { setActionId(null); }
  };

  const resetPassword = async (lecturer: Lecturer) => {
    setActionId(lecturer.id);
    try {
      const res = await fetch(`/api/admin/lecturers/${lecturer.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setShowTempPw(false);
        setCopied(false);
        setResetModal({ name: lecturer.name, email: lecturer.email, tempPassword: data.tempPassword });
        showToast("Password reset — email sent to lecturer.");
      } else {
        showToast(data.error || "Reset failed.", false);
      }
    } catch { showToast("Network error.", false); }
    finally { setActionId(null); }
  };

  const copyTempPw = async () => {
    if (!resetModal) return;
    await navigator.clipboard.writeText(resetModal.tempPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = lecturers.filter(l => l.status === tab);
  const counts = {
    pending: lecturers.filter(l => l.status === "pending").length,
    approved: lecturers.filter(l => l.status === "approved").length,
    rejected: lecturers.filter(l => l.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d] p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-emerald-600 flex items-center justify-center shadow-md">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-[#1d1d1f] dark:text-white/90 leading-tight">Admin Panel</h1>
            <p className="text-[11px] text-[#6e6e73] dark:text-white/40">QuizOS · {user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLecturers} className="p-2 rounded-[10px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-[#6e6e73] dark:text-white/40 transition cursor-pointer">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] text-[#6e6e73] dark:text-white/40 text-[12px] font-medium transition cursor-pointer">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { label: "Pending", key: "pending", icon: Clock, color: "text-amber-500" },
            { label: "Approved", key: "approved", icon: CheckCircle, color: "text-emerald-500" },
            { label: "Rejected", key: "rejected", icon: XCircle, color: "text-red-400" },
          ] as const).map(({ label, key, icon: Icon, color }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`apple-card p-4 text-center transition cursor-pointer ${tab === key ? "ring-2 ring-emerald-500/40" : ""}`}>
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <p className="text-[22px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{counts[key]}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">{label}</p>
            </button>
          ))}
        </div>

        {/* Lecturer list */}
        <div className="apple-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <h2 className="text-[14px] font-bold text-[#1d1d1f] dark:text-white/90 capitalize">{tab} Lecturers</h2>
            <span className="ml-auto text-[11px] font-mono text-[#6e6e73] dark:text-white/40">{filtered.length}</span>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><RefreshCw className="h-5 w-5 animate-spin text-emerald-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 text-[#6e6e73] dark:text-white/20" />
              <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No {tab} lecturers</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {filtered.map(l => (
                <div key={l.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">{l.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{l.name}</p>
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 truncate">{l.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {tab === "pending" && (
                      <>
                        <button disabled={actionId === l.id} onClick={() => act(l.id, "approve")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11.5px] font-semibold transition disabled:opacity-50 cursor-pointer">
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button disabled={actionId === l.id} onClick={() => act(l.id, "reject")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-[11.5px] font-semibold transition disabled:opacity-50 cursor-pointer">
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                    {tab === "rejected" && (
                      <button disabled={actionId === l.id} onClick={() => act(l.id, "approve")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11.5px] font-semibold transition disabled:opacity-50 cursor-pointer">
                        <Check className="h-3 w-3" /> Approve
                      </button>
                    )}
                    {tab === "approved" && (
                      <>
                        <button disabled={actionId === l.id} onClick={() => resetPassword(l)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[11.5px] font-semibold transition disabled:opacity-50 cursor-pointer">
                          <KeyRound className="h-3 w-3" /> Reset PW
                        </button>
                        <button disabled={actionId === l.id} onClick={() => act(l.id, "reject")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 text-amber-700 dark:text-amber-400 text-[11.5px] font-semibold transition disabled:opacity-50 cursor-pointer">
                          <X className="h-3 w-3" /> Suspend
                        </button>
                      </>
                    )}
                    <button disabled={actionId === l.id} onClick={() => act(l.id, "delete")}
                      className="p-1.5 rounded-[8px] hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition disabled:opacity-50 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Temp password modal */}
      <AnimatePresence>
        {resetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setResetModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    <KeyRound className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="text-white text-[15px] font-bold leading-tight">Password Reset</p>
                    <p className="text-white/70 text-[11px]">{resetModal.name}</p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-5 space-y-4">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  A temporary password has been generated and emailed to <span className="font-medium text-slate-800 dark:text-white">{resetModal.email}</span>. The lecturer will be required to change it on next login.
                </p>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Temporary Password</p>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3">
                    <span className="flex-1 font-mono text-[15px] font-bold text-slate-800 dark:text-white tracking-widest">
                      {showTempPw ? resetModal.tempPassword : "•".repeat(resetModal.tempPassword.length)}
                    </span>
                    <button onClick={() => setShowTempPw(v => !v)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
                      {showTempPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={copyTempPw} className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  {copied && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Copied to clipboard</p>}
                </div>
                <button
                  onClick={() => setResetModal(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[13px] font-semibold transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-[12px] text-[12.5px] font-semibold text-white shadow-lg z-50 ${toast.ok ? "bg-emerald-600" : "bg-red-500"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
