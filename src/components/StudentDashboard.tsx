import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Award, LogOut, FileText, ChevronRight, Play, Clock, AlertTriangle, CheckCircle, ShieldAlert, Send, Radio, Filter, Calendar, Sun, Moon, Camera, Upload, Loader2, ThumbsUp, ArrowLeft, Mic, Layers, BarChart2, MessageSquare, Users, X } from "lucide-react";
import { Course, LectureNote, Quiz, StudentAttempt, Question } from "../types";
import MarkdownView from "./MarkdownView";
import UserAvatar from "./UserAvatar";
import AvatarModal from "./AvatarModal";
import { motion, AnimatePresence } from "motion/react";

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
  const [activeTab, setActiveTab] = useState<"notes" | "quizzes" | "live-classroom" | "exams">("notes");
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

  // Live classroom sub-features
  const [liveStudentTab, setLiveStudentTab] = useState<"jitsi" | "slides" | "poll" | "chat">("jitsi");
  const [handRaised, setHandRaised] = useState(false);
  const [myPollAnswer, setMyPollAnswer] = useState<string | null>(null);

  // Exam state
  const [exams, setExams] = useState<any[]>([]);
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [mySubmission, setMySubmission] = useState<any | null>(null);
  const [examAnswers, setExamAnswers] = useState("");
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  const fetchActiveLiveSession = async () => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/lectures/active/${selectedCourse.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveLiveSession(data);
        if (data && data.chats) setLiveChats(data.chats);
        else setLiveChats([]);
        if (data?.id) {
          fetch(`/api/lectures/${data.id}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Error fetching live lecture session:", e);
    }
  };

  const handleToggleHandRaise = async () => {
    if (!activeLiveSession) return;
    const res = await fetch(`/api/lectures/${activeLiveSession.id}/hand-raise`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setHandRaised(d.raised);
    }
  };

  const handlePollRespond = async (pollId: string, answer: string) => {
    if (!activeLiveSession) return;
    setMyPollAnswer(answer);
    await fetch(`/api/lectures/${activeLiveSession.id}/poll/${pollId}/respond`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer }),
    });
  };

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/exams", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setExams(await res.json());
    } catch (e) { console.error("Error fetching exams:", e); }
  };

  const fetchMySubmission = async (examId: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}/my-submission`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMySubmission(await res.json());
    } catch (e) { console.error("Error fetching my submission:", e); }
  };

  const handleExamSubmit = async () => {
    if (!examAnswers.trim()) { setExamError("Please write your answers before submitting."); return; }
    if (!activeExam) return;
    setIsSubmittingExam(true);
    setExamError(null);
    try {
      const res = await fetch(`/api/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answersText: examAnswers }),
      });
      const d = await res.json();
      if (res.ok) {
        setMySubmission(d);
        setExamAnswers("");
      } else {
        setExamError(d.error || "Submission failed");
      }
    } catch (e: any) {
      setExamError(e.message);
    } finally {
      setIsSubmittingExam(false);
    }
  };

  useEffect(() => {
    if (activeTab === "exams") fetchExams();
  }, [activeTab]);

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
        score: data.attempt?.score ?? data.score ?? 0,
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
      <div className="min-h-screen relative bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-[#010e07] dark:via-[#011208] dark:to-[#021a0d] font-sans">
        <div className="fixed inset-0 pointer-events-none dark:opacity-0"
          style={{background: "radial-gradient(ellipse 80% 65% at 50% 38%, rgba(167,243,208,0.30) 0%, transparent 70%)"}} />
        <div className="fixed inset-0 pointer-events-none opacity-0 dark:opacity-100"
          style={{background: "radial-gradient(ellipse 80% 65% at 50% 38%, rgba(4,120,87,0.16) 0%, transparent 70%)"}} />
        <div className="fixed inset-0 pointer-events-none opacity-[0.022] dark:opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
          }} />
        <div className="relative z-10 flex items-center justify-center py-12 px-4 min-h-screen">
        <motion.div
          id="summary-screen"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl w-full"
        >
          <div className="glass-card rounded-3xl overflow-hidden">
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
                <p className="text-white/55 text-[12px] mt-1 font-mono tracking-widest uppercase">University Secure Assessment Result</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center justify-center py-7 bg-gradient-to-br from-emerald-50/80 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Your Secure Grade</span>
                <span className="text-6xl font-black text-slate-900 dark:text-white tracking-tight mt-1 font-display tabular-nums">
                  {examResult.score.toFixed(1)}%
                </span>
                <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mt-3">
                  {examResult.score >= 50 ? "Academic Pass" : "Re-assessment required"}
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
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Question & Response Audit</h3>
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
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Your pick</span>
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
      </div>
    );
  }

  /* ─── ACTIVE EXAM ENGINE ─── */
  if (activeQuiz && activeAttempt) {
    const isUnderOneMinute = remainingSeconds <= 60;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-lg uppercase tracking-widest font-bold">
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
            <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-red-500"
              }`} />
              {syncStatus === "syncing" ? "Sync" : "Secure"}
            </div>
            {autoSaveStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 border-l border-slate-700/50 pl-3 text-[11px] font-mono uppercase tracking-wider transition-all ${
                autoSaveStatus === "saving" ? "text-amber-400" : "text-emerald-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${autoSaveStatus === "saving" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                {autoSaveStatus === "saving" ? "Saving…" : "Saved"}
              </div>
            )}
          </div>
        </div>

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

        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-6 py-4 space-y-3">
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
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition cursor-pointer"
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          )}
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
                  <p className="text-[12px] font-mono font-bold uppercase tracking-widest text-slate-500 mt-0.5">FUTO Academic Integrity Gate</p>
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
                    <div className="flex justify-between text-[12px] font-mono text-slate-500">
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
    <div className="flex h-screen overflow-hidden apple-window-bg dark:bg-[#141416] font-sans relative">

      {/* Subtle radial bg gradients — barely visible, add depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", width: 800, height: 800, top: -200, right: -150, background: "radial-gradient(ellipse at center, rgba(10,148,99,0.055) 0%, transparent 62%)" }} />
        <div style={{ position: "absolute", width: 600, height: 600, bottom: -100, left: -100, background: "radial-gradient(ellipse at center, rgba(4,120,87,0.035) 0%, transparent 62%)" }} />
      </div>

      {/* ── LEFT SIDEBAR — desktop only ── */}
      <aside className="hidden sm:flex sm:w-[232px] flex-shrink-0 flex-col h-full apple-sidebar relative z-10">

        {/* Traffic lights */}
        <div className="flex items-center gap-[6px] px-4 pt-5 pb-3 flex-shrink-0">
          <span className="h-[13px] w-[13px] rounded-full bg-[#ff5f57] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)] flex-shrink-0" />
          <span className="h-[13px] w-[13px] rounded-full bg-[#ffbd2e] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)] flex-shrink-0 hidden sm:inline-block" />
          <span className="h-[13px] w-[13px] rounded-full bg-[#28c840] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)] flex-shrink-0 hidden sm:inline-block" />
        </div>

        {/* Logo */}
        <div className="hidden sm:flex items-center justify-center px-4 pb-4 flex-shrink-0">
          <img
            src="/logo-dark.png"
            alt="QuizOS"
            className="h-[56px] w-auto"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18)) brightness(0.96)" }}
          />
        </div>

        {/* Avatar */}
        <div className="px-3 pb-3 flex-shrink-0">
          <button
            onClick={() => setIsAvatarModalOpen(true)}
            className="group w-full flex items-center gap-3 p-2.5 rounded-[12px] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition cursor-pointer text-left"
            title="Update profile photo"
          >
            <div className="relative flex-shrink-0">
              <UserAvatar
                userId={user.id}
                role="student"
                size={34}
                initials={user.fullName}
                refreshTrigger={avatarRefreshTrigger}
                className="rounded-full ring-[1.5px] ring-black/10 dark:ring-white/15 shadow-sm"
              />
              <div className="absolute inset-0 bg-black/45 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="hidden sm:block min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-tight truncate">{user.fullName}</p>
              <p className="text-[11px] text-[#6e6e73] dark:text-white/38 font-mono truncate mt-0.5">{user.regNumber}</p>
            </div>
          </button>
        </div>

        {/* Nav + courses (scrollable) */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto min-h-0">

          {/* Main nav tabs */}
          {[
            { id: "notes",          icon: FileText, label: "Materials",  live: false },
            { id: "quizzes",        icon: Award,    label: "Quizzes",    live: false },
            { id: "exams",          icon: Upload,   label: "Exams",      live: false },
            { id: "live-classroom", icon: Radio,    label: "Live Class", live: true  },
          ].map((item) => {
            const isActive = activeTab === (item.id as typeof activeTab);
            return (
              <button
                key={item.id}
                id={`${item.id}-tab`}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500/[0.15] dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-400"
                    : "text-[#3a3a3c] dark:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-[#1d1d1f] dark:hover:text-white/85"
                }`}
              >
                {item.live && !isActive ? (
                  <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                ) : (
                  <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-emerald-500" : ""}`} strokeWidth={1.6} />
                )}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}

          {/* Courses header */}
          <div className="hidden sm:block pt-3 pb-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/30">Courses</p>
          </div>

          {/* Courses list */}
          {loading ? (
            <div className="hidden sm:block space-y-1 animate-pulse" id="courses-skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 apple-skeleton" />
              ))}
            </div>
          ) : (
            <div className="hidden sm:block space-y-0.5">
              {courses.map((c) => {
                const isSelected = selectedCourse?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { fetchCourseDetail(c.id); setSelectedNote(null); setNotesFilterCourseId(c.id); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-left transition-all ${
                      isSelected
                        ? "bg-emerald-500/[0.12] dark:bg-emerald-500/[0.10] text-emerald-700 dark:text-emerald-400"
                        : "text-[#3a3a3c] dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-[#1d1d1f] dark:hover:text-white/75"
                    }`}
                  >
                    <span className={`font-mono text-[10.5px] font-bold uppercase tracking-wide flex-shrink-0 w-[52px] truncate ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-[#6e6e73] dark:text-white/35"}`}>
                      {c.code}
                    </span>
                    <span className="text-[11px] font-medium truncate flex-1 leading-tight">{c.title}</span>
                    {isSelected && <ChevronRight className="h-3 w-3 flex-shrink-0 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Academic year selector */}
          <div className="hidden sm:block px-1 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/30 mb-1.5 px-2">Academic Year</p>
            <select
              value={currentYear}
              onChange={(e) => handlePromoteYear(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-[8px] text-[11.5px] bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.09] dark:border-white/[0.10] text-[#1d1d1f] dark:text-white/90 outline-none focus:border-emerald-500/60 transition cursor-pointer"
              title="Change academic year"
            >
              {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Extra Year", "Postgraduate"].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </nav>

        {/* Bottom: theme + logout */}
        <div className="flex-shrink-0 px-2 pb-4 pt-3 space-y-0.5 border-t border-black/[0.06] dark:border-white/[0.06]">
          <button
            id="theme-toggle-student-btn"
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-[#3a3a3c] dark:text-white/55 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition"
          >
            {theme === "dark"
              ? <Sun className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} />
              : <Moon className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} />
            }
            <span className="hidden sm:inline">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
          <button
            id="student-logout-btn"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-500/[0.08] transition"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">

        {/* Top toolbar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-[44px] border-b border-black/[0.05] dark:border-white/[0.04] backdrop-blur-xl"
          style={{ background: "rgba(240,240,245,0.82)", boxShadow: "0 1px 0 rgba(255,255,255,0.75)" }}>
          <h1 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white/88 tracking-[-0.01em]">
            {activeTab === "notes" ? "Lecture Materials"
              : activeTab === "quizzes" ? "Academic Quizzes"
              : activeTab === "exams" ? "Written Examinations"
              : "Virtual Classroom"}
          </h1>
          <div className="flex items-center gap-1">
            {selectedCourse && (
              <span className="hidden md:inline px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.07] text-[11px] font-mono font-bold text-[#6e6e73] dark:text-white/45 uppercase tracking-wider">
                {selectedCourse.code}
              </span>
            )}
            {/* Mobile-only: theme + logout */}
            <button
              onClick={onToggleTheme}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-[10px] text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.6} /> : <Moon className="h-4 w-4" strokeWidth={1.6} />}
            </button>
            <button
              onClick={onLogout}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-[10px] text-red-500 dark:text-red-400 hover:bg-red-500/[0.08] transition"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 pb-[96px] sm:pb-5 max-w-5xl mx-auto w-full space-y-5">

          {/* ── NOTES TAB ── */}
          {activeTab === "notes" && (
            <div id="notes-view-container">
              {!selectedNote ? (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="apple-title">Lecture Materials</h2>
                      <p className="apple-subtitle">Browse and study uploaded lecture notes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 text-[#6e6e73] dark:text-white/40 flex-shrink-0" />
                      <select
                        id="notes-course-filter"
                        value={notesFilterCourseId}
                        onChange={(e) => setNotesFilterCourseId(e.target.value)}
                        className="form-input"
                        style={{ width: "auto" }}
                      >
                        <option value="">All Courses</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-5">
                    {loading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse" id="notes-skeleton">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="p-5 border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] space-y-3">
                            <div className="flex justify-between">
                              <div className="h-4 bg-black/[0.06] dark:bg-white/[0.06] rounded-lg w-14" />
                              <div className="h-3 bg-black/[0.06] dark:bg-white/[0.06] rounded-lg w-20" />
                            </div>
                            <div className="h-4 bg-black/[0.06] dark:bg-white/[0.06] rounded-lg w-3/4" />
                            <div className="h-3 bg-black/[0.06] dark:bg-white/[0.06] rounded-lg w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : allNotes.filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allNotes.filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId).map((note) => {
                          const noteCourse = courses.find((c) => c.id === note.courseId) || note.course;
                          return (
                            <div key={note.id} className="group p-5 border border-black/[0.07] dark:border-white/[0.07] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 rounded-[12px] transition-all duration-200 flex flex-col justify-between bg-black/[0.01] dark:bg-white/[0.02] hover:shadow-md">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                    {noteCourse?.code || "COURSE"}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] font-mono text-[#6e6e73] dark:text-white/35">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                                <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-snug">{note.title}</h4>
                                <p className="text-[11px] text-[#6e6e73] dark:text-white/45 leading-relaxed line-clamp-2">{noteCourse?.title || "Academic Resource"}</p>
                              </div>
                              <button
                                onClick={() => setSelectedNote(note)}
                                className="mt-4 pt-3.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer w-full text-left transition-colors"
                              >
                                Open Lecture Note
                                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="apple-empty-state">
                        <div className="apple-empty-state__icon">
                          <FileText className="h-6 w-6 text-[#8e8e93] dark:text-white/30" />
                        </div>
                        <p className="apple-empty-state__title">No lecture materials</p>
                        <p className="apple-empty-state__body">Lecture notes uploaded by your lecturers will appear here automatically.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div id="note-reader" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="apple-card">
                  <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-start justify-between gap-4">
                    <div>
                      <button onClick={() => setSelectedNote(null)} className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 mb-1.5 inline-flex items-center gap-1 cursor-pointer">
                        <ArrowLeft className="h-3 w-3" /> Back to Materials
                      </button>
                      <h2 className="apple-title">{selectedNote.title}</h2>
                    </div>
                    <span className="text-[11px] font-mono text-[#6e6e73] dark:text-white/35 flex items-center gap-1 flex-shrink-0 mt-6">
                      <Calendar className="h-3 w-3" />
                      {new Date(selectedNote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-5">
                      <MarkdownView content={selectedNote.content} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ── QUIZZES TAB ── */}
          {activeTab === "quizzes" && (
            <div id="quizzes-view-container">
              <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="apple-title">Academic Quizzes</h2>
                  <p className="apple-subtitle">Secure timed assessments for your enrolled courses.</p>
                </div>
                <div className="p-5 space-y-4">
                  {submitError && !activeQuiz && (
                    <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-[10px] p-3.5 text-[12.5px]">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="font-semibold">{submitError}</span>
                      <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}

                  {loading ? (
                    <div className="space-y-3 animate-pulse" id="quizzes-skeleton">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-[12px] border border-black/[0.06] dark:border-white/[0.06]">
                          <div className="space-y-2 w-1/2">
                            <div className="h-4 bg-black/[0.06] dark:bg-white/[0.06] rounded-lg w-40" />
                            <div className="h-3 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg w-32" />
                          </div>
                          <div className="h-8 bg-black/[0.06] dark:bg-white/[0.06] rounded-[10px] w-24" />
                        </div>
                      ))}
                    </div>
                  ) : quizzes && quizzes.length > 0 ? (
                    <div className="space-y-3">
                      {quizzes.map((quiz) => {
                        const attempt = attempts[quiz.id];
                        const isCompleted = attempt?.isCompleted;
                        return (
                          <div key={quiz.id} className="flex items-center justify-between p-4 rounded-[12px] border border-black/[0.07] dark:border-white/[0.07] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 bg-black/[0.01] dark:bg-white/[0.02] hover:shadow-sm transition-all duration-200">
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{quiz.title}</h4>
                              <div className="flex items-center gap-3 text-[10.5px] text-[#6e6e73] dark:text-white/40 font-mono">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {quiz.durationMinutes} min</span>
                                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {quiz._count?.questions || 0} questions</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              {isCompleted ? (
                                <div className="text-right">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                    Score: {attempt.score?.toFixed(1)}%
                                  </span>
                                  <p className="text-[11px] text-[#6e6e73] dark:text-white/35 font-mono mt-1 text-right">
                                    {new Date(attempt.submittedAt!).toLocaleDateString()}
                                  </p>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartExam(quiz)}
                                  className="px-4 py-2.5 rounded-[10px] bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition shadow-sm flex items-center gap-1.5"
                                >
                                  <Play className="h-3 w-3 fill-current" />
                                  Start
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="apple-empty-state">
                      <div className="apple-empty-state__icon">
                        <Award className="h-6 w-6 text-[#8e8e93] dark:text-white/30" />
                      </div>
                      <p className="apple-empty-state__title">No quizzes available</p>
                      <p className="apple-empty-state__body">Quizzes assigned by your lecturers will appear here when activated.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* ── LIVE CLASSROOM TAB ── */}
          {activeTab === "live-classroom" && (
            <div id="live-classroom-view-container">
              <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white/90 flex items-center gap-2">
                      <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                      Virtual Classroom
                    </h2>
                    <p className="apple-subtitle">
                      {selectedCourse ? `${selectedCourse.code} · ${selectedCourse.title}` : "Select a Course"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeLiveSession && (
                      <button
                        onClick={handleToggleHandRaise}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] border transition-colors ${handRaised ? "bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400" : "border-black/[0.09] dark:border-white/[0.10] text-[#3a3a3c] dark:text-white/60 hover:border-amber-300"}`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {handRaised ? "Hand Raised" : "Raise Hand"}
                      </button>
                    )}
                    {activeLiveSession ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-[12px] font-bold uppercase tracking-wider border border-red-100 dark:border-red-900/30 rounded-full">
                        <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping" />
                        Live
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 text-[12px] font-bold uppercase tracking-wider border border-black/[0.07] dark:border-white/[0.07] rounded-full">Offline</span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {!activeLiveSession ? (
                    <div className="py-16 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                      <Radio className="h-8 w-8 text-black/20 dark:text-white/20 mx-auto mb-3" />
                      <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/70">No Active Live Lecture</h4>
                      <p className="text-[12px] text-[#6e6e73] dark:text-white/40 max-w-sm mx-auto mt-1.5 leading-relaxed">When a live lecture starts, everything will appear here automatically.</p>
                    </div>
                  ) : (() => {
                    const slides = activeLiveSession.content.split(/^---$/m).map((s: string) => s.trim()).filter(Boolean);
                    const currentSlide = activeLiveSession.currentSlide ?? 0;
                    const slide = slides[Math.min(currentSlide, slides.length - 1)] ?? activeLiveSession.content;
                    const activePoll: any = (activeLiveSession.polls ?? [])[0] ?? null;

                    return (
                      <div className="space-y-3">
                        {activeLiveSession.attachmentName && activeLiveSession.attachmentData && (
                          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-[12px]">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/85">Shared File: {activeLiveSession.attachmentName}</span>
                            </div>
                            <a href={activeLiveSession.attachmentData} download={activeLiveSession.attachmentName}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-[8px] transition">Download</a>
                          </div>
                        )}

                        {/* Sub-tabs */}
                        <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-[12px] p-1 border border-black/[0.06] dark:border-white/[0.05] overflow-x-auto">
                          {([
                            { id: "jitsi",  icon: Mic,           label: "Audio/Video" },
                            { id: "slides", icon: Layers,        label: `Slides${slides.length > 1 ? ` (${Math.min(currentSlide, slides.length - 1) + 1}/${slides.length})` : ""}` },
                            { id: "poll",   icon: BarChart2,     label: `Poll${activePoll ? " •" : ""}` },
                            { id: "chat",   icon: MessageSquare, label: `Chat (${liveChats.length})` },
                          ] as { id: "jitsi" | "slides" | "poll" | "chat"; icon: React.ElementType; label: string }[]).map(tab => (
                            <button key={tab.id} onClick={() => setLiveStudentTab(tab.id)}
                              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 ${liveStudentTab === tab.id ? "bg-[#ffffff] dark:bg-white/[0.10] text-[#1d1d1f] dark:text-white/90 shadow-sm border border-black/[0.07] dark:border-white/[0.08]" : "text-[#6e6e73] dark:text-white/50 hover:text-[#1d1d1f] dark:hover:text-white/75"}`}>
                              <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {/* Jitsi */}
                        {liveStudentTab === "jitsi" && (
                          <div className="rounded-[12px] overflow-hidden border border-black/[0.07] dark:border-white/[0.07]" style={{ height: 420 }}>
                            <iframe
                              src={`https://meet.jit.si/${activeLiveSession.jitsiRoom ?? activeLiveSession.id}#userInfo.displayName=${encodeURIComponent(user.fullName)}&config.prejoinPageEnabled=false`}
                              allow="camera; microphone; fullscreen; display-capture; autoplay"
                              className="w-full h-full border-0"
                              title="Jitsi Meet"
                            />
                          </div>
                        )}

                        {/* Slides */}
                        {liveStudentTab === "slides" && (
                          <div className="bg-slate-950 rounded-[12px] border border-slate-800/60 p-5 min-h-[280px] flex flex-col">
                            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5 mb-4">
                              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest font-bold">{activeLiveSession.topic}</span>
                              <div className="flex items-center gap-2">
                                {slides.length > 1 && <span className="text-[11px] font-mono text-slate-500">{Math.min(currentSlide, slides.length - 1) + 1}/{slides.length}</span>}
                                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-500 font-bold"><span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />Synced</span>
                              </div>
                            </div>
                            <div className="text-[13px] text-slate-200 flex-1 leading-relaxed">
                              <MarkdownView content={slide} />
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-600">
                              <span>{selectedCourse?.code}</span>
                              <span>Started {new Date(activeLiveSession.createdAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        )}

                        {/* Poll */}
                        {liveStudentTab === "poll" && (
                          <div>
                            {!activePoll ? (
                              <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                                <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No active poll right now. Check back soon.</p>
                              </div>
                            ) : (
                              <div className="bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-[12px] p-5 space-y-4">
                                <p className="apple-title">{activePoll.question}</p>
                                <div className="space-y-2">
                                  {(JSON.parse(activePoll.optionsJson) as string[]).map(opt => (
                                    <button key={opt} onClick={() => handlePollRespond(activePoll.id, opt)}
                                      className={`w-full text-left px-4 py-3 rounded-[10px] border text-[13px] font-semibold transition-all ${myPollAnswer === opt ? "bg-emerald-600 border-emerald-600 text-white" : "border-black/[0.08] dark:border-white/[0.09] text-[#1d1d1f] dark:text-white/80 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"}`}>
                                      {opt}
                                      {myPollAnswer === opt && <CheckCircle className="h-3.5 w-3.5 ml-1.5 inline-block" />}
                                    </button>
                                  ))}
                                </div>
                                {myPollAnswer && <p className="text-[12px] text-emerald-600 dark:text-emerald-400 text-center">Response recorded: <strong>{myPollAnswer}</strong></p>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Chat */}
                        {liveStudentTab === "chat" && (
                          <div className="border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] overflow-hidden flex flex-col h-[380px]">
                            <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-black/[0.01] dark:bg-white/[0.02]">
                              {liveChats.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-center text-[#6e6e73] dark:text-white/35 text-[11px] font-medium">Start the discussion!</div>
                              ) : liveChats.map((chat) => {
                                const isMe = chat.senderId === user.id;
                                const isStaff = chat.senderRole === "lecturer";
                                return (
                                  <div key={chat.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                                    <UserAvatar userId={chat.senderId} role={isStaff ? "lecturer" : "student"} size={26} initials={chat.senderName} className="shrink-0" />
                                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                      <span className={`text-[11px] font-bold font-mono uppercase tracking-wide ${isStaff ? "text-amber-600 dark:text-amber-500" : "text-[#6e6e73] dark:text-white/40"}`}>{chat.senderName}{isStaff && " · Staff"}</span>
                                      <div className={`px-3 py-2 rounded-2xl text-[12px] break-words ${isMe ? "bg-emerald-700 text-white rounded-br-md" : isStaff ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-slate-800 dark:text-slate-200 rounded-bl-md" : "bg-[#f0f0f0] dark:bg-white/[0.07] text-[#1d1d1f] dark:text-white/85 rounded-bl-md"}`}>{chat.message}</div>
                                      <span className="text-[8.5px] text-[#6e6e73] dark:text-white/30 font-mono">{new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              <div ref={chatEndRef} />
                            </div>
                            <form onSubmit={handleSendChatMessage} className="p-2.5 border-t border-black/[0.06] dark:border-white/[0.06] flex gap-2 bg-[#ffffff] dark:bg-[#1c1c1e]">
                              <input type="text" required value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Type a message..."
                                className="flex-1 px-3 py-2.5 bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.09] dark:border-white/[0.10] rounded-[10px] text-[12.5px] text-[#1d1d1f] dark:text-white/90 placeholder-[#6e6e73] dark:placeholder-white/30 outline-none focus:border-emerald-500/60 transition" />
                              <button type="submit" disabled={isSendingChat} className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition flex-shrink-0">
                                <Send className="h-3.5 w-3.5 text-white" />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </div>
          )}

          {/* ── EXAMS TAB ── */}
          {activeTab === "exams" && (
            <div className="space-y-5">
              {!activeExam ? (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h2 className="apple-title">Written Examinations</h2>
                    <p className="apple-subtitle">Read each question carefully and type your answers. The AI will grade your submission.</p>
                  </div>
                  <div className="p-5">
                    {exams.length === 0 ? (
                      <div className="apple-empty-state">
                        <div className="apple-empty-state__icon">
                          <Upload className="h-6 w-6 text-[#8e8e93] dark:text-white/30" />
                        </div>
                        <p className="apple-empty-state__title">No exams yet</p>
                        <p className="apple-empty-state__body">Written examinations will appear here when your lecturer activates them.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {exams.map(exam => (
                          <button key={exam.id} onClick={async () => { setActiveExam(exam); setMySubmission(null); await fetchMySubmission(exam.id); }}
                            className="w-full text-left p-4 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{exam.title}</p>
                              <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">{exam.course?.code} / {exam.course?.title}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${exam.isOpen ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30" : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"}`}>
                              {exam.isOpen ? "Open" : "Closed"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : mySubmission ? (
                <div className="apple-card">
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <button onClick={() => { setActiveExam(null); setMySubmission(null); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> Back to Exams</button>
                    <h2 className="apple-title">{activeExam.title}: Result</h2>
                  </div>
                  <div className="p-5 space-y-5">
                    {mySubmission.isGraded ? (
                      <div className="space-y-4">
                        <div className={`rounded-[12px] p-6 text-center border ${mySubmission.score >= 50 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30" : "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"}`}>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-1">Your Score</p>
                          <p className={`text-5xl font-black ${mySubmission.score >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{mySubmission.score?.toFixed(1)}%</p>
                          <p className={`text-[13px] font-semibold mt-2 ${mySubmission.score >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{mySubmission.score >= 50 ? "Passed" : "Failed"}</p>
                        </div>
                        {mySubmission.feedback && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">AI Feedback</p>
                            <p className="text-[13px] text-[#1d1d1f] dark:text-white/80 leading-relaxed bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4">{mySubmission.feedback}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Your Submitted Answers</p>
                          <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{mySubmission.answersText}</pre>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto mb-3" />
                        <p className="text-[13px] font-semibold text-[#3a3a3c] dark:text-white/70">Submitted: awaiting AI grading</p>
                        <p className="text-[12px] text-[#6e6e73] dark:text-white/40 mt-1">Your lecturer will trigger grading once all students have submitted.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="apple-card">
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <button onClick={() => { setActiveExam(null); setExamAnswers(""); setExamError(null); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> Back to Exams</button>
                    <h2 className="apple-title">{activeExam.title}</h2>
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">{activeExam.course?.code} · {activeExam.isOpen ? "Open for submission" : "Closed"}</p>
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Exam Questions</p>
                      <pre className="text-[13px] text-[#1d1d1f] dark:text-white/80 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{activeExam.questionsText}</pre>
                    </div>

                    {activeExam.isOpen ? (
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">Your Answers</p>
                        <textarea
                          rows={12}
                          value={examAnswers}
                          onChange={e => setExamAnswers(e.target.value)}
                          placeholder={"Type your answers here. For example:\n\n1. [Your answer to question 1]\n\n2. [Your answer to question 2]\n\netc."}
                          className="w-full px-3.5 py-2.5 rounded-[10px] text-[13.5px] bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.09] dark:border-white/[0.10] text-[#1d1d1f] dark:text-white/90 placeholder-[#6e6e73] dark:placeholder-white/30 outline-none focus:border-emerald-500/60 dark:focus:border-emerald-500/50 transition resize-none leading-relaxed"
                        />
                        {examError && <p className="text-[12px] text-red-500 font-medium">{examError}</p>}
                        <button onClick={handleExamSubmit} disabled={isSubmittingExam} className="btn-gradient disabled:opacity-60 flex items-center justify-center gap-2">
                          {isSubmittingExam ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit Answers"}
                        </button>
                        <p className="text-[11px] text-[#6e6e73] dark:text-white/40 text-center">Once submitted you cannot change your answers. The AI will grade your submission after the exam closes.</p>
                      </div>
                    ) : (
                      <div className="py-8 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                        <p className="text-[13px] font-semibold text-[#6e6e73] dark:text-white/50">This exam is closed for submissions.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          </div>{/* /max-w-5xl */}
        </main>
      </div>

      {/* ── MOBILE BOTTOM DOCK ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-5 pb-7 pt-2" aria-label="Main navigation">
        <div className="apple-bottom-dock flex items-center justify-around h-[60px] px-3">
          {([
            { id: "notes",          icon: FileText, label: "Materials"  },
            { id: "quizzes",        icon: Award,    label: "Quizzes"    },
            { id: "exams",          icon: Upload,   label: "Exams"      },
            { id: "live-classroom", icon: Radio,    label: "Live"       },
          ] as const).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center gap-[5px] min-w-[56px] min-h-[44px] px-2 rounded-[14px] transition-all"
                style={{ transform: isActive ? "scale(1.06)" : "scale(1)", transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                {item.id === "live-classroom" && !isActive ? (
                  <span className="relative flex items-center justify-center h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-60" />
                    <item.icon className="relative h-5 w-5 text-[#8e8e93]" strokeWidth={1.6} />
                  </span>
                ) : (
                  <item.icon
                    className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`}
                    strokeWidth={isActive ? 2.2 : 1.6}
                  />
                )}
                <span className={`text-[9.5px] font-semibold tracking-[0.01em] transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

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
