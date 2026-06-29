import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Award, LogOut, FileText, ChevronRight, Play, Clock, AlertTriangle, CheckCircle, ShieldAlert, Send, Radio, Filter, Calendar, Sun, Moon, Camera } from "lucide-react";
import { Course, LectureNote, Quiz, StudentAttempt, Question } from "../types";
import MarkdownView from "./MarkdownView";
import UserAvatar from "./UserAvatar";
import AvatarModal from "./AvatarModal";
import { motion, AnimatePresence } from "motion/react";
import FUTOLogo from "./FUTOLogo";

interface StudentDashboardProps {
  token: string;
  user: {
    id: string;
    fullName: string;
    regNumber: string;
    department: string;
    year: string;
  };
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
}

export default function StudentDashboard({ token, user, theme, onToggleTheme, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "quizzes" | "live-classroom">("notes");
  const [currentYear, setCurrentYear] = useState(user.year);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<LectureNote | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Record<string, StudentAttempt>>({});
  const [loading, setLoading] = useState(false);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);

  const [activeLiveSession, setActiveLiveSession] = useState<any | null>(null);
  const [liveChats, setLiveChats] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const fetchActiveLiveSession = async () => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/lectures/active/${selectedCourse.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveLiveSession(data);
        if (data && data.chats) {
          setLiveChats(data.chats);
        } else {
          setLiveChats([]);
        }
      }
    } catch (e) {
      console.error("Error fetching live lecture session:", e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (activeTab === "live-classroom" && selectedCourse) {
      fetchActiveLiveSession();
      interval = setInterval(fetchActiveLiveSession, 4000);
    } else {
      setActiveLiveSession(null);
      setLiveChats([]);
    }
    return () => clearInterval(interval);
  }, [activeTab, selectedCourse?.id]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveChats]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeLiveSession) return;
    const msg = chatMessage.trim();
    setChatMessage("");
    setIsSendingChat(true);
    try {
      const res = await fetch(`/api/lectures/${activeLiveSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const chat = await res.json();
        setLiveChats((prev) => [...prev, chat]);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handlePromoteYear = async (newYear: string) => {
    try {
      const res = await fetch("/api/student/promote-year", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newYear }),
      });
      if (res.ok) setCurrentYear(newYear);
    } catch (err) {
      console.error("Error updating year:", err);
    }
  };

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<StudentAttempt | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [examResult, setExamResult] = useState<{
    score: number;
    timedOut: boolean;
    answers: Record<string, string>;
    questions: Question[];
    title: string;
  } | null>(null);

  const [showExamExpiredModal, setShowExamExpiredModal] = useState(false);
  const [examExpiredCountdown, setExamExpiredCountdown] = useState(5);
  const [pendingExamResult, setPendingExamResult] = useState<{
    score: number;
    timedOut: boolean;
    answers: Record<string, string>;
    questions: Question[];
    title: string;
  } | null>(null);
  const [isBackgroundSubmitting, setIsBackgroundSubmitting] = useState(false);

  const [allNotes, setAllNotes] = useState<(LectureNote & { course?: { code: string; title: string } })[]>([]);
  const [notesFilterCourseId, setNotesFilterCourseId] = useState<string>("");

  useEffect(() => {
    fetchCourses();
    fetchAttempts();
    fetchAllNotes();
  }, []);

  const fetchAllNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const data = await res.json();
        setAllNotes(data);
      }
    } catch (err) {
      console.error("Error fetching all notes for materials section:", err);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0) fetchCourseDetail(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseDetail = async (courseId: string) => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCourse(data);
        if (data.quizzes) setQuizzes(data.quizzes);
      }
    } catch (err) {
      console.error("Error fetching course detail:", err);
    }
  };

  const fetchAttempts = async () => {
    try {
      const res = await fetch("/api/student/attempts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: StudentAttempt[] = await res.json();
        const attemptMap: Record<string, StudentAttempt> = {};
        data.forEach((a) => { attemptMap[a.quizId] = a; });
        setAttempts(attemptMap);
      }
    } catch (err) {
      console.error("Error fetching student attempts:", err);
    }
  };

  const handleStartExam = async (quiz: Quiz) => {
    if (attempts[quiz.id]?.isCompleted) {
      alert("You have already completed this exam.");
      return;
    }
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quizId: quiz.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start quiz session");

      const quizRes = await fetch(`/api/quizzes/${quiz.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const quizData = await quizRes.json();
      if (!quizRes.ok) throw new Error(quizData.error || "Failed to load quiz questions");

      setActiveQuiz(quizData);
      setQuizQuestions(quizData.questions || []);
      setActiveAttempt(data.attempt);
      setSubmitError(null);
      setSkippedCount(0);
      setShowSubmitConfirm(false);
      setAutoSaveStatus("idle");
      // Restore any locally saved draft for this attempt
      try {
        const draft = localStorage.getItem(`exam_draft_${data.attempt.id}`);
        setSelectedAnswers(draft ? JSON.parse(draft) : {});
      } catch {
        setSelectedAnswers({});
      }

      const initialSeconds = quiz.durationMinutes * 60;
      setRemainingSeconds(initialSeconds);
      startTimerSystem(data.attempt.id, initialSeconds);
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  const startTimerSystem = (attemptId: string, initialSeconds: number) => {
    stopTimerSystem();
    let currentSecs = initialSeconds;

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          triggerQuizExpired(attemptId);
          return 0;
        }
        currentSecs = prev - 1;
        return prev - 1;
      });
    }, 1000);

    const syncTime = async () => {
      setSyncStatus("syncing");
      try {
        const res = await fetch(`/api/quiz/remaining-time/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const serverSeconds = data.remainingSeconds;
          if (serverSeconds <= 0 || data.isCompleted) {
            stopTimerSystem();
            triggerQuizExpired(attemptId);
            return;
          }
          const discrepancy = Math.abs(currentSecs - serverSeconds);
          if (discrepancy > 5) {
            console.warn(`Clock discrepancy detected: local=${currentSecs}s, server=${serverSeconds}s. Resynced.`);
          }
          setRemainingSeconds(serverSeconds);
          setSyncStatus("synced");
        } else {
          setSyncStatus("error");
        }
      } catch (err) {
        setSyncStatus("error");
      }
    };

    setTimeout(syncTime, 2000);
    syncIntervalRef.current = setInterval(syncTime, 10000);
  };

  const stopTimerSystem = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  };

  const triggerQuizExpired = (attemptId: string) => {
    stopTimerSystem();
    setShowExamExpiredModal(true);
    setExamExpiredCountdown(5);
    setPendingExamResult(null);
    setIsBackgroundSubmitting(true);
    handleAutoSubmitBackground(attemptId);
  };

  const handleAutoSubmitBackground = async (attemptId: string) => {
    let currentAnswers: Record<string, string> = {};
    setSelectedAnswers((prev) => { currentAnswers = prev; return prev; });
    // Also try to recover any locally-saved draft
    try {
      const draft = localStorage.getItem(`exam_draft_${attemptId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        currentAnswers = { ...parsed, ...currentAnswers };
        localStorage.removeItem(`exam_draft_${attemptId}`);
      }
    } catch { /* ignore */ }
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attemptId, answers: currentAnswers, isAutoSubmit: true }),
      });
      const data = await res.json();
      setPendingExamResult({
        score: data.attempt?.score || data.score || 0,
        timedOut: true,
        answers: currentAnswers,
        questions: quizQuestions,
        title: activeQuiz?.title || "Academic Assessment",
      });
    } catch (err) {
      console.error("Auto submit failed:", err);
      setPendingExamResult({
        score: 0,
        timedOut: true,
        answers: currentAnswers,
        questions: quizQuestions,
        title: activeQuiz?.title || "Academic Assessment",
      });
    } finally {
      setIsBackgroundSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showExamExpiredModal) return;
    const interval = setInterval(() => {
      setExamExpiredCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showExamExpiredModal]);

  useEffect(() => {
    if (showExamExpiredModal && examExpiredCountdown === 0 && !isBackgroundSubmitting && pendingExamResult) {
      handleProceedToResults();
    }
  }, [showExamExpiredModal, examExpiredCountdown, isBackgroundSubmitting, pendingExamResult]);

  const handleProceedToResults = () => {
    if (!pendingExamResult) return;
    setExamResult(pendingExamResult);
    setShowExamExpiredModal(false);
    setPendingExamResult(null);
    setActiveQuiz(null);
    setActiveAttempt(null);
    fetchAttempts();
  };

  const handleManualSubmit = async (forceSkipped = false) => {
    if (!activeAttempt) return;
    if (!forceSkipped && !showSubmitConfirm) {
      setShowSubmitConfirm(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSkippedCount(0);
    setShowSubmitConfirm(false);
    try {
      const body: any = { attemptId: activeAttempt.id, answers: selectedAnswers };
      if (forceSkipped) body.confirmSkipped = true;

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 400 && data.error === "skipped_questions") {
        setSkippedCount(data.skippedCount || 0);
        setSubmitError(`${data.skippedCount} question(s) unanswered. Answer them or submit anyway.`);
        return;
      }

      if (res.status === 408) {
        setExamResult({ score: data.attempt?.score || 0, timedOut: true, answers: selectedAnswers, questions: quizQuestions, title: activeQuiz?.title || "Academic Assessment" });
      } else if (!res.ok) {
        setSubmitError(data.error || "Submission failed. Please try again.");
        return;
      } else {
        setExamResult({ score: data.score, timedOut: false, answers: selectedAnswers, questions: quizQuestions, title: activeQuiz?.title || "Academic Assessment" });
      }

      stopTimerSystem();
      try { localStorage.removeItem(`exam_draft_${activeAttempt.id}`); } catch { /* ignore */ }
      setActiveQuiz(null);
      setActiveAttempt(null);
      fetchAttempts();
    } catch (err: any) {
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setSelectedAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      scheduleAutoSave(next);
      return next;
    });
    if (submitError) { setSubmitError(null); setSkippedCount(0); }
    if (showSubmitConfirm) setShowSubmitConfirm(false);
  };

  const scheduleAutoSave = (answers: Record<string, string>) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("saving");
    autoSaveTimerRef.current = setTimeout(() => {
      if (activeAttempt) {
        try {
          localStorage.setItem(`exam_draft_${activeAttempt.id}`, JSON.stringify(answers));
        } catch {
          // storage unavailable — silently ignore
        }
      }
      setAutoSaveStatus("saved");
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 2500);
    }, 600);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  /* ─── EXAM RESULT SCREEN ─── */
  if (examResult) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d] font-sans">
        <motion.div
          id="summary-screen"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl w-full"
        >
          <div className="glass-card rounded-3xl overflow-hidden">
            {/* Banner */}
            <div
              className="relative overflow-hidden px-8 py-10 text-center"
              style={{ background: "linear-gradient(135deg, #064e3b, #047857)" }}
            >
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.22) 0%, transparent 55%)" }} />
              <div className="relative">
                <div className="inline-flex p-3 bg-white/15 rounded-2xl mb-4 border border-white/20">
                  {examResult.timedOut ? (
                    <AlertTriangle className="h-8 w-8 text-amber-300" />
                  ) : (
                    <CheckCircle className="h-8 w-8 text-emerald-300" />
                  )}
                </div>
                <h2 className="text-xl font-bold tracking-tight font-display text-white">{examResult.title}</h2>
                <p className="text-white/55 text-[10px] mt-1 font-mono tracking-widest uppercase">University Secure Assessment Result</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Score */}
              <div className="flex flex-col items-center justify-center py-7 bg-gradient-to-br from-emerald-50/80 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Your Secure Grade</span>
                <span className="text-6xl font-black text-slate-900 dark:text-white tracking-tight mt-1 font-display tabular-nums">
                  {examResult.score.toFixed(1)}%
                </span>
                <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mt-3">
                  {examResult.score >= 50 ? "✅ Academic Pass" : "❌ Re-assessment required"}
                </span>
              </div>

              {examResult.timedOut && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-400 text-[12.5px] rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Auto-Submitted / Timed Out</span>
                    This quiz exceeded the allocated duration limit. The examination session was securely finalized and locked by the server.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Question & Response Audit</h3>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {examResult.questions.map((q, idx) => {
                    const studentAns = examResult.answers[q.id];
                    const options: string[] = JSON.parse(q.optionsJson);
                    return (
                      <div key={q.id} className="p-4 bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] rounded-xl space-y-2">
                        <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
                          {idx + 1}. {q.text}
                        </p>
                        <div className="space-y-1 pl-2">
                          {options.map((opt) => (
                            <div
                              key={opt}
                              className={`text-[11.5px] px-3 py-1.5 rounded-lg flex items-center justify-between ${
                                studentAns === opt
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 font-semibold text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30"
                                  : "text-slate-500 dark:text-slate-500"
                              }`}
                            >
                              <span>{opt}</span>
                              {studentAns === opt && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Your pick</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                id="return-dashboard-btn"
                onClick={() => setExamResult(null)}
                className="btn-gradient"
              >
                Return to Student Portal
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ─── ACTIVE EXAM ENGINE ─── */
  if (activeQuiz && activeAttempt) {
    const isUnderOneMinute = remainingSeconds <= 60;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Exam top bar */}
        <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-lg uppercase tracking-widest font-bold">
              {selectedCourse?.code || "EXAM"}
            </span>
            <h1 className="text-sm font-bold tracking-tight font-display text-white hidden sm:block">{activeQuiz.title}</h1>
          </div>

          <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
            isUnderOneMinute ? "bg-red-950/50 border-red-800/50" : "bg-slate-800/80 border-slate-700/50"
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${isUnderOneMinute ? "text-red-400 animate-pulse" : "text-slate-400"}`} />
              <span className={`font-mono text-base font-bold tracking-wider tabular-nums ${isUnderOneMinute ? "text-red-400" : "text-white"}`}>
                {formatTime(remainingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-red-500"
              }`} />
              {syncStatus === "syncing" ? "Sync" : "Secure"}
            </div>
            {autoSaveStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 border-l border-slate-700/50 pl-3 text-[9px] font-mono uppercase tracking-wider transition-all ${
                autoSaveStatus === "saving" ? "text-amber-400" : "text-emerald-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${autoSaveStatus === "saving" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                {autoSaveStatus === "saving" ? "Saving…" : "Saved"}
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
          {submitError && (
            <div className="mb-6 bg-red-950/40 border border-red-800/50 text-red-300 rounded-xl p-4 flex gap-3 text-[12.5px]">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{submitError}</div>
            </div>
          )}

          <div className="space-y-4">
            {quizQuestions.map((q, qIdx) => {
              const options: string[] = JSON.parse(q.optionsJson);
              const isAnswered = selectedAnswers[q.id] !== undefined;
              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl border transition-all duration-200 ${
                    isAnswered ? "bg-slate-900 border-slate-700" : "bg-slate-900/50 border-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex items-center justify-center h-7 w-7 rounded-xl bg-slate-800 text-[11px] font-mono font-bold text-slate-400 shrink-0 mt-0.5 border border-slate-700 tabular-nums">
                      {qIdx + 1}
                    </span>
                    <div className="space-y-3.5 w-full">
                      <h3 className="text-[13.5px] font-semibold text-slate-100 leading-relaxed">{q.text}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {options.map((opt) => {
                          const isSelected = selectedAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleSelectOption(q.id, opt)}
                              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left text-[12.5px] font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-900/40 border-emerald-600/60 text-white"
                                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-600 hover:text-slate-200"
                              }`}
                            >
                              <span className={`flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? "border-emerald-400 bg-emerald-600" : "border-slate-600"
                              }`}>
                                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-6 py-4 space-y-3">
          {/* Submit confirm prompt */}
          {showSubmitConfirm && !isSubmitting && (
            <div className="flex items-center justify-between gap-3 bg-amber-950/40 border border-amber-700/40 rounded-xl px-4 py-3">
              <p className="text-[12px] text-amber-300 font-semibold">Finalize and lock your answers? This cannot be undone.</p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-3 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleManualSubmit(false)}
                  className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition cursor-pointer"
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          )}
          {/* Skipped-questions warning */}
          {submitError && skippedCount > 0 && (
            <div className="flex items-center justify-between gap-3 bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-[12px] text-red-300 font-semibold">{submitError}</p>
              </div>
              <button
                onClick={() => handleManualSubmit(true)}
                className="px-3 py-1.5 text-[11px] font-semibold bg-red-800 hover:bg-red-700 text-white rounded-lg transition cursor-pointer flex-shrink-0"
              >
                Submit Anyway
              </button>
            </div>
          )}
          {submitError && skippedCount === 0 && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3">
              <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-[12px] text-red-300 font-semibold">{submitError}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-500 font-mono uppercase tracking-wider">
              <span className="text-slate-300 font-bold">{Object.keys(selectedAnswers).length}</span> / {quizQuestions.length} answered
            </div>
            <button
              id="manual-submit-quiz-btn"
              onClick={() => handleManualSubmit()}
              disabled={isSubmitting}
              className="btn-gradient"
              style={{ width: "auto", paddingLeft: "24px", paddingRight: "24px" }}
            >
              {isSubmitting ? "Scoring..." : "Submit Exam"}
            </button>
          </div>
        </div>

        {/* Exam expired modal */}
        <AnimatePresence>
          {showExamExpiredModal && (
            <motion.div
              id="exam-expired-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: "rgba(2,2,12,0.88)", backdropFilter: "blur(16px)" }}
            >
              <motion.div
                initial={{ scale: 0.90, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.90, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="max-w-sm w-full bg-slate-900 border border-slate-800/60 rounded-[24px] p-8 text-center space-y-5 text-white"
              >
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-amber-950/40 border border-amber-800/40 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-white font-display">Time's Up</h3>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mt-0.5">FUTO Academic Integrity Gate</p>
                </div>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  Your examination duration has ended. Answers are being securely locked and transmitted.
                </p>

                <div className="bg-slate-950/60 border border-slate-800/50 rounded-[14px] p-4 space-y-2.5">
                  {isBackgroundSubmitting ? (
                    <div className="flex items-center justify-center gap-2 text-[12px] text-amber-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                      Syncing with server...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-[12px] text-emerald-400 font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      Answers saved!
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Auto-advancing</span>
                      <span>{examExpiredCountdown}s</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 5, ease: "linear" }}
                        className="h-full rounded-full bg-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="exam-expired-proceed-btn"
                  type="button"
                  disabled={isBackgroundSubmitting || !pendingExamResult}
                  onClick={handleProceedToResults}
                  className="btn-gradient disabled:opacity-40"
                >
                  View Score Card
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ─── MAIN DASHBOARD ─── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#010e07]/90 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="QuizOS" className="h-8 w-auto select-none" />
            <div className="hidden sm:block">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white font-display tracking-tight">QuizOS</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono ml-1.5">Student Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:block text-right mr-1">
              <p className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">{user.fullName}</p>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">{user.regNumber}</span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <select
                  value={currentYear}
                  onChange={(e) => handlePromoteYear(e.target.value)}
                  className="text-[9px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.5 border border-emerald-100 dark:border-emerald-900/40 rounded-md outline-none cursor-pointer"
                  title="Change academic year"
                >
                  {["Year 1","Year 2","Year 3","Year 4","Year 5","Extra Year","Postgraduate"].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="group relative flex-shrink-0 cursor-pointer"
              title="Update profile photo"
            >
              <UserAvatar
                userId={user.id}
                role="student"
                size={34}
                initials={user.fullName}
                refreshTrigger={avatarRefreshTrigger}
                className="ring-2 ring-white dark:ring-slate-800 group-hover:ring-emerald-200 dark:group-hover:ring-emerald-800 transition-all rounded-full"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </button>

            <button
              id="theme-toggle-student-btn"
              onClick={onToggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              {theme === "light" ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
            </button>

            <button
              id="student-logout-btn"
              onClick={onLogout}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6">

        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">Academic Courses</p>
            <div className="space-y-1">
              {loading ? (
                <div className="space-y-2 animate-pulse" id="courses-skeleton">
                  {[1,2,3].map((i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] space-y-1.5">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-14" />
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-md w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                courses.map((c) => {
                  const isSelected = selectedCourse?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { fetchCourseDetail(c.id); setSelectedNote(null); setNotesFilterCourseId(c.id); }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-[12px] transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white border border-transparent"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className={`block font-mono text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>{c.code}</span>
                        <span className="block text-[11px] mt-0.5 leading-tight truncate">{c.title}</span>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ml-2 ${isSelected ? "text-emerald-600 translate-x-0.5" : "opacity-20"}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Content */}
        <section className="lg:col-span-9 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-slate-100/80 dark:bg-white/[0.04] rounded-xl p-1 border border-slate-200/60 dark:border-white/[0.05]">
            {[
              { id: "notes",          icon: FileText, label: "Lecture Materials", live: false },
              { id: "quizzes",        icon: Award,    label: "Quizzes",            live: false },
              { id: "live-classroom", icon: Radio,    label: "Virtual Classroom",  live: true },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id as any;
              return (
                <button
                  key={tab.id}
                  id={`${tab.id === "notes" ? "notes" : tab.id === "quizzes" ? "quizzes" : "live"}-tab`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-[10px] transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-white/[0.10] text-slate-800 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/[0.08]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.live ? (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  ) : (
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content panel */}
          <div className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm">

            {/* NOTES VIEW */}
            {activeTab === "notes" && (
              <div id="notes-view-container" className="space-y-5">
                {!selectedNote ? (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Lecture Materials</h2>
                        <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Browse and study uploaded lecture notes.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <select
                          id="notes-course-filter"
                          value={notesFilterCourseId}
                          onChange={(e) => setNotesFilterCourseId(e.target.value)}
                          className="form-input"
                          style={{ width: "auto" }}
                        >
                          <option value="">All Courses</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                        </select>
                      </div>
                    </div>

                    {loading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse" id="notes-skeleton">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className="p-5 border border-slate-200/60 dark:border-white/[0.05] rounded-xl space-y-3">
                            <div className="flex justify-between">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-14" />
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-20" />
                            </div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/2" />
                            <div className="h-px bg-slate-100 dark:bg-slate-800" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-24" />
                          </div>
                        ))}
                      </div>
                    ) : allNotes.filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allNotes.filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId).map((note) => {
                          const noteCourse = courses.find((c) => c.id === note.courseId) || note.course;
                          return (
                            <div key={note.id} className="group p-5 border border-slate-200/60 dark:border-white/[0.06] hover:border-emerald-200 dark:hover:border-emerald-800/40 rounded-xl transition-all duration-200 flex flex-col justify-between bg-white dark:bg-white/[0.02] hover:shadow-md dark:hover:shadow-none">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-md">
                                    {noteCourse?.code || "COURSE"}
                                  </span>
                                  <span className="flex items-center gap-1 text-[9.5px] font-mono text-slate-400 dark:text-slate-500">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                                <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white leading-snug">{note.title}</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{noteCourse?.title || "Academic Resource"}</p>
                              </div>
                              <button
                                onClick={() => setSelectedNote(note)}
                                className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer w-full text-left transition-colors"
                              >
                                Open Lecture Note
                                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                        <FileText className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">No lecture materials found.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div id="note-reader" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-4">
                      <div>
                        <button onClick={() => setSelectedNote(null)} className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 mb-1.5 inline-flex items-center gap-1 cursor-pointer">
                          ← Back to Materials
                        </button>
                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">{selectedNote.title}</h2>
                      </div>
                      <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1 flex-shrink-0 ml-4">
                        <Calendar className="h-3 w-3" />
                        {new Date(selectedNote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                    <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] rounded-xl p-5">
                      <MarkdownView content={selectedNote.content} />
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* QUIZZES VIEW */}
            {activeTab === "quizzes" && (
              <div id="quizzes-view-container" className="space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Academic Quizzes</h2>
                  <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Secure timed assessments for your enrolled courses.</p>
                </div>

                {submitError && !activeQuiz && (
                  <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-xl p-3.5 text-[12.5px]">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span className="font-semibold">{submitError}</span>
                    <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400 hover:text-red-600 text-[11px] font-bold cursor-pointer">✕</button>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3 animate-pulse" id="quizzes-skeleton">
                    {[1,2,3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
                        <div className="space-y-2 w-1/2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-40" />
                          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-32" />
                        </div>
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-24" />
                      </div>
                    ))}
                  </div>
                ) : quizzes && quizzes.length > 0 ? (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => {
                      const attempt = attempts[quiz.id];
                      const isCompleted = attempt?.isCompleted;
                      return (
                        <div key={quiz.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 dark:border-white/[0.06] hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-all bg-white dark:bg-white/[0.02]">
                          <div className="space-y-1 min-w-0">
                            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{quiz.title}</h4>
                            <div className="flex items-center gap-3 text-[10.5px] text-slate-400 dark:text-slate-500 font-mono">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {quiz.durationMinutes} min</span>
                              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {quiz._count?.questions || 0} questions</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            {isCompleted ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                  Score: {attempt.score?.toFixed(1)}%
                                </span>
                                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono mt-1 text-right">
                                  {new Date(attempt.submittedAt!).toLocaleDateString()}
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartExam(quiz)}
                                className="btn-gradient flex items-center gap-1.5"
                                style={{ width: "auto", padding: "8px 16px", fontSize: "12px" }}
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Start Exam
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                    <Award className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">No exams scheduled for this course.</p>
                  </div>
                )}
              </div>
            )}

            {/* LIVE CLASSROOM VIEW */}
            {activeTab === "live-classroom" && (
              <div id="live-classroom-view-container" className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                      <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                      Live Educational Broadcast
                    </h2>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {selectedCourse ? `${selectedCourse.code} · ${selectedCourse.title}` : "Select a Course"}
                    </p>
                  </div>
                  {activeLiveSession ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider border border-red-100 dark:border-red-900/30 rounded-full">
                      <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping" />
                      Live
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-white/[0.06] rounded-full">
                      Offline
                    </span>
                  )}
                </div>

                {!activeLiveSession ? (
                  <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                    <Radio className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <h4 className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">No Active Live Lecture</h4>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
                      When a live lecture starts, slides and chat will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Slide panel */}
                    <div className="lg:col-span-7">
                      <div className="bg-slate-950 rounded-xl border border-slate-800/60 p-5 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5 mb-4">
                          <span className="text-[9.5px] font-mono text-slate-500 uppercase tracking-widest font-bold">Live Slide</span>
                          <span className="flex items-center gap-1.5 text-[9.5px] font-mono text-emerald-500 font-bold">
                            <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                            Synced
                          </span>
                        </div>
                        <h3 className="text-[13px] font-bold text-white mb-3">{activeLiveSession.topic}</h3>
                        <div className="text-[12px] text-slate-300 flex-1 leading-relaxed">
                          <MarkdownView content={activeLiveSession.content} />
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[9px] font-mono text-slate-600">
                          <span>{selectedCourse?.code || "Live"}</span>
                          <span>Started {new Date(activeLiveSession.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat panel */}
                    <div className="lg:col-span-5 border border-slate-200/60 dark:border-white/[0.06] rounded-xl overflow-hidden flex flex-col h-[380px] bg-white dark:bg-white/[0.02]">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/80 dark:bg-white/[0.03]">
                        <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">Live Study Chat</span>
                        <span className="text-[9px] font-mono bg-slate-100 dark:bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded-md font-bold">{liveChats.length}</span>
                      </div>
                      <div className="flex-1 p-3 overflow-y-auto space-y-3">
                        {liveChats.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-slate-400 dark:text-slate-600 text-[11px] font-medium">
                            Start the discussion!
                          </div>
                        ) : (
                          liveChats.map((chat) => {
                            const isMe = chat.studentId === user.id || chat.senderId === user.id;
                            const isStaff = chat.senderRole === "lecturer" || !!chat.lecturerName;
                            const displayName = chat.senderName || chat.studentName || chat.lecturerName || (isMe ? "You" : "Student");
                            const senderId = chat.senderId || chat.studentId || chat.lecturerId || "";
                            return (
                              <div key={chat.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                                <UserAvatar userId={senderId} role={isStaff ? "lecturer" : "student"} size={26} initials={displayName} className="shrink-0" />
                                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                  <span className={`text-[9px] font-bold font-mono uppercase tracking-wide ${isStaff ? "text-amber-600 dark:text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>
                                    {displayName}{isStaff && " · Staff"}
                                  </span>
                                  <div className={`px-3 py-2 rounded-2xl leading-relaxed break-words text-[12px] ${
                                    isMe
                                      ? "bg-emerald-700 text-white rounded-br-md"
                                      : isStaff
                                        ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-slate-800 dark:text-slate-200 rounded-bl-md"
                                        : "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 rounded-bl-md"
                                  }`}>
                                    {chat.message}
                                  </div>
                                  <span className="text-[8.5px] text-slate-400 dark:text-slate-600 font-mono">
                                    {new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <form onSubmit={handleSendChatMessage} className="p-2.5 border-t border-slate-100 dark:border-white/[0.06] flex gap-2 bg-white dark:bg-[#011a0d]">
                        <input
                          type="text"
                          required
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07] rounded-xl text-[12.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat}
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 text-white" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </section>

      </main>

      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        token={token}
        role="student"
        userId={user.id}
        userName={user.fullName}
        onAvatarUpdated={() => setAvatarRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
