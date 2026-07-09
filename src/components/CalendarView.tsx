import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Award, FileText, Pencil, Radio, Calendar } from "lucide-react";
import { motion } from "motion/react";

interface CalEvent {
  id: string;
  type: string;
  title: string;
  courseCode: string;
  date: string;
  label: string;
}

interface Props {
  token: string;
}

const TYPE_COLOR: Record<string, string> = {
  quiz:       "bg-emerald-500",
  exam:       "bg-blue-500",
  assignment: "bg-amber-500",
  live:       "bg-red-500",
};

const TYPE_PILL: Record<string, string> = {
  quiz:       "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
  exam:       "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
  assignment: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
  live:       "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30",
};

function TypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const cls = `flex-shrink-0`;
  const sw = 1.8;
  if (type === "quiz")       return <Award       className={cls} width={size} height={size} strokeWidth={sw} />;
  if (type === "exam")       return <FileText     className={cls} width={size} height={size} strokeWidth={sw} />;
  if (type === "assignment") return <Pencil       className={cls} width={size} height={size} strokeWidth={sw} />;
  return                            <Radio        className={cls} width={size} height={size} strokeWidth={sw} />;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarView({ token }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/calendar", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const eventsOnDay = (d: Date) => events.filter(e => isSameDay(new Date(e.date), d));
  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  // Build month grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Upcoming events (from today, next 60 days)
  const upcoming = events.filter(e => {
    const d = new Date(e.date);
    const diff = d.getTime() - today.setHours(0,0,0,0);
    return diff >= 0 && diff <= 60 * 24 * 60 * 60 * 1000;
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }) + " · " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <motion.div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 items-start"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}>

      {/* ── Month Calendar ── */}
      <div className="apple-card w-full lg:w-[320px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition">
            <ChevronLeft className="h-4 w-4 text-[#6e6e73] dark:text-white/50" />
          </button>
          <span className="text-[13.5px] font-bold text-[#1d1d1f] dark:text-white/90 tracking-[-0.01em]">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition">
            <ChevronRight className="h-4 w-4 text-[#6e6e73] dark:text-white/50" />
          </button>
        </div>

        <div className="p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-[#8e8e93] dark:text-white/30 py-1">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const dayEvents = eventsOnDay(cellDate);
              const isToday = isSameDay(cellDate, new Date());
              const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false;
              const types = [...new Set(dayEvents.map(e => e.type))];

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : cellDate)}
                  className={`relative flex flex-col items-center py-1.5 rounded-[10px] transition ${
                    isSelected
                      ? "bg-[#1d1d1f] dark:bg-white"
                      : isToday
                        ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                        : "hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                  }`}
                >
                  <span className={`text-[12.5px] font-semibold leading-none ${
                    isSelected ? "text-white dark:text-[#1d1d1f]"
                    : isToday ? "text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-[#3a3a3c] dark:text-white/70"
                  }`}>{day}</span>
                  {types.length > 0 && (
                    <div className="flex gap-[2px] mt-1">
                      {types.slice(0, 3).map((t: string) => (
                        <span key={t} className={`h-[5px] w-[5px] rounded-full ${TYPE_COLOR[t] ?? "bg-gray-400"} ${isSelected ? "opacity-70" : ""}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 pb-4 flex flex-wrap gap-3">
          {[["quiz","Quiz"],["exam","Exam"],["assignment","Assignment"]].map(([type, label]) => (
            <span key={type} className="flex items-center gap-1.5 text-[10.5px] text-[#6e6e73] dark:text-white/40">
              <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[type]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right panel: selected day or upcoming list ── */}
      <div className="apple-card overflow-hidden min-h-[320px]">
        {selectedDay ? (
          <>
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
              <h3 className="apple-title">
                {selectedDay.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <p className="apple-subtitle">{selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""} scheduled</p>
            </div>
            <div className="p-5">
              {selectedEvents.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="h-8 w-8 mx-auto text-[#c7c7cc] dark:text-white/15 mb-2" strokeWidth={1.4} />
                  <p className="text-[12.5px] text-[#8e8e93] dark:text-white/35">No events on this day</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className={`flex items-start gap-3 p-3.5 rounded-[12px] border ${TYPE_PILL[ev.type] ?? "bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-700 dark:text-white/60"}`}>
                      <div className="flex-shrink-0 mt-0.5"><TypeIcon type={ev.type} size={15} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-tight truncate">{ev.title}</p>
                        <p className="text-[11px] opacity-70 mt-0.5 font-mono uppercase">{ev.courseCode} · {ev.label}</p>
                        <p className="text-[11px] opacity-60 mt-0.5">{formatDate(ev.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
              <h3 className="apple-title">Upcoming (next 60 days)</h3>
              <p className="apple-subtitle">Click any day on the calendar to filter</p>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="text-center py-10 text-[12px] text-[#8e8e93] dark:text-white/35">Loading events…</div>
              ) : upcoming.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="h-8 w-8 mx-auto text-[#c7c7cc] dark:text-white/15 mb-2" strokeWidth={1.4} />
                  <p className="text-[12.5px] text-[#8e8e93] dark:text-white/35">No upcoming deadlines</p>
                  <p className="text-[11px] text-[#c7c7cc] dark:text-white/20 mt-1">Quizzes, exams, and assignments with dates will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(ev => {
                    const evDate = new Date(ev.date);
                    const daysLeft = Math.ceil((evDate.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                    return (
                      <div key={ev.id} className="flex items-center gap-3 p-3 border border-black/[0.06] dark:border-white/[0.06] rounded-[12px] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${TYPE_PILL[ev.type]?.split(" ").slice(0,2).join(" ")}`}>
                          <TypeIcon type={ev.type} size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/88 truncate">{ev.title}</p>
                          <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{ev.courseCode}</span>
                            {" · "}{ev.label}{" · "}{formatDate(ev.date)}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                          daysLeft === 0 ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30"
                          : daysLeft <= 3 ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                          : "bg-black/[0.03] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.06] dark:border-white/[0.06]"
                        }`}>
                          {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
