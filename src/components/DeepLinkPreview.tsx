import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BookOpen, Clock, FileText, Radio, ClipboardList, ArrowRight, AlertTriangle } from "lucide-react";

type ResourceType = "quiz" | "note" | "exam" | "assignment" | "live";

interface Props {
  type: ResourceType;
  id: string;
  onSignIn: () => void;
}

const TYPE_META: Record<ResourceType, { label: string; icon: React.ElementType<{ className?: string }>; color: string; verb: string }> = {
  quiz:       { label: "Quiz",        icon: BookOpen,      color: "emerald", verb: "Take this quiz" },
  note:       { label: "Lecture Note",icon: FileText,      color: "blue",    verb: "Read this note" },
  exam:       { label: "Exam",        icon: ClipboardList, color: "purple",  verb: "Open this exam" },
  assignment: { label: "Assignment",  icon: ClipboardList, color: "amber",   verb: "View assignment" },
  live:       { label: "Live Session",icon: Radio,         color: "red",     verb: "Join live session" },
};

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50",
  blue:    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50",
  purple:  "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50",
  amber:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50",
  red:     "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50",
};

const btnMap: Record<string, string> = {
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  blue:    "bg-blue-600 hover:bg-blue-500",
  purple:  "bg-purple-600 hover:bg-purple-500",
  amber:   "bg-amber-600 hover:bg-amber-500",
  red:     "bg-red-600 hover:bg-red-500",
};

export default function DeepLinkPreview({ type, id, onSignIn }: Props) {
  const [meta, setMeta]       = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  const { label, icon: Icon, color, verb } = TYPE_META[type] ?? TYPE_META.quiz;

  useEffect(() => {
    fetch(`/api/public/${type}/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setMeta(d); })
      .catch(() => setNotFound(true));
  }, [type, id]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d] p-4">
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header strip */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />

        <div className="px-6 py-7 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="QuizOS" className="w-7 h-7 rounded-lg" />
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">QuizOS</span>
            <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">FUTO Academic Portal</span>
          </div>

          {notFound ? (
            <div className="text-center py-4 space-y-3">
              <AlertTriangle className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-300">Resource not found</p>
              <p className="text-[13px] text-slate-400">This link may have expired or been removed.</p>
            </div>
          ) : !meta ? (
            <div className="space-y-3 animate-pulse py-2">
              <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-2/3" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resource badge */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${colorMap[color]}`}>
                <Icon className="h-3 w-3" />
                {label}
              </span>

              {/* Title */}
              <h1 className="text-[20px] font-bold text-slate-900 dark:text-white leading-snug">
                {meta.title ?? meta.topic}
              </h1>

              {/* Course */}
              {meta.course && (
                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.course.code}</span>
                  {" · "}{meta.course.title}
                </p>
              )}

              {/* Extra metadata */}
              <div className="flex flex-wrap gap-2 text-[11.5px] font-mono text-slate-500 dark:text-slate-400">
                {meta.durationMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {meta.durationMinutes} min
                  </span>
                )}
                {meta.questionCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {meta.questionCount} questions
                  </span>
                )}
                {meta.dueDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Due {new Date(meta.dueDate).toLocaleDateString()}
                  </span>
                )}
                {type === "live" && (
                  <span className={`flex items-center gap-1 font-bold ${meta.isActive ? "text-red-500" : "text-slate-400"}`}>
                    <Radio className="h-3 w-3" /> {meta.isActive ? "LIVE NOW" : "Session ended"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          {!notFound && (
            <button
              onClick={onSignIn}
              className={`w-full py-3 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${btnMap[color]}`}
            >
              Sign in to {verb.toLowerCase()}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">
            You need a FUTO student account to access this resource.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
