import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Award, LogOut, FileText, ChevronRight, Play, Clock, AlertTriangle, CheckCircle, ShieldAlert, Send, Radio, Filter, Calendar, Sun, Moon, Camera, Upload, Loader2, ThumbsUp, ArrowLeft, Mic, Layers, BarChart2, MessageSquare, Users, X, ClipboardList, Trophy, Megaphone, TrendingUp, Bell, Pencil } from "lucide-react";
import { Course, LectureNote, Quiz, StudentAttempt, Question } from "../types";
import MarkdownView from "./MarkdownView";
import UserAvatar from "./UserAvatar";
import AvatarModal from "./AvatarModal";
import { motion, AnimatePresence } from "motion/react";
import SlideView from "./SlideView";

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

function getPeriodStatus(availableFrom?: string, availableUntil?: string) {
  const now = new Date();
  const from = availableFrom ? new Date(availableFrom) : null;
  const until = availableUntil ? new Date(availableUntil) : null;
  if (from && now < from) return { type: "upcoming" as const, from, until };
  if (until && now > until) return { type: "expired" as const, from, until };
  return { type: "active" as const, from, until };
}

function formatCountdown(target: Date): string {
  const secs = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export default function StudentDashboard({ token, user, theme, onToggleTheme, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"notes" | "quizzes" | "live-classroom" | "exams" | "assignments" | "history">("notes");
  const [periodTick, setPeriodTick] = useState(0);
  const [currentYear, setCurrentYear] = useState(user.year);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<LectureNote | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Record<string, StudentAttempt>>({});
  const [attemptsList, setAttemptsList] = useState<any[]>([]);
  const [examSubmissions, setExamSubmissions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedAnns, setDismissedAnns] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [leaderboardQuizTitle, setLeaderboardQuizTitle] = useState("");
  const [pushGranted, setPushGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);

  const [activeLiveSession, setActiveLiveSession] = useState<any | null>(null);
  const [allLiveSessions, setAllLiveSessions] = useState<any[]>([]);
  const [joinedCourseId, setJoinedCourseId] = useState<string | null>(null);
  const [liveChats, setLiveChats] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Live classroom sub-features
  const [liveStudentTab, setLiveStudentTab] = useState<"slides" | "poll" | "chat">("slides");
  const [audioOpen, setAudioOpen] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [myPollAnswer, setMyPollAnswer] = useState<string | null>(null);
  const [isSpeakingAllowed, setIsSpeakingAllowed] = useState(false);
  const jitsiContainerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<any>(null);

  // Exam state
  const [exams, setExams] = useState<any[]>([]);
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [mySubmission, setMySubmission] = useState<any | null>(null);
  const [examAnswers, setExamAnswers] = useState("");
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  // Assignment state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [myAssignmentSubmission, setMyAssignmentSubmission] = useState<any | null>(null);
  const [assignmentAnswers, setAssignmentAnswers] = useState("");
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSubmissionHistory, setAssignmentSubmissionHistory] = useState<any[]>([]);

  const fetchAllLiveSessions = async () => {
    try {
      const res = await fetch("/api/lectures/active-all", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAllLiveSessions(await res.json());
    } catch {}
  };

  const joinLiveSession = async (courseId: string) => {
    try {
      const res = await fetch(`/api/lectures/active/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (!data) return;
        setActiveLiveSession(data);
        setJoinedCourseId(courseId);
        if (data.chats) setLiveChats(data.chats);
        else setLiveChats([]);
        if (data.id) {
          fetch(`/api/lectures/${data.id}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Error joining live session:", e);
    }
  };

  const fetchActiveLiveSession = async () => {
    if (!joinedCourseId) { fetchAllLiveSessions(); return; }
    try {
      const res = await fetch(`/api/lectures/active/${joinedCourseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (!data) { setActiveLiveSession(null); setJoinedCourseId(null); setIsSpeakingAllowed(false); fetchAllLiveSessions(); }
        else {
          setActiveLiveSession(data);
          if (data.chats) setLiveChats(data.chats);
          const wasAllowed = isSpeakingAllowed;
          const nowAllowed = !!data.myAllowedToSpeak;
          setIsSpeakingAllowed(nowAllowed);
          // If permission was just revoked, mute the student's mic
          if (wasAllowed && !nowAllowed && jitsiApiRef.current) {
            jitsiApiRef.current.executeCommand("setAudioMuted", true);
          }
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

  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/assignments", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignments(await res.json());
    } catch (e) { console.error("Error fetching assignments:", e); }
  };

  const fetchMyAssignmentSubmission = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/my-submission`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMyAssignmentSubmission(await res.json());
    } catch (e) { console.error("Error fetching assignment submission:", e); }
  };

  const handleAssignmentSubmit = async () => {
    if (!assignmentAnswers.trim()) { setAssignmentError("Please write your answers before submitting."); return; }
    if (!activeAssignment) return;
    setIsSubmittingAssignment(true);
    setAssignmentError(null);
    try {
      const res = await fetch(`/api/assignments/${activeAssignment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answersText: assignmentAnswers }),
      });
      const d = await res.json();
      if (res.ok) {
        setMyAssignmentSubmission(d);
        setAssignmentAnswers("");
      } else {
        setAssignmentError(d.error || "Submission failed");
      }
    } catch (e: any) {
      setAssignmentError(e.message);
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const fetchAssignmentSubmissionHistory = async () => {
    try {
      const res = await fetch("/api/student/assignment-submissions", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignmentSubmissionHistory(await res.json());
    } catch (e) { console.error("Error fetching assignment history:", e); }
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
    if (activeTab === "assignments") fetchAssignments();
    if (activeTab === "history") { fetchAttempts(); fetchExamSubmissions(); fetchAssignmentSubmissionHistory(); }
  }, [activeTab]);

  useEffect(() => {
    let interval: any;
    if (activeTab === "live-classroom") {
      fetchActiveLiveSession();
      interval = setInterval(fetchActiveLiveSession, 4000);
    } else {
      setActiveLiveSession(null);
      setJoinedCourseId(null);
      setAllLiveSessions([]);
      setLiveChats([]);
      setIsSpeakingAllowed(false);
    }
    return () => clearInterval(interval);
  }, [activeTab, joinedCourseId]);

  // Jitsi IFrame API for student — init when session is active, destroy when it ends
  useEffect(() => {
    if (!activeLiveSession) {
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
      return;
    }
    if (jitsiApiRef.current) return; // already initialised for this session
    const roomName = activeLiveSession.jitsiRoom ?? activeLiveSession.id;
    const initJitsi = () => {
      if (jitsiApiRef.current || !jitsiContainerRef.current) return;
      jitsiApiRef.current = new (window as any).JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: jitsiContainerRef.current,
        userInfo: { displayName: user.fullName },
        configOverwrite: {
          startWithVideoMuted: true,
          startWithAudioMuted: true, // students start muted; lecturer grants permission
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          filmStripOnly: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          TOOLBAR_BUTTONS: ["microphone", "hangup", "fullscreen"],
        },
      });
    };
    if ((window as any).JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const existing = document.querySelector('script[src*="external_api"]');
      if (!existing) {
        const s = document.createElement("script");
        s.src = "https://meet.jit.si/external_api.js";
        s.onload = initJitsi;
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", initJitsi);
      }
    }
    return () => {
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
    };
  }, [activeLiveSession?.id]);

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
    fetchAnnouncements();
    subscribeToPush();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPeriodTick((t) => t + 1), 1000);
    return () => clearInterval(id);
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
      const res = await fetch("/api/courses", { headers: { Authorization: `Bearer ${token}` } });
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
        const data: any[] = await res.json();
        const attemptMap: Record<string, StudentAttempt> = {};
        data.forEach((a) => { attemptMap[a.quizId] = a; });
        setAttempts(attemptMap);
        setAttemptsList(data);
      }
    } catch (err) {
      console.error("Error fetching student attempts:", err);
    }
  };

  const fetchExamSubmissions = async () => {
    try {
      const res = await fetch("/api/student/exam-submissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setExamSubmissions(await res.json());
    } catch (err) {
      console.error("Error fetching exam submissions:", err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAnnouncements(await res.json());
    } catch {}
  };

  const fetchLeaderboard = async (quizId: string, title: string) => {
    setLeaderboard(null);
    setLeaderboardQuizTitle(title);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/leaderboard`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLeaderboard(await res.json());
    } catch {}
  };

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const keyRes = await fetch("/api/vapid-public-key");
      const { key } = await keyRes.json();
      if (!key) return;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub),
      });
      setPushGranted(true);
    } catch {}
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

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
            { id: "notes",          icon: FileText,      label: "Materials",    live: false },
            { id: "quizzes",        icon: Award,         label: "Quizzes",      live: false },
            { id: "exams",          icon: Upload,        label: "Exams",        live: false },
            { id: "assignments",    icon: Pencil,        label: "Assignments",  live: false },
            { id: "history",        icon: ClipboardList, label: "My Results",   live: false },
            { id: "live-classroom", icon: Radio,         label: "Live Class",   live: true  },
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
        <header className="apple-header-bar flex-shrink-0 flex items-center justify-between px-6 h-[44px] border-b border-black/[0.05] dark:border-white/[0.04] backdrop-blur-xl">
          <h1 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white/88 tracking-[-0.01em]">
            {activeTab === "notes" ? "Lecture Materials"
              : activeTab === "quizzes" ? "Academic Quizzes"
              : activeTab === "exams" ? "Written Examinations"
              : activeTab === "assignments" ? "Assignments"
              : activeTab === "history" ? "My Results"
              : "Virtual Classroom"}
          </h1>
          <div className="flex items-center gap-1">
            {selectedCourse && (
              <span className="hidden md:inline px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.07] text-[11px] font-mono font-bold text-[#6e6e73] dark:text-white/45 uppercase tracking-wider">
                {selectedCourse.code}
              </span>
            )}
            {/* Push notification bell */}
            {!pushGranted && "Notification" in window && Notification.permission !== "granted" && (
              <button onClick={subscribeToPush} title="Enable notifications"
                className="flex items-center justify-center w-9 h-9 rounded-[10px] text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition">
                <Bell className="h-4 w-4" strokeWidth={1.6} />
              </button>
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
          <div className={`py-5 pb-[96px] sm:pb-5 max-w-5xl mx-auto w-full space-y-5 ${activeTab === "live-classroom" ? "px-2 sm:px-6" : "px-6"}`}>

          {/* ── ANNOUNCEMENTS BANNER ── */}
          {announcements.filter(a => !dismissedAnns.has(a.id)).slice(0, 3).map(ann => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-[12px]">
              <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">{ann.title}</p>
                <p className="text-[11.5px] text-amber-800 dark:text-amber-300/80 mt-0.5 leading-relaxed">{ann.body}</p>
                <p className="text-[10px] font-mono text-amber-600/60 dark:text-amber-400/40 mt-1">{ann.lecturer?.name} · {new Date(ann.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setDismissedAnns(p => new Set([...p, ann.id]))} className="flex-shrink-0 p-1 text-amber-400 hover:text-amber-600 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          ))}

          {/* ── PROGRESS OVERVIEW ── */}
          {attemptsList.filter(a => a.isCompleted).length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(() => {
                const done = attemptsList.filter(a => a.isCompleted);
                const quizAvg = done.length > 0 ? done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length : 0;
                const gradedExams = examSubmissions.filter(e => e.isGraded);
                const examAvg = gradedExams.length > 0
                  ? gradedExams.reduce((s, e) => s + (e.totalMarks ? ((e.score ?? 0) / e.totalMarks) * 100 : (e.score ?? 0)), 0) / gradedExams.length
                  : 0;
                return [
                  { icon: Award,       label: "Quizzes Done",   value: done.length },
                  { icon: TrendingUp,  label: "Quiz Avg",        value: `${quizAvg.toFixed(1)}%` },
                  { icon: FileText,    label: "Exams Submitted", value: examSubmissions.length },
                  { icon: CheckCircle, label: "Exam Avg",        value: gradedExams.length > 0 ? `${examAvg.toFixed(1)}%` : "—" },
                ].map(stat => (
                  <div key={stat.label} className="text-center p-3 apple-card rounded-[12px]">
                    <stat.icon className="h-4 w-4 text-emerald-500 mx-auto mb-1" strokeWidth={1.8} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">{stat.label}</p>
                    <p className="text-[18px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{stat.value}</p>
                  </div>
                ));
              })()}
            </motion.div>
          )}

          {/* ── LEADERBOARD MODAL ── */}
          {leaderboard !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setLeaderboard(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="apple-card max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <div><h2 className="apple-title flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Leaderboard</h2><p className="apple-subtitle truncate">{leaderboardQuizTitle}</p></div>
                  <button onClick={() => setLeaderboard(null)} className="p-1.5 rounded-[8px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] cursor-pointer"><X className="h-4 w-4 text-[#6e6e73]" /></button>
                </div>
                <div className="p-4 space-y-2">
                  {leaderboard.length === 0 ? <p className="text-center text-[12px] text-[#6e6e73] py-6">No completed attempts yet.</p> :
                    leaderboard.map(entry => (
                      <div key={entry.rank} className={`flex items-center gap-3 p-3 rounded-[10px] ${entry.rank <= 3 ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30" : "border border-black/[0.06] dark:border-white/[0.06]"}`}>
                        <span className={`text-[13px] font-black w-6 text-center flex-shrink-0 ${entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-orange-400" : "text-[#6e6e73]"}`}>
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{entry.fullName}</p>
                          <p className="text-[10.5px] font-mono text-[#6e6e73] dark:text-white/40">{entry.regNumber}</p>
                        </div>
                        <span className={`flex-shrink-0 text-[12px] font-bold ${entry.score >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{entry.score.toFixed(1)}%</span>
                      </div>
                    ))
                  }
                </div>
              </motion.div>
            </div>
          )}

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
                  {/* Mobile-only course selector — sidebar handles this on desktop */}
                  {courses.length > 0 && (
                    <div className="sm:hidden -mx-5 px-5 pb-1">
                      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                        {courses.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => fetchCourseDetail(c.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-colors cursor-pointer ${
                              selectedCourse?.id === c.id
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-black/[0.10] dark:border-white/[0.12] text-[#3a3a3c] dark:text-white/55 hover:border-emerald-400 dark:hover:border-emerald-700"
                            }`}
                          >
                            {c.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                        const period = getPeriodStatus(quiz.availableFrom, quiz.availableUntil);
                        const isExpired = period.type === "expired";
                        const isUpcoming = period.type === "upcoming";
                        void periodTick; // consumed so re-renders update countdown
                        return (
                          <div key={quiz.id} className="flex items-center justify-between p-4 rounded-[12px] border border-black/[0.07] dark:border-white/[0.07] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 bg-black/[0.01] dark:bg-white/[0.02] hover:shadow-sm transition-all duration-200">
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{quiz.title}</h4>
                              <div className="flex items-center gap-3 text-[10.5px] text-[#6e6e73] dark:text-white/40 font-mono">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {quiz.durationMinutes} min</span>
                                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {quiz._count?.questions || 0} questions</span>
                              </div>
                              {/* Period countdown / status */}
                              {!isCompleted && period.until && period.type === "active" && (
                                <div className="flex items-center gap-1 text-[10.5px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                                  <Clock className="h-3 w-3" />
                                  Closes in {formatCountdown(period.until)}
                                </div>
                              )}
                              {!isCompleted && isUpcoming && period.from && (
                                <div className="text-[10.5px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                                  Opens {period.from.toLocaleString()}
                                </div>
                              )}
                              {!isCompleted && isExpired && (
                                <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-500 font-semibold">
                                  Access period ended
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              {isCompleted ? (
                                <div className="text-right space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                    Score: {attempt.score?.toFixed(1)}%
                                  </span>
                                  <p className="text-[11px] text-[#6e6e73] dark:text-white/35 font-mono text-right">
                                    {new Date(attempt.submittedAt!).toLocaleDateString()}
                                  </p>
                                  <button onClick={() => fetchLeaderboard(quiz.id, quiz.title)}
                                    className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 cursor-pointer ml-auto">
                                    <Trophy className="h-3 w-3" /> Leaderboard
                                  </button>
                                </div>
                              ) : isExpired ? (
                                <span className="px-4 py-2.5 rounded-[10px] bg-black/[0.05] dark:bg-white/[0.05] text-[#6e6e73] dark:text-white/35 text-[13px] font-semibold cursor-not-allowed">
                                  Closed
                                </span>
                              ) : isUpcoming ? (
                                <span className="px-4 py-2.5 rounded-[10px] bg-black/[0.05] dark:bg-white/[0.05] text-[#6e6e73] dark:text-white/35 text-[13px] font-semibold cursor-not-allowed">
                                  Not Open Yet
                                </span>
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
            <div id="live-classroom-view-container" className="w-full overflow-x-hidden">
              <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white/90 flex items-center gap-2">
                      <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                      Virtual Classroom
                    </h2>
                    <p className="apple-subtitle">
                      {activeLiveSession
                        ? `${activeLiveSession.course?.code ?? ""} · ${activeLiveSession.topic}`
                        : allLiveSessions.length > 0
                          ? `${allLiveSessions.length} live class${allLiveSessions.length !== 1 ? "es" : ""} available`
                          : "No live classes right now"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeLiveSession && (
                      <>
                        <button
                          onClick={handleToggleHandRaise}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] border transition-colors ${handRaised ? "bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400" : "border-black/[0.09] dark:border-white/[0.10] text-[#3a3a3c] dark:text-white/60 hover:border-amber-300"}`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> {handRaised ? "Hand Raised" : "Raise Hand"}
                        </button>
                        <button onClick={() => { setActiveLiveSession(null); setJoinedCourseId(null); fetchAllLiveSessions(); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-black/[0.09] dark:border-white/[0.10] text-[#6e6e73] dark:text-white/40 hover:text-red-500 hover:border-red-300 rounded-[8px] transition cursor-pointer">
                          <ArrowLeft className="h-3.5 w-3.5" /> Leave
                        </button>
                      </>
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

                <div className="p-2 sm:p-5">
                  {!activeLiveSession ? (
                    <div className="space-y-4">
                      {allLiveSessions.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                          <Radio className="h-8 w-8 text-black/20 dark:text-white/20 mx-auto mb-3" />
                          <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/70">No Live Lectures Right Now</h4>
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/40 max-w-sm mx-auto mt-1.5 leading-relaxed">When a lecturer goes live, their class will appear here. Check back soon.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">Live Now — Select a Class to Join</p>
                          {allLiveSessions.map((session: any) => (
                            <motion.div key={session.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center justify-between gap-3 p-4 border border-red-100 dark:border-red-900/30 bg-red-50/40 dark:bg-red-950/10 rounded-[14px]">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex-shrink-0 relative">
                                  <span className="flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                                    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{session.topic}</p>
                                  <p className="text-[11.5px] text-[#6e6e73] dark:text-white/50 truncate">
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{session.course?.code}</span>
                                    {" · "}{session.course?.title}
                                    {" · "}{session.course?.lecturer?.name}
                                  </p>
                                  <p className="text-[10.5px] font-mono text-[#6e6e73] dark:text-white/30 mt-0.5">
                                    {session.attendance?.length ?? 0} student{session.attendance?.length !== 1 ? "s" : ""} joined · Started {new Date(session.createdAt).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => joinLiveSession(session.course.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-semibold rounded-[10px] transition cursor-pointer">
                                <Play className="h-3.5 w-3.5 fill-white" /> Join
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (() => {
                    const slides = activeLiveSession.content.split(/^---$/m).map((s: string) => s.trim()).filter(Boolean);
                    const currentSlide = activeLiveSession.currentSlide ?? 0;
                    const slide = slides[Math.min(currentSlide, slides.length - 1)] ?? activeLiveSession.content;
                    const activePoll: any = (activeLiveSession.polls ?? [])[0] ?? null;

                    return (
                      <div className="space-y-2 sm:space-y-3">
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

                        {/* Speaking permission banner */}
                        {isSpeakingAllowed && (
                          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 rounded-[12px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[18px]">🎤</span>
                              <div>
                                <p className="text-[12.5px] font-bold text-emerald-700 dark:text-emerald-400">You've been allowed to speak</p>
                                <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60">Tap the button to unmute your microphone</p>
                              </div>
                            </div>
                            <button
                              onClick={() => jitsiApiRef.current?.executeCommand("toggleAudio")}
                              className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold rounded-[10px] transition cursor-pointer">
                              Unmute
                            </button>
                          </div>
                        )}

                        {/* Jitsi IFrame API — always mounted for persistent audio */}
                        <div ref={jitsiContainerRef}
                          className={`rounded-[12px] overflow-hidden border border-black/[0.07] dark:border-white/[0.07] transition-all duration-300 ${audioOpen ? "" : "opacity-0 pointer-events-none"}`}
                          style={{ height: audioOpen ? 110 : 0 }}
                        />

                        {/* Audio toggle bar */}
                        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 dark:bg-black/40 rounded-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2"><span className="animate-ping absolute h-2 w-2 rounded-full bg-emerald-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
                            <span className="text-[11.5px] font-semibold text-slate-200">
                              {isSpeakingAllowed ? "Mic Active" : "Audio Connected · Mic Muted"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">{activeLiveSession.course?.code ?? ""}</span>
                          </div>
                          <button onClick={() => setAudioOpen(o => !o)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-[7px] transition cursor-pointer">
                            <Mic className="h-3 w-3" /> {audioOpen ? "Hide" : "Show"}
                          </button>
                        </div>

                        {/* Slides always visible as primary content */}
                        <div className="space-y-2">
                          <SlideView
                            content={slide}
                            slideNumber={Math.min(currentSlide, slides.length - 1) + 1}
                            totalSlides={slides.length}
                            topic={activeLiveSession.topic}
                            courseCode={activeLiveSession.course?.code}
                          />
                          <p className="text-center text-[10.5px] font-mono text-[#6e6e73] dark:text-white/30">
                            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />Slides advance automatically</span>
                          </p>
                        </div>

                        {/* Sub-tabs: Chat + Poll only */}
                        <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-[12px] p-1 border border-black/[0.06] dark:border-white/[0.05]">
                          {([
                            { id: "poll",   icon: BarChart2,     label: `Poll${activePoll ? " •" : ""}` },
                            { id: "chat",   icon: MessageSquare, label: `Chat (${liveChats.length})` },
                          ] as { id: "slides" | "poll" | "chat"; icon: React.ElementType; label: string }[]).map(tab => (
                            <button key={tab.id} onClick={() => setLiveStudentTab(tab.id)}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 ${liveStudentTab === tab.id ? "bg-[#ffffff] dark:bg-white/[0.10] text-[#1d1d1f] dark:text-white/90 shadow-sm border border-black/[0.07] dark:border-white/[0.08]" : "text-[#6e6e73] dark:text-white/50 hover:text-[#1d1d1f] dark:hover:text-white/75"}`}>
                              <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                              {tab.label}
                            </button>
                          ))}
                        </div>

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
                        {exams.map(exam => {
                          const examPeriod = getPeriodStatus(exam.availableFrom, exam.availableUntil);
                          const examExpired = examPeriod.type === "expired";
                          const examUpcoming = examPeriod.type === "upcoming";
                          const examBlocked = examExpired || examUpcoming;
                          void periodTick;
                          return (
                            <button key={exam.id}
                              onClick={examBlocked ? undefined : async () => { setActiveExam(exam); setMySubmission(null); await fetchMySubmission(exam.id); }}
                              disabled={examBlocked}
                              className={`w-full text-left p-4 border rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] transition-all duration-200 flex items-center justify-between gap-3 ${examBlocked ? "border-black/[0.07] dark:border-white/[0.07] opacity-70 cursor-not-allowed" : "border-black/[0.07] dark:border-white/[0.07] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 hover:shadow-sm cursor-pointer"}`}>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{exam.title}</p>
                                <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">{exam.course?.code} / {exam.course?.title}</p>
                                {!examExpired && !examUpcoming && examPeriod.until && exam.isOpen && (
                                  <div className="flex items-center gap-1 text-[10.5px] font-mono text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                    <Clock className="h-3 w-3" />
                                    Closes in {formatCountdown(examPeriod.until)}
                                  </div>
                                )}
                                {examUpcoming && examPeriod.from && (
                                  <div className="text-[10.5px] font-mono text-blue-600 dark:text-blue-400 font-semibold mt-1">
                                    Opens {examPeriod.from.toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0 ${
                                examExpired
                                  ? "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"
                                  : examUpcoming
                                  ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
                                  : exam.isOpen
                                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                                  : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"
                              }`}>
                                {examExpired ? "Expired" : examUpcoming ? "Upcoming" : exam.isOpen ? "Open" : "Closed"}
                              </span>
                            </button>
                          );
                        })}
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
                        {(() => {
                          const pct = mySubmission.totalMarks ? ((mySubmission.score ?? 0) / mySubmission.totalMarks) * 100 : (mySubmission.score ?? 0);
                          const pass = pct >= 50;
                          return (
                            <div className={`rounded-[12px] p-6 text-center border ${pass ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30" : "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"}`}>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-1">Your Score</p>
                              {mySubmission.totalMarks ? (
                                <>
                                  <p className={`text-5xl font-black ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{mySubmission.score?.toFixed(1)}</p>
                                  <p className={`text-[15px] font-semibold ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>out of {mySubmission.totalMarks} marks</p>
                                </>
                              ) : (
                                <p className={`text-5xl font-black ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{mySubmission.score?.toFixed(1)}%</p>
                              )}
                              <p className={`text-[13px] font-semibold mt-2 ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{pass ? "Passed" : "Failed"}</p>
                            </div>
                          );
                        })()}
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
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                      {activeExam.course?.code} · {
                        getPeriodStatus(activeExam.availableFrom, activeExam.availableUntil).type === "expired"
                          ? "Submission period ended"
                          : activeExam.isOpen ? "Open for submission" : "Closed"
                      }
                    </p>
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Exam Questions</p>
                      <pre className="text-[13px] text-[#1d1d1f] dark:text-white/80 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{activeExam.questionsText}</pre>
                    </div>

                    {(() => {
                      const activePeriod = getPeriodStatus(activeExam.availableFrom, activeExam.availableUntil);
                      const isAccessible = activeExam.isOpen && activePeriod.type !== "expired" && activePeriod.type !== "upcoming";
                      return isAccessible ? (
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">Your Answers</p>
                          {activePeriod.until && (
                            <div className="flex items-center gap-1.5 text-[12px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                              <Clock className="h-3.5 w-3.5" />
                              Submission closes in {formatCountdown(activePeriod.until)}
                            </div>
                          )}
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
                          <p className="text-[13px] font-semibold text-[#6e6e73] dark:text-white/50">
                            {activePeriod.type === "expired"
                              ? "The submission period for this exam has ended."
                              : "This exam is closed for submissions."}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ASSIGNMENTS TAB ── */}
          {activeTab === "assignments" && (
            <div className="space-y-5">
              {!activeAssignment ? (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h2 className="apple-title">Assignments</h2>
                    <p className="apple-subtitle">Read each assignment carefully and type your answers before the due date.</p>
                  </div>
                  <div className="p-5">
                    {assignments.length === 0 ? (
                      <div className="apple-empty-state">
                        <div className="apple-empty-state__icon"><Pencil className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
                        <p className="apple-empty-state__title">No assignments yet</p>
                        <p className="apple-empty-state__body">Assignments from your lecturers will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignments.map(a => {
                          const isOverdue = a.dueDate && new Date() > new Date(a.dueDate);
                          const blocked = !a.isOpen || isOverdue;
                          return (
                            <button key={a.id}
                              onClick={blocked ? undefined : async () => { setActiveAssignment(a); setMyAssignmentSubmission(null); await fetchMyAssignmentSubmission(a.id); }}
                              disabled={blocked}
                              className={`w-full text-left p-4 border rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] transition-all duration-200 flex items-center justify-between gap-3 ${blocked ? "border-black/[0.07] dark:border-white/[0.07] opacity-70 cursor-not-allowed" : "border-black/[0.07] dark:border-white/[0.07] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 hover:shadow-sm cursor-pointer"}`}>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{a.title}</p>
                                <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">{a.course?.code} / {a.course?.title}</p>
                                {a.description && <p className="text-[11px] text-[#6e6e73] dark:text-white/50 mt-0.5 italic">{a.description}</p>}
                                {a.dueDate && (
                                  <div className={`flex items-center gap-1 text-[10.5px] font-mono font-semibold mt-1 ${isOverdue ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                                    <Clock className="h-3 w-3" />
                                    {isOverdue ? "Past due" : `Due ${new Date(a.dueDate).toLocaleString()}`}
                                  </div>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0 ${
                                isOverdue
                                  ? "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"
                                  : a.isOpen
                                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                                  : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"
                              }`}>
                                {isOverdue ? "Overdue" : a.isOpen ? "Open" : "Closed"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : myAssignmentSubmission ? (
                <div className="apple-card">
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <button onClick={() => { setActiveAssignment(null); setMyAssignmentSubmission(null); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> Back to Assignments</button>
                    <h2 className="apple-title">{activeAssignment.title}: Submitted</h2>
                  </div>
                  <div className="p-5 space-y-5">
                    {myAssignmentSubmission.isGraded ? (
                      <div className="space-y-4">
                        {(() => {
                          const pct = myAssignmentSubmission.totalMarks ? ((myAssignmentSubmission.score ?? 0) / myAssignmentSubmission.totalMarks) * 100 : (myAssignmentSubmission.score ?? 0);
                          const pass = pct >= 50;
                          return (
                            <div className={`rounded-[12px] p-6 text-center border ${pass ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30" : "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"}`}>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-1">Your Score</p>
                              {myAssignmentSubmission.totalMarks ? (
                                <>
                                  <p className={`text-5xl font-black ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{myAssignmentSubmission.score?.toFixed(1)}</p>
                                  <p className={`text-[15px] font-semibold ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>out of {myAssignmentSubmission.totalMarks} marks</p>
                                </>
                              ) : (
                                <p className={`text-5xl font-black ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{myAssignmentSubmission.score?.toFixed(1)}%</p>
                              )}
                              <p className={`text-[13px] font-semibold mt-2 ${pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{pass ? "Passed" : "Failed"}</p>
                            </div>
                          );
                        })()}
                        {myAssignmentSubmission.feedback && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">AI Feedback</p>
                            <p className="text-[13px] text-[#1d1d1f] dark:text-white/80 leading-relaxed bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4">{myAssignmentSubmission.feedback}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Your Submitted Answers</p>
                          <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{myAssignmentSubmission.answersText}</pre>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                        <p className="text-[13px] font-semibold text-[#3a3a3c] dark:text-white/70">Assignment submitted — awaiting grading</p>
                        <p className="text-[12px] text-[#6e6e73] dark:text-white/40 mt-1">Your lecturer will grade your submission with AI.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="apple-card">
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <button onClick={() => { setActiveAssignment(null); setAssignmentAnswers(""); setAssignmentError(null); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> Back to Assignments</button>
                    <h2 className="apple-title">{activeAssignment.title}</h2>
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                      {activeAssignment.course?.code}{activeAssignment.dueDate && ` · Due ${new Date(activeAssignment.dueDate).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="p-5 space-y-5">
                    {activeAssignment.description && (
                      <p className="text-[13px] text-[#3a3a3c] dark:text-white/70 italic">{activeAssignment.description}</p>
                    )}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Assignment Questions</p>
                      <pre className="text-[13px] text-[#1d1d1f] dark:text-white/80 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{activeAssignment.questionsText}</pre>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">Your Answers</p>
                      <textarea
                        rows={12}
                        value={assignmentAnswers}
                        onChange={e => setAssignmentAnswers(e.target.value)}
                        placeholder={"Type your answers here. For example:\n\n1. [Your answer to question 1]\n\n2. [Your answer to question 2]\n\netc."}
                        className="w-full px-3.5 py-2.5 rounded-[10px] text-[13.5px] bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.09] dark:border-white/[0.10] text-[#1d1d1f] dark:text-white/90 placeholder-[#6e6e73] dark:placeholder-white/30 outline-none focus:border-emerald-500/60 dark:focus:border-emerald-500/50 transition resize-none leading-relaxed"
                      />
                      {assignmentError && <p className="text-[12px] text-red-500 font-medium">{assignmentError}</p>}
                      <button onClick={handleAssignmentSubmit} disabled={isSubmittingAssignment} className="btn-gradient disabled:opacity-60 flex items-center justify-center gap-2">
                        {isSubmittingAssignment ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit Assignment"}
                      </button>
                      <p className="text-[11px] text-[#6e6e73] dark:text-white/40 text-center">Once submitted you cannot change your answers.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && (
            <div className="space-y-5">
              {/* Quiz Attempts */}
              <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
                  <Award className="h-4 w-4 text-emerald-500 flex-shrink-0" strokeWidth={1.8} />
                  <div>
                    <h2 className="apple-title">Quiz Attempts</h2>
                    <p className="apple-subtitle">All completed quiz sessions and your scores.</p>
                  </div>
                </div>
                <div className="p-5">
                  {attemptsList.filter(a => a.isCompleted).length === 0 ? (
                    <div className="apple-empty-state">
                      <div className="apple-empty-state__icon"><Award className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
                      <p className="apple-empty-state__title">No completed quizzes yet</p>
                      <p className="apple-empty-state__body">Once you complete a quiz, your score and date will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attemptsList.filter(a => a.isCompleted).map((attempt) => (
                        <div key={attempt.id} className="flex items-center justify-between p-4 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{attempt.quiz?.title || "Quiz"}</p>
                            <div className="flex items-center gap-3 text-[10.5px] font-mono text-[#6e6e73] dark:text-white/40 mt-0.5 flex-wrap">
                              {attempt.quiz?.course?.code && (
                                <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">{attempt.quiz.course.code}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </span>
                            </div>
                          </div>
                          <span className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border ${
                            (attempt.score ?? 0) >= 50
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                              : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30"
                          }`}>
                            {attempt.score?.toFixed(1) ?? "0.0"}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Exam Submissions */}
              <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.06 }}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
                  <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" strokeWidth={1.8} />
                  <div>
                    <h2 className="apple-title">Written Exams</h2>
                    <p className="apple-subtitle">Your submitted exam papers and AI-generated grades.</p>
                  </div>
                </div>
                <div className="p-5">
                  {examSubmissions.length === 0 ? (
                    <div className="apple-empty-state">
                      <div className="apple-empty-state__icon"><Upload className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
                      <p className="apple-empty-state__title">No exam submissions yet</p>
                      <p className="apple-empty-state__body">Your written exam submissions and AI grades will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {examSubmissions.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between p-4 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{sub.exam?.title || "Exam"}</p>
                            <div className="flex items-center gap-3 text-[10.5px] font-mono text-[#6e6e73] dark:text-white/40 mt-0.5 flex-wrap">
                              {sub.exam?.course?.code && (
                                <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">{sub.exam.course.code}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(sub.submittedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            {sub.isGraded && sub.feedback && (
                              <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-1 line-clamp-1 italic">{sub.feedback}</p>
                            )}
                          </div>
                          {sub.isGraded ? (() => {
                            const pct = sub.totalMarks ? (sub.score / sub.totalMarks) * 100 : (sub.score ?? 0);
                            const pass = pct >= 50;
                            return (
                              <span className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border ${
                                pass
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                                  : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30"
                              }`}>
                                {sub.totalMarks ? `${sub.score?.toFixed(1)} / ${sub.totalMarks}` : `${sub.score?.toFixed(1) ?? "0.0"}%`}
                              </span>
                            );
                          })() : (
                            <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Pending
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Assignment Submissions in history */}
              {assignmentSubmissionHistory.length > 0 && (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.12 }}>
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
                    <Pencil className="h-4 w-4 text-emerald-500 flex-shrink-0" strokeWidth={1.8} />
                    <div>
                      <h2 className="apple-title">Assignments</h2>
                      <p className="apple-subtitle">Your submitted assignments and grades.</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-2">
                      {assignmentSubmissionHistory.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between p-4 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{sub.assignment?.title || "Assignment"}</p>
                            <div className="flex items-center gap-3 text-[10.5px] font-mono text-[#6e6e73] dark:text-white/40 mt-0.5 flex-wrap">
                              {sub.assignment?.course?.code && (
                                <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">{sub.assignment.course.code}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(sub.submittedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            {sub.isGraded && sub.feedback && (
                              <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-1 line-clamp-1 italic">{sub.feedback}</p>
                            )}
                          </div>
                          {sub.isGraded ? (() => {
                            const pct = sub.totalMarks ? (sub.score / sub.totalMarks) * 100 : (sub.score ?? 0);
                            const pass = pct >= 50;
                            return (
                              <span className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border ${
                                pass
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                                  : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30"
                              }`}>
                                {sub.totalMarks ? `${sub.score?.toFixed(1)} / ${sub.totalMarks}` : `${sub.score?.toFixed(1) ?? "0.0"}%`}
                              </span>
                            );
                          })() : (
                            <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Pending
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          </div>{/* /max-w-5xl */}
        </main>
      </div>

      {/* ── MOBILE BOTTOM DOCK ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-5 pb-7 pt-2" aria-label="Main navigation">
        <div className="apple-bottom-dock flex items-center justify-around h-[60px] px-3">
          {(["notes", "quizzes", "exams", "assignments", "live-classroom"] as const).map((id) => {
            const isActive = activeTab === id;
            const label = id === "notes" ? "Materials" : id === "quizzes" ? "Quizzes" : id === "exams" ? "Exams" : id === "assignments" ? "Assign" : "Live";
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex flex-col items-center justify-center gap-[5px] min-w-[52px] min-h-[44px] px-1 rounded-[14px] transition-all"
                style={{ transform: isActive ? "scale(1.06)" : "scale(1)", transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                {id === "notes" && <FileText className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`} strokeWidth={isActive ? 2.2 : 1.6} />}
                {id === "quizzes" && <Award className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`} strokeWidth={isActive ? 2.2 : 1.6} />}
                {id === "exams" && <Upload className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`} strokeWidth={isActive ? 2.2 : 1.6} />}
                {id === "assignments" && <Pencil className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`} strokeWidth={isActive ? 2.2 : 1.6} />}
                {id === "live-classroom" && !isActive ? (
                  <span className="relative flex items-center justify-center h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-60" />
                    <Radio className="relative h-5 w-5 text-[#8e8e93]" strokeWidth={1.6} />
                  </span>
                ) : id === "live-classroom" ? (
                  <Radio className="h-5 w-5 text-emerald-500" strokeWidth={2.2} />
                ) : null}
                <span className={`text-[9.5px] font-semibold tracking-[0.01em] transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`}>
                  {label}
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
