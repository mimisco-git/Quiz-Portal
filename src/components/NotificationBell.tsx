import React, { useState, useEffect, useRef } from "react";
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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STORAGE_KEY = "notif_last_seen";

export default function NotificationBell({ token, onRequestPush }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10); } catch { return 0; }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotifications(data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unreadCount = notifications.filter(n => new Date(n.time).getTime() > lastSeen).length;

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) {
      const now = Date.now();
      setLastSeen(now);
      try { localStorage.setItem(STORAGE_KEY, String(now)); } catch {}
    }
  };

  const iconFor = (icon: string) => {
    if (icon === "quiz") return <Award className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.8} />;
    if (icon === "exam") return <FileText className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.8} />;
    if (icon === "assignment") return <Pencil className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.8} />;
    return <CheckCircle className="h-3.5 w-3.5 text-purple-500" strokeWidth={1.8} />;
  };

  const colorFor = (icon: string) => {
    if (icon === "quiz") return "bg-emerald-100 dark:bg-emerald-900/30";
    if (icon === "exam") return "bg-blue-100 dark:bg-blue-900/30";
    if (icon === "assignment") return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-purple-100 dark:bg-purple-900/30";
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-[10px] text-[#3a3a3c] dark:text-white/80 hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold ring-[1.5px] ring-white dark:ring-[#141416]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute right-0 top-[calc(100%+8px)] w-[320px] sm:w-[370px] z-[500] rounded-[18px] overflow-hidden"
            style={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 20px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07)" }}
          >
            {/* Solid opaque container — avoids backdrop-blur transparency bugs on mobile */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] overflow-hidden border border-black/[0.06] dark:border-white/[0.10]">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e]">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
                  <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white/90 tracking-[-0.01em]">Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                      {unreadCount} new
                    </span>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition text-[#8e8e93] dark:text-white/40 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto bg-white dark:bg-[#1c1c1e]">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#f2f2f7] dark:bg-white/[0.07] flex items-center justify-center mx-auto mb-3">
                      <BellOff className="h-5 w-5 text-[#8e8e93] dark:text-white/30" strokeWidth={1.5} />
                    </div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/70 mb-0.5">You're all caught up</p>
                    <p className="text-[11.5px] text-[#8e8e93] dark:text-white/35">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const isNew = new Date(n.time).getTime() > lastSeen;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 ${
                          isNew ? "bg-emerald-50 dark:bg-emerald-500/[0.07]" : "bg-white dark:bg-[#1c1c1e]"
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

              {/* Push-enable prompt */}
              {onRequestPush && (
                <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#f9f9fb] dark:bg-white/[0.04] flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#6e6e73] dark:text-white/45 leading-snug">Get push alerts for quizzes &amp; assignments</p>
                  <button
                    onClick={() => { onRequestPush(); setOpen(false); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer"
                  >
                    Enable
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
