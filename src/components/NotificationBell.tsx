import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, Award, FileText, Pencil, CheckCircle, X, BellOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface Notification {
  id: string;
  type: string;
  icon: string;
  title: string;
  body: string;
  time: string;
}

interface Props {
  token: string;
  onRequestPush?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STORAGE_KEY = "notif_last_seen";

export default function NotificationBell({ token, onRequestPush }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10); } catch { return 0; }
  });
  // Position of the dropdown in viewport coords (set on open via getBoundingClientRect)
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setNotifications)
      .catch(() => {});
  }, [token]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) return;
      const panel = document.getElementById("notif-panel");
      if (panel && panel.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reposition on scroll / resize while open
  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  const unreadCount = notifications.filter(n => new Date(n.time).getTime() > lastSeen).length;

  const handleOpen = () => {
    if (!open) {
      reposition();
      const now = Date.now();
      setLastSeen(now);
      try { localStorage.setItem(STORAGE_KEY, String(now)); } catch {}
    }
    setOpen(o => !o);
  };

  const iconFor = (icon: string) => {
    if (icon === "quiz") return <Award className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.8} />;
    if (icon === "exam") return <FileText className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.8} />;
    if (icon === "assignment") return <Pencil className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.8} />;
    return <CheckCircle className="h-3.5 w-3.5 text-purple-500" strokeWidth={1.8} />;
  };

  const colorFor = (icon: string) => {
    if (icon === "quiz") return "bg-emerald-100 dark:bg-emerald-900/40";
    if (icon === "exam") return "bg-blue-100 dark:bg-blue-900/40";
    if (icon === "assignment") return "bg-amber-100 dark:bg-amber-900/40";
    return "bg-purple-100 dark:bg-purple-900/40";
  };

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          id="notif-panel"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            width: Math.min(370, window.innerWidth - 16),
          }}
        >
          {/* Fully opaque panel — no backdrop-blur, no transparency */}
          <div
            className="rounded-[18px] overflow-hidden bg-white dark:bg-[#232325]"
            style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.14), 0 24px 48px rgba(0,0,0,0.10)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#232325] border-b border-black/[0.07] dark:border-white/[0.09]">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
                <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white tracking-[-0.01em]">Notifications</span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                    {unreadCount} new
                  </span>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.14] transition text-[#6e6e73] dark:text-white/60 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto bg-white dark:bg-[#232325]">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f2f2f7] dark:bg-white/[0.08] flex items-center justify-center mx-auto mb-3">
                    <BellOff className="h-5 w-5 text-[#8e8e93] dark:text-white/30" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/80 mb-0.5">All caught up</p>
                  <p className="text-[11.5px] text-[#8e8e93] dark:text-white/35">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const isNew = new Date(n.time).getTime() > lastSeen;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3.5 border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 ${
                        isNew
                          ? "bg-emerald-50 dark:bg-emerald-500/[0.08]"
                          : "bg-white dark:bg-[#232325]"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${colorFor(n.icon)}`}>
                        {iconFor(n.icon)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-snug">{n.title}</p>
                          {isNew && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />}
                        </div>
                        <p className="text-[11px] text-[#6e6e73] dark:text-white/45 mt-0.5 leading-snug">{n.body}</p>
                        <p className="text-[10.5px] text-[#8e8e93] dark:text-white/30 mt-1">{timeAgo(n.time)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Push-enable footer */}
            {onRequestPush && (
              <div className="px-4 py-3 bg-[#f5f5f7] dark:bg-white/[0.05] border-t border-black/[0.07] dark:border-white/[0.08] flex items-center justify-between gap-3">
                <p className="text-[11px] text-[#6e6e73] dark:text-white/45 leading-snug">Get alerts for quizzes &amp; assignments</p>
                <button
                  onClick={() => { onRequestPush(); setOpen(false); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Enable
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-[10px] text-[#3a3a3c] dark:text-white/80 hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-[3px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold ring-[1.5px] ring-white dark:ring-[#141416]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
}
