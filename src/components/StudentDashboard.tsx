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
  // Navigation State
  const [activeTab, setActiveTab] = useState<"notes" | "quizzes" | "live-classroom">("notes");
  const [currentYear, setCurrentYear] = useState(user.year);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<LectureNote | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Record<string, StudentAttempt>>({});
  const [loading, setLoading] = useState(false);

  // User Profile Avatar State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);

  // Live Classroom State
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
      interval = setInterval(fetchActiveLiveSession, 4000); // Poll every 4 seconds
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newYear }),
      });
      if (res.ok) {
        setCurrentYear(newYear);
      }
    } catch (err) {
      console.error("Error updating year:", err);
    }
  };

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<StudentAttempt | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Time Sync Countdown State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Completed Exam Results State (Summary Screen)
  const [examResult, setExamResult] = useState<{
    score: number;
    timedOut: boolean;
    answers: Record<string, string>;
    questions: Question[];
    title: string;
  } | null>(null);

  // Quiz/Exam Expiration Modal state
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

  // Lecture Materials Section States
  const [allNotes, setAllNotes] = useState<(LectureNote & { course?: { code: string; title: string } })[]>([]);
  const [notesFilterCourseId, setNotesFilterCourseId] = useState<string>("");

  // Fetch courses on mount
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
        if (data.length > 0) {
          fetchCourseDetail(data[0].id);
        }
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
        // Extract quizzes
        if (data.quizzes) {
          setQuizzes(data.quizzes);
        }
      }
    } catch (err) {
      console.error("Error fetching course detail:", err);
    }
  };

  const fetchAttempts = async () => {
    try {
      const res = await fetch("/api/lecturer/gradebook", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: StudentAttempt[] = await res.json();
        // Map of quizId -> StudentAttempt
        const studentAttempts = data.filter((a) => a.studentId === user.id);
        const attemptMap: Record<string, StudentAttempt> = {};
        studentAttempts.forEach((a) => {
          attemptMap[a.quizId] = a;
        });
        setAttempts(attemptMap);
      }
    } catch (err) {
      console.error("Error fetching student attempts:", err);
    }
  };

  // Start exam process
  const handleStartExam = async (quiz: Quiz) => {
    if (attempts[quiz.id]?.isCompleted) {
      alert("You have already completed this exam.");
      return;
    }

    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quizId: quiz.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start quiz session");
      }

      // Fetch quiz details (including its questions, with correctOptions secure!)
      const quizRes = await fetch(`/api/quizzes/${quiz.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const quizData = await quizRes.json();

      setActiveQuiz(quizData);
      setQuizQuestions(quizData.questions || []);
      setActiveAttempt(data.attempt);
      setSelectedAnswers({});
      setSubmitError(null);

      // Start Countdown and Timer Syncing
      const initialSeconds = quiz.durationMinutes * 60;
      setRemainingSeconds(initialSeconds);
      startTimerSystem(data.attempt.id, initialSeconds);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Timer Countdown and Anti-Tampering Server Synchronizer
  const startTimerSystem = (attemptId: string, initialSeconds: number) => {
    // Clear any previous timers
    stopTimerSystem();

    let currentSecs = initialSeconds;

    // 1. Local countdown ticking
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Trigger submission when count reaches 0
          clearInterval(countdownIntervalRef.current!);
          triggerQuizExpired(attemptId);
          return 0;
        }
        currentSecs = prev - 1;
        return prev - 1;
      });
    }, 1000);

    // 2. Fetch secure remaining time from server every 10 seconds (Anti-Tampering Sync)
    const syncTime = async () => {
      setSyncStatus("syncing");
      try {
        const res = await fetch(`/api/quiz/remaining-time/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const serverSeconds = data.remainingSeconds;

          // If server says time is up or quiz completed, submit immediately!
          if (serverSeconds <= 0 || data.isCompleted) {
            stopTimerSystem();
            triggerQuizExpired(attemptId);
            return;
          }

          // Anti-tampering check: If local clock differs significantly from server clock (> 5 seconds), sync it!
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

    // Run initial sync right away after 2 seconds, then every 10s
    setTimeout(syncTime, 2000);
    syncIntervalRef.current = setInterval(syncTime, 10000);
  };

  const stopTimerSystem = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  };

  // Trigger quiz time expired gracefully with modal notification
  const triggerQuizExpired = (attemptId: string) => {
    stopTimerSystem();
    setShowExamExpiredModal(true);
    setExamExpiredCountdown(5);
    setPendingExamResult(null);
    setIsBackgroundSubmitting(true);
    
    // Fire off secure background auto-submit
    handleAutoSubmitBackground(attemptId);
  };

  // Background secure submit
  const handleAutoSubmitBackground = async (attemptId: string) => {
    let currentAnswers: Record<string, string> = {};
    setSelectedAnswers((prev) => {
      currentAnswers = prev;
      return prev;
    });

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attemptId,
          answers: currentAnswers,
        }),
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
      // Fallback result structure
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

  // countdown effect for exam expired modal
  useEffect(() => {
    if (!showExamExpiredModal) return;
    const interval = setInterval(() => {
      setExamExpiredCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showExamExpiredModal]);

  // auto proceed effect
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

  // Manual student submission
  const handleManualSubmit = async () => {
    if (!activeAttempt) return;
    
    const confirmSubmit = window.confirm("Are you sure you want to finalize and submit your answers? This cannot be undone.");
    if (!confirmSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attemptId: activeAttempt.id,
          answers: selectedAnswers,
        }),
      });

      const data = await res.json();

      if (res.status === 408) {
        // Exceeded allowed time + grace period (Time out locked)
        alert("Submission rejected! You exceeded the duration limit including the 10s grace period. Your score was locked.");
        setExamResult({
          score: data.attempt?.score || 0,
          timedOut: true,
          answers: selectedAnswers,
          questions: quizQuestions,
          title: activeQuiz?.title || "Academic Assessment",
        });
      } else if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      } else {
        // Successful on-time submission
        setExamResult({
          score: data.score,
          timedOut: false,
          answers: selectedAnswers,
          questions: quizQuestions,
          title: activeQuiz?.title || "Academic Assessment",
        });
      }

      // Cleanup
      stopTimerSystem();
      setActiveQuiz(null);
      setActiveAttempt(null);
      fetchAttempts();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  // Helper to format remaining seconds as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  // Render Section: EXAM SUMMARY SCREEN
  if (examResult) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <motion.div
          id="summary-screen"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white border border-slate-200 rounded-none overflow-hidden"
        >
          <div className="bg-slate-900 px-6 py-8 text-center text-white border-b border-slate-950">
            <div className="inline-flex p-3 bg-white/10 rounded-none mb-3 border border-white/20">
              {examResult.timedOut ? (
                <AlertTriangle className="h-8 w-8 text-amber-300" />
              ) : (
                <CheckCircle className="h-8 w-8 text-emerald-300" />
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight font-display uppercase">{examResult.title}</h2>
            <p className="text-slate-400 text-xs mt-1 font-mono tracking-wider">UNIVERSITY SECURE ASSESSMENT RESULT</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center justify-center py-5 bg-slate-50 border border-slate-200 rounded-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Secure Grade</span>
              <span className="text-5xl font-black text-slate-950 tracking-tight mt-1 font-display">
                {examResult.score.toFixed(1)}%
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 mt-2">
                {examResult.score >= 50 ? "✅ Academic Pass" : "❌ Re-assessment required"}
              </span>
            </div>

            {examResult.timedOut && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-none p-4 flex gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider block mb-0.5">Auto-Submitted / Timed Out</span>
                  This quiz exceeded the allocated duration limit. The examination session was securely finalized and locked by the server.
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Question & Responses Audit Log</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {examResult.questions.map((q, idx) => {
                  const studentAns = examResult.answers[q.id];
                  const options: string[] = JSON.parse(q.optionsJson);
                  return (
                    <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-none space-y-2">
                      <p className="text-xs font-semibold text-slate-800">
                        {idx + 1}. {q.text}
                      </p>
                      <div className="grid grid-cols-1 gap-1 pl-2">
                        {options.map((opt) => (
                          <div
                             key={opt}
                             className={`text-xs px-2.5 py-1 rounded-none flex items-center justify-between ${
                               studentAns === opt
                                 ? "bg-slate-100 font-bold text-slate-900 border-l-2 border-slate-900"
                                 : "text-slate-500"
                             }`}
                          >
                            <span>{opt}</span>
                            {studentAns === opt && (
                              <span className="text-[9px] font-mono font-bold uppercase text-slate-600 tracking-wider">
                                Selection
                              </span>
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
              className="w-full flex justify-center items-center py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-none text-xs font-bold uppercase tracking-wider border border-slate-950 cursor-pointer transition"
            >
              Return to Student Portal Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render Section: ACTIVE EXAMINATION ENGINE
  if (activeQuiz && activeAttempt) {
    const isUnderOneMinute = remainingSeconds <= 60;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
        {/* Secure Top Exam Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-none uppercase tracking-widest font-bold">
              {selectedCourse?.code || "EXAM"}
            </span>
            <h1 className="text-sm font-bold tracking-tight font-display uppercase">{activeQuiz.title}</h1>
          </div>

          {/* Secure Timer HUD */}
          <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 px-4 py-2 rounded-none">
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${isUnderOneMinute ? "text-red-500 animate-pulse" : "text-slate-400"}`} />
              <span className={`font-mono text-base font-bold tracking-wider ${isUnderOneMinute ? "text-red-500" : "text-white"}`}>
                {formatTime(remainingSeconds)}
              </span>
            </div>

            {/* Anti-tamper Sync LED */}
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3 text-[9px] font-mono text-slate-500 uppercase tracking-wider font-bold">
              <span className={`h-1.5 w-1.5 rounded-none ${
                syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-red-500"
              }`} />
              {syncStatus === "syncing" ? "SYNC" : "SECURE"}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-6 py-10">
          {submitError && (
            <div className="mb-6 bg-red-950/40 border border-red-900 text-red-200 rounded-none p-4 flex gap-2.5 text-xs">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
              <div>{submitError}</div>
            </div>
          )}

          <div className="space-y-6">
            {quizQuestions.map((q, qIdx) => {
              const options: string[] = JSON.parse(q.optionsJson);
              const isAnswered = selectedAnswers[q.id] !== undefined;

              return (
                <div
                  key={q.id}
                  className={`p-6 rounded-none border transition-all duration-150 ${
                    isAnswered
                      ? "bg-slate-900 border-slate-700 shadow-sm"
                      : "bg-slate-900/40 border-slate-800/80"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex items-center justify-center h-6 w-6 rounded-none bg-slate-800 text-[10px] font-mono font-bold text-slate-400 shrink-0 mt-0.5 border border-slate-700">
                      {qIdx + 1}
                    </span>
                    <div className="space-y-4 w-full">
                      <h3 className="text-sm font-semibold text-slate-100 leading-relaxed font-sans">
                        {q.text}
                      </h3>

                      {/* Custom styled Radio Option Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {options.map((opt) => {
                          const isSelected = selectedAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleSelectOption(q.id, opt)}
                              className={`flex items-center justify-between p-3.5 rounded-none border text-left text-xs font-semibold transition cursor-pointer ${
                                isSelected
                                  ? "bg-slate-800 border-slate-400 text-white"
                                  : "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 hover:border-slate-700"
                              }`}
                            >
                              <span>{opt}</span>
                              <span className={`h-3 w-3 rounded-none border flex items-center justify-center shrink-0 ml-2 ${
                                isSelected ? "border-white bg-white" : "border-slate-700"
                              }`}>
                                {isSelected && <span className="h-1 w-1 bg-slate-950" />}
                              </span>
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

        {/* Bottom Submission Control Bar */}
        <div className="bg-slate-900 border-t border-slate-800 px-8 py-5 flex items-center justify-between shadow-inner">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">
            {Object.keys(selectedAnswers).length} OF {quizQuestions.length} QUESTIONS COMPLETED
          </div>

          <button
            id="manual-submit-quiz-btn"
            onClick={handleManualSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-slate-100 hover:bg-white text-slate-950 border border-white font-bold text-xs uppercase tracking-wider rounded-none shadow-md cursor-pointer transition disabled:opacity-50"
          >
            {isSubmitting ? "Scoring Session..." : "Finalize & Submit Exam"}
          </button>
        </div>

        {/* Graceful Examination Time-Expired Modal */}
        <AnimatePresence>
          {showExamExpiredModal && (
            <motion.div
              id="exam-expired-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-xs p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 shadow-2xl rounded-none text-center space-y-6 text-white"
              >
                <div className="flex justify-center">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-none inline-flex">
                    <Clock className="h-8 w-8 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-md font-extrabold uppercase tracking-wider text-amber-500 font-display">
                    Examination Session Expired
                  </h3>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    FUTO Academic Integrity Gate
                  </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Your allocated examination duration has ended. The system is automatically locking your answers and transmitting them securely to the database.
                </p>

                {/* Submitting Status / Save feedback */}
                <div className="bg-slate-950 p-4 border border-slate-850 flex flex-col items-center justify-center space-y-3">
                  {isBackgroundSubmitting ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                        Syncing Answers with Server...
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">PLEASE DO NOT REFRESH OR EXIT</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        Answers Securely Saved & Scored!
                      </div>
                      <p className="text-[10px] text-slate-550 font-mono">READY TO VIEW AUDIT REPORT</p>
                    </div>
                  )}

                  {/* Visual countdown progress */}
                  <div className="w-full space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>AUTO-ADVANCING</span>
                      <span>{examExpiredCountdown}s</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 5, ease: "linear" }}
                        className="h-full bg-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="exam-expired-proceed-btn"
                  type="button"
                  disabled={isBackgroundSubmitting || !pendingExamResult}
                  onClick={handleProceedToResults}
                  className="w-full py-3 bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-2"
                >
                  Proceed to Score Card
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FUTOLogo className="h-9 w-9" />
          <span className="text-md font-bold text-slate-950 font-display tracking-tight uppercase">FUTO • EduQuiz Portal</span>
        </div>

        {/* Student Details Panel */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAvatarModalOpen(true)}
            className="group relative flex items-center justify-center cursor-pointer focus:outline-none"
            title="Click to update your FUTO academic identity photo / avatar"
          >
            <UserAvatar
              userId={user.id}
              role="student"
              size={36}
              initials={user.fullName}
              refreshTrigger={avatarRefreshTrigger}
              className="border border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-100 transition-colors"
            />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="h-3 w-3 text-white" />
            </div>
          </button>

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 leading-none">{user.fullName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                {user.regNumber} • {user.department} •
              </span>
              <select
                value={currentYear}
                onChange={(e) => handlePromoteYear(e.target.value)}
                className="text-[9px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-1.5 py-0.5 border border-slate-300 rounded-none outline-none cursor-pointer"
                title="Academic Promotion Selector (Click to Advance Year)"
              >
                {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Extra Year", "Postgraduate"].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-student-btn"
            onClick={onToggleTheme}
            className="flex items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-none transition cursor-pointer border border-slate-200 dark:border-slate-800"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            id="student-logout-btn"
            onClick={onLogout}
            className="flex items-center justify-center p-2 text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-none transition cursor-pointer border border-slate-200"
            title="Secure Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Course Selection Sidebar */}
        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 border border-slate-200 rounded-none shadow-xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Academic Courses</h3>
            <div className="space-y-1">
              {loading ? (
                <div className="space-y-2 animate-pulse" id="courses-skeleton">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-16"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 w-full"></div>
                    </div>
                  ))}
                </div>
              ) : (
                courses.map((c) => {
                  const isSelected = selectedCourse?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        fetchCourseDetail(c.id);
                        setSelectedNote(null);
                        setNotesFilterCourseId(c.id);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-none text-left text-xs transition cursor-pointer border ${
                        isSelected
                          ? "bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-slate-50 font-bold border-slate-900 dark:border-slate-100"
                          : "text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-950 dark:hover:text-slate-50 border-transparent"
                      }`}
                    >
                      <div>
                        <span className="block font-mono text-[10px] font-bold uppercase tracking-wider">{c.code}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 leading-tight truncate">{c.title}</span>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-slate-900 dark:text-slate-50" : "opacity-25"}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Hand: Dual Tab Control Content */}
        <section className="lg:col-span-9 space-y-4">
          {/* Main Workspace Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              id="notes-tab"
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-1.5 pb-2.5 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                activeTab === "notes"
                  ? "border-slate-900 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-850"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Lecture Materials
            </button>
            <button
              id="quizzes-tab"
              onClick={() => setActiveTab("quizzes")}
              className={`flex items-center gap-1.5 pb-2.5 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                activeTab === "quizzes"
                  ? "border-slate-900 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-850"
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              Academic Quizzes
            </button>
            <button
              id="live-tab"
              onClick={() => setActiveTab("live-classroom")}
              className={`flex items-center gap-1.5 pb-2.5 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                activeTab === "live-classroom"
                  ? "border-slate-900 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-850"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Virtual Classroom
            </button>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-none shadow-xs">
            
            {/* NOTES VIEW */}
            {activeTab === "notes" && (
              <div id="notes-view-container" className="space-y-6">
                {!selectedNote ? (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">
                          Lecture Materials Library
                        </h2>
                        <p className="text-[11px] text-slate-400">Browse, filter, and study uploaded lecture notes and resources.</p>
                      </div>
                      
                      {/* Course Filter selector */}
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                        <select
                          id="notes-course-filter"
                          value={notesFilterCourseId}
                          onChange={(e) => setNotesFilterCourseId(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 bg-white rounded-none text-xs text-slate-700 outline-none focus:border-slate-900"
                        >
                          <option value="">All Courses</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} - {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {loading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse" id="notes-skeleton">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="p-5 border border-slate-200 dark:border-slate-800 rounded-none flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-800 w-16"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 w-20"></div>
                              </div>
                              <div className="h-4 bg-slate-200 dark:bg-slate-800 w-3/4"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-800 w-1/2"></div>
                            </div>
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 h-4 bg-slate-200 dark:bg-slate-800 w-24"></div>
                          </div>
                        ))}
                      </div>
                    ) : allNotes.filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allNotes
                          .filter(n => !notesFilterCourseId || n.courseId === notesFilterCourseId)
                          .map((note) => {
                            const noteCourse = courses.find((c) => c.id === note.courseId) || note.course;
                            return (
                              <div
                                key={note.id}
                                className="p-5 border border-slate-200 hover:border-slate-900 rounded-none transition group flex flex-col justify-between"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider bg-slate-100 border border-slate-250 text-slate-700">
                                      {noteCourse?.code || "COURSE"}
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      {new Date(note.createdAt).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-950 leading-snug">
                                    {note.title}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
                                    {noteCourse?.title || "Academic Resource Note"}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setSelectedNote(note)}
                                  className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 cursor-pointer w-full text-left"
                                >
                                  Open Lecture Note
                                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="py-16 text-center text-slate-450 text-xs border border-dashed border-slate-300 rounded-none font-mono">
                        No lecture materials matching your criteria were found.
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div
                    id="note-reader"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <button
                          onClick={() => setSelectedNote(null)}
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 mb-1.5 inline-block cursor-pointer"
                        >
                          ← Back to Lecture Materials
                        </button>
                        <h2 className="text-md font-bold text-slate-950 font-display">{selectedNote.title}</h2>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(selectedNote.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200 rounded-none p-6">
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
                  <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Available Quizzes</h2>
                  <p className="text-[11px] text-slate-400">Secure academic evaluation engines configured for your department.</p>
                </div>

                {loading ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse" id="quizzes-skeleton">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                        <div className="space-y-2 w-2/3">
                          <div className="h-4 bg-slate-200 dark:bg-slate-800 w-1/2"></div>
                          <div className="flex gap-4">
                            <div className="h-3 bg-slate-200 dark:bg-slate-800 w-16"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-800 w-24"></div>
                          </div>
                        </div>
                        <div className="h-8 bg-slate-200 dark:bg-slate-800 w-24"></div>
                      </div>
                    ))}
                  </div>
                ) : quizzes && quizzes.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {quizzes.map((quiz) => {
                      const attempt = attempts[quiz.id];
                      const isCompleted = attempt?.isCompleted;

                      return (
                        <div key={quiz.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-900">{quiz.title}</h4>
                            <div className="flex items-center gap-3.5 text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {quiz.durationMinutes} MIN
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {quiz._count?.questions || 0} QUESTIONS
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isCompleted ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[9px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                  SCORE: {attempt.score?.toFixed(1)}%
                                </span>
                                <p className="text-[9px] text-slate-400 font-mono mt-1">
                                  SUBMITTED {new Date(attempt.submittedAt!).toLocaleDateString()}
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartExam(quiz)}
                                className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-none shadow border border-slate-950 transition cursor-pointer"
                              >
                                <Play className="h-2.5 w-2.5 fill-current" />
                                Start Exam
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-450 text-xs border border-dashed border-slate-300 rounded-none font-mono">
                    No assessments or examinations scheduled for this course.
                  </div>
                )}
              </div>
            )}

            {/* LIVE CLASSROOM VIEW */}
            {activeTab === "live-classroom" && (
              <div id="live-classroom-view-container" className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display flex items-center gap-2">
                      <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                      Live Educational Broadcast
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {selectedCourse ? `${selectedCourse.code} • ${selectedCourse.title}` : "Select a Course"}
                    </p>
                  </div>
                  {activeLiveSession ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-mono font-bold uppercase tracking-wider border border-red-200">
                      <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping"></span>
                      Active Lecture Session
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-mono font-bold uppercase tracking-wider border border-slate-200">
                      Offline
                    </span>
                  )}
                </div>

                {!activeLiveSession ? (
                  <div className="py-16 text-center border border-dashed border-slate-300 rounded-none bg-slate-50/50">
                    <Radio className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">No Active Live Lecture</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                      Your lecturer is not broadcasting right now. When a live lecture session starts, the slides, notebooks, and group discussion board will update automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Lecture Slides & Materials content */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="p-4 bg-slate-950 text-slate-100 rounded-none border border-slate-900 min-h-[300px] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">BOARD SLIDE TOPIC</span>
                            <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest font-bold font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span> LIVE SYNCED
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white mb-2 uppercase">{activeLiveSession.topic}</h3>
                          <div className="text-xs text-slate-300 max-w-none mt-2 select-text leading-relaxed">
                            <MarkdownView content={activeLiveSession.content} />
                          </div>
                        </div>
                        <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[9px] font-mono text-slate-500">
                          <span>LECTURED BY LECTURER ID: {activeLiveSession.lecturerId}</span>
                          <span>STARTED: {new Date(activeLiveSession.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat group panel */}
                    <div className="lg:col-span-5 border border-slate-200 bg-slate-50/50 flex flex-col h-[400px]">
                      <div className="p-3 bg-slate-150 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Live Study Stream</span>
                        <span className="text-[9px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-none font-bold">
                          {liveChats.length} Messages
                        </span>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                        {liveChats.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-slate-400 font-mono text-[10px] py-8">
                            Study discussion started. Be the first to reply!
                          </div>
                        ) : (
                          liveChats.map((chat) => {
                            const isMe = chat.studentId === user.id || chat.senderId === user.id;
                            const isStaff = chat.senderRole === "lecturer" || !!chat.lecturerName;
                            const displayName = chat.senderName || chat.studentName || chat.lecturerName || (isMe ? "You" : "Anonymous");
                            const senderId = chat.senderId || chat.studentId || chat.lecturerId || "";
                            const role = isStaff ? "lecturer" : "student";

                            return (
                              <div key={chat.id} className={`flex items-start gap-2.5 max-w-[90%] ${isMe ? "flex-row-reverse self-end" : "flex-row self-start"}`}>
                                <UserAvatar
                                  userId={senderId}
                                  role={role}
                                  size={28}
                                  initials={displayName}
                                  className="mt-1 shrink-0"
                                />
                                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                  <div className="flex items-center gap-1 mb-0.5 text-[9px] font-mono font-bold text-slate-500">
                                    <span className={isStaff ? "text-amber-700 font-bold" : ""}>
                                      {displayName}
                                    </span>
                                    {isStaff && <span className="bg-amber-100 text-amber-800 text-[8px] px-1 font-bold">STAFF</span>}
                                    <span>• {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className={`p-2.5 rounded-none leading-relaxed break-words ${
                                    isMe 
                                      ? "bg-slate-900 text-white" 
                                      : isStaff
                                        ? "bg-amber-50 border border-amber-200 text-slate-800"
                                        : "bg-white border border-slate-200 text-slate-800"
                                  }`}>
                                    {chat.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Message Input */}
                      <form onSubmit={handleSendChatMessage} className="p-2 border-t border-slate-200 bg-white flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Type class response..."
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-none focus:outline-none focus:border-slate-900 text-slate-900"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat}
                          className="px-3 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wider rounded-none flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
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
