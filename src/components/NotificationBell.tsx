import React, { useState, useEffect, useRef } from "react";
import { Bell, Award, FileText, Pencil, CheckCircle, X } from "lucide-react";
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

export default function NotificationBell({ token }: Props) {
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
        className="relative flex items-center justify-center w-9 h-9 rounded-[10px] text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" strokeWidth={1.6} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-[#141416]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute right-0 top-[calc(100%+6px)] w-[320px] sm:w-[360px] z-[300] rounded-[16px] shadow-2xl border border-black/[0.07] dark:border-white/[0.08] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white/90 tracking-[-0.01em]">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto text-[#c7c7cc] dark:text-white/15 mb-2" strokeWidth={1.4} />
                  <p className="text-[12.5px] text-[#8e8e93] dark:text-white/35">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const isNew = new Date(n.time).getTime() > lastSeen;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 transition ${
                        isNew ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]" : ""
                      }`}
                    >
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${colorFor(n.icon)}`}>
                        {iconFor(n.icon)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/88 leading-snug">{n.title}</p>
                        <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5 leading-snug">{n.body}</p>
                      </div>
                      <span className="text-[10px] text-[#8e8e93] dark:text-white/30 flex-shrink-0 mt-0.5">{timeAgo(n.time)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
