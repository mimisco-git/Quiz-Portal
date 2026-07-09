import React, { useState, useEffect, useRef, useCallback } from "react";
import TurndownService from "turndown";
import { GraduationCap, BookOpen, PlusCircle, Trash2, Award, ClipboardList, Check, Save, Radio, Users, Send, MessageSquare, AlertTriangle, Download, Sun, Moon, Camera, LogOut, FileText, Upload, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Mic, Layers, BarChart2, ThumbsUp, ArrowLeft, CheckCircle, X, Pencil, Copy, Trophy, Megaphone, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { Course, LectureNote, Quiz, StudentAttempt, Question } from "../types";
import UserAvatar from "./UserAvatar";
import NotificationBell from "./NotificationBell";
import CalendarView from "./CalendarView";
import MarkdownView from "./MarkdownView";
import AvatarModal from "./AvatarModal";
import { motion, AnimatePresence } from "motion/react";
import SlideView from "./SlideView";
import DiscussionBoard from "./DiscussionBoard";
import LiveAudioRoom, { type LiveAudioRoomHandle } from "./LiveAudioRoom";
import OnboardingTour from "./OnboardingTour";

interface LecturerDashboardProps {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
}

export default function LecturerDashboard({ token, user, theme, onToggleTheme, onLogout }: LecturerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"gradebook" | "notes" | "quizzes" | "courses" | "departments" | "live-lecture" | "exams" | "assignments" | "announcements" | "analytics" | "calendar" | "discussions">("gradebook");
  const [showTour, setShowTour] = useState<boolean>(() => {
    try { return !localStorage.getItem("tour_done_lecturer"); } catch { return false; }
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lecturerDepts, setLecturerDepts] = useState<string[]>([]);
  const [mobileLecturerOpen, setMobileLecturerOpen] = useState(false);
  const [lecturerAnalytics, setLecturerAnalytics] = useState<any | null>(null);
  const [lecturerAnalyticsLoading, setLecturerAnalyticsLoading] = useState(false);

  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDepId, setCourseDepId] = useState("");
  const [courseTargetYear, setCourseTargetYear] = useState("");
  const [deptStats, setDeptStats] = useState<any[]>([]);

  const [noteCourseId, setNoteCourseId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [publishedNotes, setPublishedNotes] = useState<LectureNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [docxImporting, setDocxImporting] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  const [quizCourseId, setQuizCourseId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDuration, setQuizDuration] = useState("10");
  const [quizAvailableFrom, setQuizAvailableFrom] = useState("");
  const [quizAvailableUntil, setQuizAvailableUntil] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<
    Array<{ uid: string; text: string; options: string[]; correctOption: string }>
  >([{ uid: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctOption: "" }]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseDocError, setParseDocError] = useState<string | null>(null);
  const parseFileInputRef = useRef<HTMLInputElement>(null);

  // AI question generation
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenTopic, setAiGenTopic] = useState("");
  const [aiGenCount, setAiGenCount] = useState("10");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);

  // Question bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  // Edit quiz
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState("");
  const [editQuizDuration, setEditQuizDuration] = useState("10");
  const [editAvailableFrom, setEditAvailableFrom] = useState("");
  const [editAvailableUntil, setEditAvailableUntil] = useState("");
  const [editQuestions, setEditQuestions] = useState<Array<{ uid: string; text: string; options: string[]; correctOption: string }>>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Analytics modal
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [analyticsQuizTitle, setAnalyticsQuizTitle] = useState("");
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annCourseId, setAnnCourseId] = useState("");
  const [isPostingAnn, setIsPostingAnn] = useState(false);

  const [newDeptName, setNewDeptName] = useState("");

  const [liveCourseId, setLiveCourseId] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveContent, setLiveContent] = useState("");
  const [broadcastingSession, setBroadcastingSession] = useState<any | null>(null);
  const [liveChats, setLiveChats] = useState<any[]>([]);
  const [lecturerChatMessage, setLecturerChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioRoomRef = useRef<LiveAudioRoomHandle>(null);

  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState("");
  const [editingRowType, setEditingRowType] = useState<"quiz" | "exam" | "assignment">("quiz");

  const [quizList, setQuizList] = useState<any[]>([]);

  // ── Exam state ──────────────────────────────────────────────────
  const [exams, setExams] = useState<any[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [examCourseId, setExamCourseId] = useState("");
  const [examAvailableFrom, setExamAvailableFrom] = useState("");
  const [examAvailableUntil, setExamAvailableUntil] = useState("");
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examQText, setExamQText] = useState("");
  const [isParsingExam, setIsParsingExam] = useState(false);
  const [examParsedStructure, setExamParsedStructure] = useState<any[] | null>(null);
  const [examExtractedText, setExamExtractedText] = useState("");
  const [examQMarks, setExamQMarks] = useState<Record<string, string>>({});
  const [examQAnswers, setExamQAnswers] = useState<Record<string, string>>({});
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [examSubmissions, setExamSubmissions] = useState<any[]>([]);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [answerKeyMarks, setAnswerKeyMarks] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [gradingProgress, setGradingProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // ── Assignment state ─────────────────────────────────────────────
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentCourseId, setAssignmentCourseId] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentQText, setAssignmentQText] = useState("");
  const [isParsingAssignment, setIsParsingAssignment] = useState(false);
  const [assignmentParsedStructure, setAssignmentParsedStructure] = useState<any[] | null>(null);
  const [assignmentExtractedText, setAssignmentExtractedText] = useState("");
  const [assignmentQMarks, setAssignmentQMarks] = useState<Record<string, string>>({});
  const [assignmentQAnswers, setAssignmentQAnswers] = useState<Record<string, string>>({});
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);
  const [assignmentKeyFile, setAssignmentKeyFile] = useState<File | null>(null);
  const [assignmentKeyText, setAssignmentKeyText] = useState("");
  const [assignmentKeyMarks, setAssignmentKeyMarks] = useState("");
  const [isGradingAssignment, setIsGradingAssignment] = useState(false);
  const [gradingAssignmentProgress, setGradingAssignmentProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [expandedAssignmentSub, setExpandedAssignmentSub] = useState<string | null>(null);
  const [manualScoreInputs, setManualScoreInputs] = useState<Record<string, string>>({});

  const [liveSubTab, setLiveSubTab] = useState<"audio" | "slides" | "poll" | "attendance" | "chat">("slides");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Option A", "Option B", "Option C", "Option D"]);
  const [attachLiveFile, setAttachLiveFile] = useState<File | null>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [isUploadingPptx, setIsUploadingPptx] = useState(false);
  const [preLaunchPptxFile, setPreLaunchPptxFile] = useState<File | null>(null);
  const [isParsingPptx, setIsParsingPptx] = useState(false);
  const [parsedSlideCount, setParsedSlideCount] = useState<number | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterQuizId, setFilterQuizId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCourses();
    fetchGradebook();
    fetchDepartments();
    fetchPublishedNotes();
    fetch("/api/lecturer/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLecturerDepts(d.departments || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    if (activeTab === "live-lecture" && broadcastingSession) {
      const pollLiveDetails = async () => {
        try {
          const res = await fetch(`/api/lectures/active/${broadcastingSession.courseId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data) {
              setBroadcastingSession(data);
              setLiveChats(data.chats || []);
            } else {
              setBroadcastingSession(null);
              setLiveChats([]);
            }
          }
        } catch (e) {
          console.error("Error polling live lecture:", e);
        }
      };
      pollLiveDetails();
      interval = setInterval(pollLiveDetails, 4000);
    }
    return () => clearInterval(interval);
  }, [activeTab, broadcastingSession?.courseId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveChats]);

  useEffect(() => {
    if (activeTab === "quizzes") fetchQuizList();
    if (activeTab === "exams") fetchExams();
    if (activeTab === "assignments") fetchAssignments();
    if (activeTab === "announcements") fetchAnnouncements();
    if (activeTab === "analytics" && !lecturerAnalytics) {
      setLecturerAnalyticsLoading(true);
      fetch("/api/lecturer/analytics", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setLecturerAnalytics(d); })
        .catch(() => {})
        .finally(() => setLecturerAnalyticsLoading(false));
    }
  }, [activeTab]);


  // Keyboard arrow-key slide navigation for lecturer
  useEffect(() => {
    if (!broadcastingSession || liveSubTab !== "slides") return;
    const slides = broadcastingSession.content.split(/^---$/m).map((s: string) => s.trim()).filter(Boolean);
    const safeSlide = Math.min(broadcastingSession.currentSlide ?? 0, slides.length - 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); handleSlideChange(Math.min(slides.length - 1, safeSlide + 1)); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); handleSlideChange(Math.max(0, safeSlide - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [broadcastingSession, liveSubTab]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0) {
          setNoteCourseId(data[0].id);
          setQuizCourseId(data[0].id);
          setLiveCourseId(data[0].id);
          setExamCourseId(data[0].id);
          setAssignmentCourseId(data[0].id);
          checkActiveLectureOnLoad(data);
        }
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizList = async () => {
    try {
      const res = await fetch("/api/quizzes", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setQuizList(await res.json());
    } catch (err) {
      console.error("Error fetching quiz list:", err);
    }
  };

  const handleDeleteQuiz = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Delete "${quizTitle}" and all student attempts for it? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        showSuccess("Quiz deleted successfully.");
        fetchQuizList();
        fetchGradebook();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to delete quiz");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/exams", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setExams(await res.json());
    } catch (err) {
      console.error("Error fetching exams:", err);
    }
  };

  const fetchExamSubmissions = async (examId: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}/submissions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setExamSubmissions(await res.json());
    } catch (err) {
      console.error("Error fetching submissions:", err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/assignments", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignments(await res.json());
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  const fetchAssignmentSubmissions = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignmentSubmissions(await res.json());
    } catch (err) {
      console.error("Error fetching assignment submissions:", err);
    }
  };

  const handleParseAssignmentQuestions = async () => {
    if (!assignmentFile && !assignmentQText.trim()) { showError("Upload a file or paste questions first"); return; }
    setIsParsingAssignment(true);
    try {
      const fd = new FormData();
      if (assignmentFile) fd.append("file", assignmentFile);
      else fd.append("questionsText", assignmentQText);
      const res = await fetch("/api/parse-questions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        const d = await res.json();
        setAssignmentParsedStructure(d.structure);
        setAssignmentExtractedText(d.questionsText);
        setAssignmentQMarks({}); setAssignmentQAnswers({});
      } else {
        const d = await res.json(); showError(d.error || "Failed to parse questions");
      }
    } catch { showError("Failed to parse questions"); }
    finally { setIsParsingAssignment(false); }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim() || !assignmentCourseId) { showError("Title and course are required"); return; }
    if (!assignmentParsedStructure) { showError("Parse questions first before creating the assignment"); return; }
    const hasMarks = (Object.values(assignmentQMarks) as string[]).some((v) => parseFloat(v) > 0);
    if (!hasMarks) { showError("Enter marks for at least one question before creating the assignment"); return; }
    try {
      const fd = new FormData();
      fd.append("title", assignmentTitle);
      fd.append("courseId", assignmentCourseId);
      if (assignmentDescription.trim()) fd.append("description", assignmentDescription);
      fd.append("questionsText", assignmentExtractedText);
      fd.append("questionsStructureJson", JSON.stringify(assignmentParsedStructure));
      fd.append("answerKeyJson", buildAnswerKeyJson(assignmentParsedStructure, assignmentQMarks, assignmentQAnswers));
      if (assignmentDueDate) fd.append("dueDate", new Date(assignmentDueDate).toISOString());
      const res = await fetch("/api/assignments", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Assignment created!");
        setAssignmentTitle(""); setAssignmentFile(null); setAssignmentQText(""); setAssignmentDescription(""); setAssignmentDueDate("");
        setAssignmentParsedStructure(null); setAssignmentExtractedText(""); setAssignmentQMarks({}); setAssignmentQAnswers({});
        fetchAssignments();
      } else {
        const d = await res.json(); showError(d.error || "Failed to create assignment");
      }
    } catch { showError("Failed to create assignment"); }
  };

  const handleUploadAssignmentKey = async (assignmentId: string) => {
    if (!assignmentKeyFile && !assignmentKeyText.trim()) { showError("Upload or paste an answer key"); return; }
    try {
      const fd = new FormData();
      if (assignmentKeyFile) fd.append("file", assignmentKeyFile);
      else fd.append("answerKeyText", assignmentKeyText);
      if (assignmentKeyMarks.trim()) fd.append("marksText", assignmentKeyMarks.trim());
      const res = await fetch(`/api/assignments/${assignmentId}/answer-key`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Answer key uploaded!");
        const updated = await res.json();
        setSelectedAssignment(updated);
        setAssignmentKeyFile(null); setAssignmentKeyText(""); setAssignmentKeyMarks("");
        fetchAssignments();
      } else {
        const d = await res.json(); showError(d.error || "Failed to upload answer key");
      }
    } catch { showError("Failed to upload answer key"); }
  };

  const handleGradeAll = async (examId: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}/grade`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok) { showError(d.error || "Failed to start grading"); return; }
      if (!d.started) { showSuccess(d.message); return; }
      setIsGrading(true);
      setGradingProgress({ done: 0, total: d.total, errors: 0 });
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`/api/exams/${examId}/grading-status`, { headers: { Authorization: `Bearer ${token}` } });
          const s = await sr.json();
          setGradingProgress({ done: s.done, total: s.total, errors: s.errors });
          if (!s.inProgress) {
            clearInterval(poll);
            setIsGrading(false);
            setGradingProgress(null);
            fetchExamSubmissions(examId);
            const ok = s.total - s.errors;
            showSuccess(`AI graded ${ok} submission${ok !== 1 ? "s" : ""}${s.errors ? ` (${s.errors} failed)` : ""}.`);
          }
        } catch { clearInterval(poll); setIsGrading(false); setGradingProgress(null); }
      }, 3000);
    } catch (err: any) { showError(err.message); }
  };

  const handleGradeAssignments = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/grade`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok) { showError(d.error || "Failed to start grading"); return; }
      if (!d.started) { showSuccess(d.message); return; }
      setIsGradingAssignment(true);
      setGradingAssignmentProgress({ done: 0, total: d.total, errors: 0 });
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`/api/assignments/${assignmentId}/grading-status`, { headers: { Authorization: `Bearer ${token}` } });
          const s = await sr.json();
          setGradingAssignmentProgress({ done: s.done, total: s.total, errors: s.errors });
          if (!s.inProgress) {
            clearInterval(poll);
            setIsGradingAssignment(false);
            setGradingAssignmentProgress(null);
            fetchAssignmentSubmissions(assignmentId);
            const ok = s.total - s.errors;
            showSuccess(`AI graded ${ok} submission${ok !== 1 ? "s" : ""}${s.errors ? ` (${s.errors} failed)` : ""}.`);
          }
        } catch { clearInterval(poll); setIsGradingAssignment(false); setGradingAssignmentProgress(null); }
      }, 3000);
    } catch { showError("Grading failed"); }
  };

  const handleAddMarks = async (type: "exam" | "assignment", parentId: string, subId: string) => {
    const addedStr = manualScoreInputs[subId];
    if (!addedStr || isNaN(parseFloat(addedStr)) || parseFloat(addedStr) < 0) { showError("Enter a valid number of marks to add"); return; }
    try {
      const url = type === "exam"
        ? `/api/exams/${parentId}/submissions/${subId}/grade`
        : `/api/assignments/${parentId}/submissions/${subId}/grade`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ added: parseFloat(addedStr) }),
      });
      if (res.ok) {
        showSuccess("Marks added!");
        setManualScoreInputs(prev => { const n = { ...prev }; delete n[subId]; return n; });
        if (type === "exam") fetchExamSubmissions(parentId);
        else fetchAssignmentSubmissions(parentId);
      } else {
        const d = await res.json(); showError(d.error || "Failed to add marks");
      }
    } catch { showError("Failed to add marks"); }
  };

  const handleToggleAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { fetchAssignments(); if (selectedAssignment?.id === assignmentId) setSelectedAssignment(await res.json()); }
    } catch { showError("Failed to toggle assignment"); }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Delete this assignment and all submissions?")) return;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showSuccess("Assignment deleted."); setSelectedAssignment(null); setAssignmentSubmissions([]); fetchAssignments(); }
    } catch { showError("Failed to delete assignment"); }
  };

  const checkActiveLectureOnLoad = async (allCourses: Course[]) => {
    for (const c of allCourses) {
      if (c.lecturerId !== user.id) continue;
      try {
        const res = await fetch(`/api/lectures/active/${c.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.isActive) {
            setBroadcastingSession(data);
            setLiveCourseId(c.id);
            setLiveTopic(data.topic);
            setLiveContent(data.content);
            setLiveChats(data.chats || []);
            break;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const fetchGradebook = async () => {
    try {
      const res = await fetch("/api/lecturer/gradebook", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAttempts(data);
      }
    } catch (err) {
      console.error("Error fetching gradebook:", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (e) {
      console.error("Error fetching departments:", e);
    }
  };

  const fetchDeptStats = async () => {
    try {
      const res = await fetch("/api/departments/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDeptStats(await res.json());
    } catch (e) {
      console.error("Error fetching department stats:", e);
    }
  };

  const handleToggleLecturerDept = async (deptName: string) => {
    const updated = lecturerDepts.includes(deptName)
      ? lecturerDepts.filter(d => d !== deptName)
      : [...lecturerDepts, deptName];
    setLecturerDepts(updated);
    try {
      await fetch("/api/lecturer/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ departments: updated }),
      });
    } catch { setLecturerDepts(lecturerDepts); }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseTitle) return;
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: courseCode, title: courseTitle, departmentId: courseDepId || undefined, targetYear: courseTargetYear || undefined }),
      });
      if (res.ok) {
        showSuccess(`Course module ${courseCode} successfully registered.`);
        setCourseCode("");
        setCourseTitle("");
        setCourseDepId("");
        setCourseTargetYear("");
        fetchCourses();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to create course");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchPublishedNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const r = await fetch("/api/notes", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setPublishedNotes(await r.json());
    } catch {}
    setNotesLoading(false);
  }, [token]);

  const handleDeleteNote = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/notes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        showSuccess("Note deleted.");
        setPublishedNotes(prev => prev.filter(n => n.id !== id));
      } else {
        showError("Failed to delete note.");
      }
    } catch { showError("Failed to delete note."); }
  };

  const handleDocxImport = async (file: File) => {
    setDocxImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/notes/parse-docx", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) { showError("Failed to parse document."); return; }
      const { html } = await r.json();
      const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
      const md = td.turndown(html);
      setNoteContent(md);
      showSuccess("Document imported — review and publish.");
    } catch { showError("Failed to import document."); }
    setDocxImporting(false);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
    const md = td.turndown(html);
    const ta = noteTextareaRef.current;
    if (!ta) { setNoteContent(prev => prev + md); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setNoteContent(prev => prev.slice(0, start) + md + prev.slice(end));
    // Restore cursor after insertion
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + md.length;
    });
  }, []);

  const handlePublishNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteCourseId || !noteTitle || !noteContent) {
      showError("Please fill out all fields.");
      return;
    }
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: noteCourseId, title: noteTitle, content: noteContent }),
      });
      if (res.ok) {
        showSuccess(`Study Note "${noteTitle}" published successfully!`);
        setNoteTitle("");
        setNoteContent("");
        fetchCourses();
        fetchPublishedNotes();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to publish study note");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleQuizQuestionChange = (index: number, field: string, value: string, optIndex?: number) => {
    const updated = [...quizQuestions];
    if (field === "text") {
      updated[index].text = value;
    } else if (field === "correctOption") {
      updated[index].correctOption = value;
    } else if (field === "option" && optIndex !== undefined) {
      const oldText = updated[index].options[optIndex];
      updated[index].options[optIndex] = value;
      // If the correct answer was pointing at this option, clear it so the stale
      // value doesn't silently block form submission via HTML5 required validation
      if (updated[index].correctOption === oldText) {
        updated[index].correctOption = "";
      }
    }
    setQuizQuestions(updated);
  };

  const handleAddQuestionRow = () => {
    setQuizQuestions((prev) => [...prev, { uid: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctOption: "" }]);
  };

  const handleParseDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setParseDocError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quizzes/parse-questions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setParseDocError(data.error || "Failed to parse document"); return; }
      const mapped = (data.questions as { text: string; options: string[]; correctOption: string }[]).map((q) => ({
        uid: crypto.randomUUID(),
        text: q.text,
        options: [...q.options.slice(0, 4), ...Array(Math.max(0, 4 - q.options.length)).fill("")].slice(0, 4),
        correctOption: q.correctOption,
      }));
      setQuizQuestions(mapped);
    } catch (err: any) {
      setParseDocError(err.message || "Upload failed");
    } finally {
      setIsParsing(false);
      if (parseFileInputRef.current) parseFileInputRef.current.value = "";
    }
  };

  const handleRemoveQuestionRow = (index: number) => {
    if (quizQuestions.length === 1) return;
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAiGenerateQuestions = async () => {
    if (!aiGenTopic.trim()) return;
    setAiGenLoading(true);
    setAiGenError(null);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: aiGenTopic, count: parseInt(aiGenCount, 10) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Generation failed");
      const data: Array<{ text: string; options: string[]; correctOption: string }> = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("No questions returned");
      const newQs = data.map(q => ({ uid: crypto.randomUUID(), text: q.text, options: q.options, correctOption: q.correctOption }));
      setQuizQuestions(prev => {
        // Replace default empty question if that's the only one
        if (prev.length === 1 && !prev[0].text.trim()) return newQs;
        return [...prev, ...newQs];
      });
      setAiGenOpen(false);
      setAiGenTopic("");
      showSuccess(`${data.length} questions generated!`);
    } catch (err: any) {
      setAiGenError(err.message || "Failed to generate questions");
    } finally {
      setAiGenLoading(false);
    }
  };

  const fetchBank = async () => {
    setBankLoading(true);
    try {
      const res = await fetch("/api/question-bank", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setBankQuestions(await res.json());
    } finally {
      setBankLoading(false);
    }
  };

  const saveQuestionToBank = async (q: { text: string; options: string[]; correctOption: string }, topic?: string) => {
    await fetch("/api/question-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: q.text, optionsJson: JSON.stringify(q.options), correctOption: q.correctOption, topic: topic ?? "" }),
    });
    showSuccess("Question saved to bank!");
  };

  const addFromBank = (bq: any) => {
    const opts: string[] = JSON.parse(bq.optionsJson);
    setQuizQuestions(prev => {
      if (prev.length === 1 && !prev[0].text.trim()) {
        return [{ uid: crypto.randomUUID(), text: bq.text, options: opts, correctOption: bq.correctOption }];
      }
      return [...prev, { uid: crypto.randomUUID(), text: bq.text, options: opts, correctOption: bq.correctOption }];
    });
  };

  const openEditQuiz = (quiz: any) => {
    setEditingQuiz(quiz);
    setEditQuizTitle(quiz.title);
    setEditQuizDuration(String(quiz.durationMinutes));
    setEditAvailableFrom(quiz.availableFrom ? new Date(quiz.availableFrom).toISOString().slice(0, 16) : "");
    setEditAvailableUntil(quiz.availableUntil ? new Date(quiz.availableUntil).toISOString().slice(0, 16) : "");
    // Load full quiz questions
    fetch(`/api/quizzes/${quiz.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setEditQuestions((data.questions || []).map((q: any) => ({
          uid: q.id,
          text: q.text,
          options: JSON.parse(q.optionsJson),
          correctOption: q.correctOption,
        })));
      });
  };

  const handleEditQuestionChange = (idx: number, field: string, value: string, optIdx?: number) => {
    setEditQuestions(prev => prev.map((q, i) => {
      if (i !== idx) return q;
      if (field === "text") return { ...q, text: value };
      if (field === "correctOption") return { ...q, correctOption: value };
      if (field === "option" && optIdx !== undefined) {
        const opts = [...q.options]; opts[optIdx] = value; return { ...q, options: opts };
      }
      return q;
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingQuiz) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/quizzes/${editingQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editQuizTitle,
          durationMinutes: parseInt(editQuizDuration),
          availableFrom: editAvailableFrom ? new Date(editAvailableFrom).toISOString() : undefined,
          availableUntil: editAvailableUntil ? new Date(editAvailableUntil).toISOString() : undefined,
          questions: editQuestions.map(q => ({ text: q.text, options: q.options, correctOption: q.correctOption })),
        }),
      });
      if (res.ok) { showSuccess("Quiz updated successfully."); setEditingQuiz(null); fetchQuizList(); }
      else { const d = await res.json(); showError(d.error || "Update failed"); }
    } catch (e: any) { showError(e.message); }
    finally { setIsSavingEdit(false); }
  };

  const handleDuplicateQuiz = async (quizId: string, title: string) => {
    try {
      const res = await fetch(`/api/quizzes/${quizId}/duplicate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showSuccess(`"${title}" duplicated.`); fetchQuizList(); }
      else { const d = await res.json(); showError(d.error || "Failed to duplicate"); }
    } catch (e: any) { showError(e.message); }
  };

  const handleShowAnalytics = async (quizId: string, title: string) => {
    setAnalyticsQuizTitle(title);
    setAnalyticsData(null);
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/analytics`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAnalyticsData(await res.json());
      else { const d = await res.json(); showError(d.error || "Failed to load analytics"); }
    } catch (e: any) { showError(e.message); }
    finally { setIsLoadingAnalytics(false); }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAnnouncements(await res.json());
    } catch {}
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    setIsPostingAnn(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: annTitle, body: annBody, courseId: annCourseId || undefined }),
      });
      if (res.ok) { showSuccess("Announcement posted."); setAnnTitle(""); setAnnBody(""); setAnnCourseId(""); fetchAnnouncements(); }
      else { const d = await res.json(); showError(d.error || "Failed to post"); }
    } catch (e: any) { showError(e.message); }
    finally { setIsPostingAnn(false); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) fetchAnnouncements();
  };

  const handleDeployQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizCourseId || !quizTitle || !quizDuration) {
      showError("Please provide Quiz metadata.");
      return;
    }
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.text.trim()) { showError(`Question ${i + 1} has no text question.`); return; }
      if (q.options.some((o) => !o.trim())) { showError(`Question ${i + 1} is missing option values.`); return; }
      if (!q.correctOption.trim()) { showError(`Question ${i + 1} must have a designated correct answer.`); return; }
    }
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courseId: quizCourseId,
          title: quizTitle,
          durationMinutes: parseInt(quizDuration),
          questions: quizQuestions,
          availableFrom: quizAvailableFrom ? new Date(quizAvailableFrom).toISOString() : undefined,
          availableUntil: quizAvailableUntil ? new Date(quizAvailableUntil).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        showSuccess(`Exam Quiz "${quizTitle}" deployed successfully!`);
        setQuizTitle("");
        setQuizDuration("10");
        setQuizAvailableFrom("");
        setQuizAvailableUntil("");
        setQuizQuestions([{ uid: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctOption: "" }]);
        fetchGradebook();
        fetchQuizList();
      } else {
        const d = await res.json();
        showError(d.detail ? `${d.error}: ${d.detail}` : d.error || "Failed to deploy quiz");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleSaveScoreAdjustment = async (rowId: string) => {
    if (!editingScore) return;
    const url = editingRowType === "quiz"
      ? `/api/attempts/${rowId}/score`
      : editingRowType === "exam"
        ? `/api/exam-submissions/${rowId}/score`
        : `/api/assignment-submissions/${rowId}/score`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: parseFloat(editingScore) }),
      });
      if (res.ok) {
        showSuccess("Score updated successfully.");
        setEditingAttemptId(null);
        fetchGradebook();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to update score");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleDownloadExcel = () => {
    if (attempts.length === 0) { showError("No records available to export."); return; }
    const toExport = attempts.filter((att) => {
      if (filterCourseId && att.courseId !== filterCourseId) return false;
      if (filterQuizId && att.assessmentId !== filterQuizId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!att.studentName?.toLowerCase().includes(q) && !att.regNumber?.toLowerCase().includes(q) && !att.department?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (toExport.length === 0) { showError("No records matching the current filters to export."); return; }

    const scoreLabel = (att: any) => {
      if (att.status === "not_submitted") return "-";
      if (att.type === "quiz") return att.score !== null ? `${att.score.toFixed(1)}%` : "Pending";
      if (att.totalMarks) return att.isGraded && att.score !== null ? `${att.score}/${att.totalMarks}` : "Pending";
      return att.isGraded && att.score !== null ? `${att.score.toFixed(1)}%` : "Pending";
    };

    const headers = ["Student Name","Reg. Number","Department","Year","Course Code","Course Title","Type","Assessment Title","Status","Score","Date Submitted"];
    const rows = toExport.map((att) => [
      att.studentName || "",
      att.regNumber || "",
      att.department || "",
      att.year || "",
      att.courseCode || "",
      att.courseTitle || "",
      att.type === "quiz" ? "Quiz" : att.type === "exam" ? "Written Exam" : "Assignment",
      att.assessmentTitle || "",
      att.status === "not_submitted" ? "NOT SUBMITTED" : att.status === "in_progress" ? "IN PROGRESS" : "SUBMITTED",
      scoreLabel(att),
      att.submittedAt ? new Date(att.submittedAt).toLocaleString() : "-",
    ]);

    const escape = (val: any) => { const s = String(val).replace(/"/g, '""'); return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s; };
    const csvContent = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    let fileName = "FUTO_Gradebook";
    if (filterCourseId) { const c = courses.find(c => c.id === filterCourseId); if (c) fileName += `_${c.code}`; }
    fileName += `_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess("Gradebook downloaded successfully!");
  };

  const buildAnswerKeyJson = (structure: any[], marks: Record<string, string>, answers: Record<string, string>) => {
    const items: { qLabel: string; answer: string; marks: number }[] = [];
    for (const q of structure) {
      if (q.subqs?.length > 0) {
        for (const sq of q.subqs) {
          const key = `${q.label}${sq.label}`;
          items.push({ qLabel: key, answer: answers[key] ?? "", marks: parseFloat(marks[key] ?? "0") || 0 });
        }
      } else {
        items.push({ qLabel: q.label, answer: answers[q.label] ?? "", marks: parseFloat(marks[q.label] ?? "0") || 0 });
      }
    }
    return JSON.stringify(items);
  };

  const handleParseExamQuestions = async () => {
    if (!examFile && !examQText.trim()) { showError("Upload a file or paste questions first"); return; }
    setIsParsingExam(true);
    try {
      const fd = new FormData();
      if (examFile) fd.append("file", examFile);
      else fd.append("questionsText", examQText);
      const res = await fetch("/api/parse-questions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        const d = await res.json();
        setExamParsedStructure(d.structure);
        setExamExtractedText(d.questionsText);
        setExamQMarks({}); setExamQAnswers({});
      } else {
        const d = await res.json(); showError(d.error || "Failed to parse questions");
      }
    } catch { showError("Failed to parse questions"); }
    finally { setIsParsingExam(false); }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examCourseId) { showError("Title and course are required"); return; }
    if (!examParsedStructure) { showError("Parse questions first before creating the exam"); return; }
    const hasMarks = (Object.values(examQMarks) as string[]).some((v) => parseFloat(v) > 0);
    if (!hasMarks) { showError("Enter marks for at least one question before creating the exam"); return; }
    try {
      const fd = new FormData();
      fd.append("title", examTitle);
      fd.append("courseId", examCourseId);
      fd.append("questionsText", examExtractedText);
      fd.append("questionsStructureJson", JSON.stringify(examParsedStructure));
      fd.append("answerKeyJson", buildAnswerKeyJson(examParsedStructure, examQMarks, examQAnswers));
      if (examAvailableFrom) fd.append("availableFrom", new Date(examAvailableFrom).toISOString());
      if (examAvailableUntil) fd.append("availableUntil", new Date(examAvailableUntil).toISOString());
      const res = await fetch("/api/exams", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Exam created!");
        setExamTitle(""); setExamFile(null); setExamQText(""); setExamAvailableFrom(""); setExamAvailableUntil("");
        setExamParsedStructure(null); setExamExtractedText(""); setExamQMarks({}); setExamQAnswers({});
        fetchExams();
      } else {
        const d = await res.json(); showError(d.error || "Failed to create exam");
      }
    } catch (err: any) { showError(err.message); }
  };

  const handleUploadAnswerKey = async (examId: string) => {
    if (!answerKeyFile && !answerKeyText.trim()) { showError("Upload a file or paste the answer key text"); return; }
    try {
      const fd = new FormData();
      if (answerKeyFile) fd.append("file", answerKeyFile);
      else fd.append("answerKeyText", answerKeyText);
      if (answerKeyMarks.trim()) fd.append("marksText", answerKeyMarks.trim());
      const res = await fetch(`/api/exams/${examId}/answer-key`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Answer key uploaded!");
        setAnswerKeyFile(null); setAnswerKeyText(""); setAnswerKeyMarks("");
        const updated = await res.json();
        setSelectedExam(updated);
        fetchExams();
      } else {
        const d = await res.json(); showError(d.error || "Failed to upload answer key");
      }
    } catch (err: any) { showError(err.message); }
  };


  const handleToggleExam = async (examId: string) => {
    try {
      const res = await fetch(`/api/exams/${examId}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { fetchExams(); if (selectedExam?.id === examId) setSelectedExam(await res.json()); }
    } catch (err: any) { showError(err.message); }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm("Delete this exam and all submissions?")) return;
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showSuccess("Exam deleted."); setSelectedExam(null); fetchExams(); }
    } catch (err: any) { showError(err.message); }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newDeptName }),
      });
      if (res.ok) {
        showSuccess(`Department "${newDeptName}" registered successfully!`);
        setNewDeptName("");
        fetchDepartments();
      } else {
        const data = await res.json();
        showError(data.error || "Failed to register department");
      }
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleLaunchLiveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveCourseId || !liveTopic.trim() || !liveContent.trim()) {
      showError("Fill out all required live lecture fields");
      return;
    }
    try {
      const res = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: liveCourseId, topic: liveTopic, content: liveContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastingSession(data);
        showSuccess("Live Broadcast launched successfully. Virtual slides are active!");
      } else {
        const d = await res.json();
        showError(d.error || "Failed to launch lecture stream");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handlePreLaunchPptx = async (file: File) => {
    setPreLaunchPptxFile(file);
    setIsParsingPptx(true);
    setParsedSlideCount(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/lectures/parse-pptx", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setLiveContent(data.content);
        setParsedSlideCount(data.slideCount);
        showSuccess(`Extracted ${data.slideCount} slides from ${file.name}`);
      } else {
        showError(data.error || "Failed to parse PPT file");
        setPreLaunchPptxFile(null);
      }
    } catch (err: any) {
      showError(err.message);
      setPreLaunchPptxFile(null);
    } finally {
      setIsParsingPptx(false);
    }
  };

  const handleUpdateLiveLecture = async () => {
    if (!broadcastingSession || !liveContent.trim()) return;
    try {
      const res = await fetch(`/api/lectures/${broadcastingSession.id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: liveContent }),
      });
      if (res.ok) {
        setBroadcastingSession((prev: any) => prev ? { ...prev, topic: liveTopic, content: liveContent } : prev);
        showSuccess("Live board synced to all connected student panels!");
      } else {
        showError("Failed to sync broadcast content");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleEndLiveLecture = async () => {
    if (!broadcastingSession) return;
    try {
      const res = await fetch(`/api/lectures/${broadcastingSession.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBroadcastingSession(null);
        setLiveChats([]);
        setLiveTopic("");
        setLiveContent("");
        showSuccess("Live Virtual Class ended. Broadcast disconnected.");
      } else {
        showError("Failed to disconnect broadcast session");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleSendLecturerChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerChatMessage.trim() || !broadcastingSession) return;
    const msg = lecturerChatMessage.trim();
    setLecturerChatMessage("");
    setIsSendingChat(true);
    try {
      const res = await fetch(`/api/lectures/${broadcastingSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const chat = await res.json();
        setLiveChats((prev) => [...prev, chat]);
      }
    } catch (err) {
      console.error("Lecturer chat failed:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSlideChange = async (idx: number) => {
    if (!broadcastingSession) return;
    await fetch(`/api/lectures/${broadcastingSession.id}/slide`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slide: idx }),
    });
    setBroadcastingSession((prev: any) => prev ? { ...prev, currentSlide: idx } : prev);
  };

  const handleLaunchPoll = async () => {
    if (!broadcastingSession || !pollQuestion.trim()) { showError("Enter a poll question first"); return; }
    const filtered = pollOptions.filter(o => o.trim());
    if (filtered.length < 2) { showError("At least 2 options required"); return; }
    const res = await fetch(`/api/lectures/${broadcastingSession.id}/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: pollQuestion, options: filtered }),
    });
    if (res.ok) { showSuccess("Poll launched to students!"); setPollQuestion(""); }
    else { const d = await res.json(); showError(d.error || "Failed to launch poll"); }
  };

  const handleClosePoll = async () => {
    if (!broadcastingSession) return;
    await fetch(`/api/lectures/${broadcastingSession.id}/poll`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    showSuccess("Poll closed.");
  };

  const handleDismissHandRaise = async (raiseId: string) => {
    if (!broadcastingSession) return;
    await fetch(`/api/lectures/${broadcastingSession.id}/hand-raises/${raiseId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setBroadcastingSession((prev: any) => prev ? { ...prev, handRaises: (prev.handRaises || []).filter((h: any) => h.id !== raiseId) } : prev);
  };

  const handleAllowToSpeak = async (raiseId: string, studentName: string) => {
    if (!broadcastingSession) return;
    await fetch(`/api/lectures/${broadcastingSession.id}/hand-raises/${raiseId}/allow`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setBroadcastingSession((prev: any) => prev ? {
      ...prev,
      handRaises: (prev.handRaises || []).map((h: any) => h.id === raiseId ? { ...h, allowedToSpeak: true } : h),
    } : prev);
    audioRoomRef.current?.grantMic(studentName);
  };

  const handleMuteStudent = async (raiseId: string, studentName: string) => {
    if (!broadcastingSession) return;
    await fetch(`/api/lectures/${broadcastingSession.id}/hand-raises/${raiseId}/mute`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setBroadcastingSession((prev: any) => prev ? {
      ...prev,
      handRaises: (prev.handRaises || []).map((h: any) => h.id === raiseId ? { ...h, allowedToSpeak: false } : h),
    } : prev);
    audioRoomRef.current?.revokeMic(studentName);
  };

  const handleMuteAll = () => {
    audioRoomRef.current?.muteAll();
  };

  const handleAttachFile = async () => {
    if (!broadcastingSession || !attachLiveFile) return;
    const fd = new FormData(); fd.append("file", attachLiveFile);
    const res = await fetch(`/api/lectures/${broadcastingSession.id}/attachment`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (res.ok) { showSuccess(`"${attachLiveFile.name}" attached. Students can now download it.`); setAttachLiveFile(null); }
    else showError("Failed to attach file");
  };

  const handleUploadPptx = async () => {
    if (!broadcastingSession || !pptxFile) return;
    setIsUploadingPptx(true);
    const fd = new FormData(); fd.append("file", pptxFile);
    const res = await fetch(`/api/lectures/${broadcastingSession.id}/pptx`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (res.ok) {
      const data = await res.json();
      setBroadcastingSession((prev: any) => prev ? { ...prev, content: data.content, currentSlide: 0 } : prev);
      showSuccess(`PowerPoint loaded: ${data.slideCount} slides ready`);
      setPptxFile(null);
    } else {
      const d = await res.json().catch(() => ({}));
      showError(d.error || "Failed to parse PPTX");
    }
    setIsUploadingPptx(false);
  };

  const handleSummarize = async () => {
    if (!broadcastingSession) return;
    setIsSummarizing(true);
    const res = await fetch(`/api/lectures/${broadcastingSession.id}/summarize`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (res.ok) { setSessionSummary(d.summary); showSuccess("AI summary generated!"); }
    else showError(d.error || "Failed to generate summary");
    setIsSummarizing(false);
  };

  const filteredAttempts = attempts.filter((att) => {
    if (filterCourseId && att.courseId !== filterCourseId) return false;
    if (filterQuizId && att.assessmentId !== filterQuizId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!att.studentName?.toLowerCase().includes(q) && !att.regNumber?.toLowerCase().includes(q) && !att.department?.toLowerCase().includes(q) && !att.year?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ─── macOS nav button ─── */
  const navBtn = (id: string, label: string, icon: React.ReactNode, live?: boolean) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => {
          setActiveTab(id as any);
          if (id === "gradebook") fetchGradebook();
          if (id === "departments") { fetchDepartments(); fetchDeptStats(); }
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all cursor-pointer ${
          isActive
            ? "bg-emerald-500/[0.15] dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-400"
            : "text-[#3a3a3c] dark:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-[#1d1d1f] dark:hover:text-white/85"
        }`}
      >
        <span className={`flex-shrink-0 ${isActive ? "text-emerald-500" : ""}`}>{icon}</span>
        <span className="hidden sm:inline">{label}</span>
        {live && broadcastingSession && (
          <span className="ml-auto h-2 w-2 bg-red-500 rounded-full animate-ping flex-shrink-0 hidden sm:block" />
        )}
      </button>
    );
  };

  /* ─── label helper ─── */
  const lbl = "block text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400 mb-2";

  const sectionTitle: Record<string, string> = {
    gradebook: "Student Gradebook",
    "live-lecture": "Live Broadcast",
    notes: "Publish Study Notes",
    quizzes: "Deploy MCQ Quiz",
    exams: "Written Exams (AI)",
    assignments: "Assignments",
    courses: "Course Registry",
    announcements: "Announcements",
    departments: "Departments",
    analytics: "Analytics",
    calendar: "Calendar",
    discussions: "Discussions",
  };

  // Badge showing which dept/year students will receive a piece of content
  const audienceBadge = (courseId: string) => {
    const c = courses.find((x: any) => x.id === courseId);
    if (!c || !courseId) return null;
    const deptName = (c as any).department?.name;
    const yr = (c as any).targetYear;
    return (
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-medium text-[#6e6e73] dark:text-white/35">For:</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${deptName ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30"}`}>
          {deptName ?? "All Departments"}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${yr ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" : "bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-100 dark:border-white/[0.06]"}`}>
          {yr ?? "All Years"}
        </span>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden apple-window-bg dark:bg-[#141416] font-sans relative">

      {/* Onboarding tour — shown once to new lecturers */}
      {showTour && (
        <OnboardingTour role="lecturer" onDone={() => {
          setShowTour(false);
          try { localStorage.setItem("tour_done_lecturer", "1"); } catch { /* noop */ }
        }} />
      )}

      {/* Subtle radial bg gradients */}
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
                role="lecturer"
                size={34}
                initials={user.name}
                refreshTrigger={avatarRefreshTrigger}
                className="rounded-full ring-[1.5px] ring-black/10 dark:ring-white/15 shadow-sm"
              />
              <div className="absolute inset-0 bg-black/45 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="hidden sm:block min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-tight truncate">{user.name}</p>
              <p className="text-[11px] text-[#6e6e73] dark:text-white/38 truncate mt-0.5">{user.email}</p>
            </div>
          </button>
        </div>

        {/* Nav (scrollable) */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto min-h-0 pb-2">
          {navBtn("gradebook",    "Gradebook",      <ClipboardList className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("analytics",    "Analytics",      <TrendingUp className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("calendar",     "Calendar",       <Calendar className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("live-lecture", "Live Lecture",   <Radio className={`h-4 w-4 ${broadcastingSession ? "text-red-500 animate-pulse" : ""}`} strokeWidth={1.6} />, true)}
          {navBtn("notes",        "Publish Notes",  <PlusCircle className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("quizzes",      "Deploy Quiz",    <Award className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("exams",        "Written Exams",  <FileText className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("assignments",  "Assignments",    <Pencil className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("courses",       "Courses",        <BookOpen className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("discussions",   "Discussions",    <MessageSquare className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("announcements","Announcements",  <Megaphone className="h-4 w-4" strokeWidth={1.6} />)}
          {navBtn("departments",  "Departments",    <Users className="h-4 w-4" strokeWidth={1.6} />)}

          {/* Departments I Teach */}
          {departments.length > 0 && (
            <div className="pt-3 pb-1">
              <p className="px-3 text-[9.5px] font-bold text-[#6e6e73] dark:text-white/30 uppercase tracking-widest mb-1.5">Departments I Teach</p>
              <div className="space-y-0.5">
                {departments.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => handleToggleLecturerDept(d.name)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition text-left"
                  >
                    <span className={`h-3.5 w-3.5 rounded flex-shrink-0 border-[1.5px] flex items-center justify-center transition ${
                      lecturerDepts.includes(d.name)
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-[#8e8e93] dark:border-white/30 bg-transparent"
                    }`}>
                      {lecturerDepts.includes(d.name) && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-[#3a3a3c] dark:text-white/65 truncate leading-tight">{d.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom: theme + logout */}
        <div className="flex-shrink-0 px-2 pb-4 pt-3 space-y-0.5 border-t border-black/[0.06] dark:border-white/[0.06]">
          <button
            id="theme-toggle-lecturer-btn"
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
        <header className="apple-header-bar flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-[44px] border-b border-black/[0.05] dark:border-white/[0.04] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileLecturerOpen(true)}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-[10px] text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition"
              aria-label="Menu"
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect y="0" width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="6" width="14" height="2" rx="1" fill="currentColor"/>
                <rect y="12" width="10" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <h1 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white/88 tracking-[-0.01em]">
              {sectionTitle[activeTab] ?? "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {broadcastingSession && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 dark:bg-red-500/15 text-[11px] font-semibold text-red-600 dark:text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            )}
            {/* Notification bell — always visible */}
            <NotificationBell token={token} />
            {/* Mobile-only: avatar + theme + logout */}
            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="sm:hidden relative flex items-center justify-center w-9 h-9 rounded-full group"
              aria-label="Update profile photo"
              title="Update profile photo"
            >
              <UserAvatar
                userId={user.id}
                role="lecturer"
                size={30}
                initials={user.name}
                refreshTrigger={avatarRefreshTrigger}
                className="rounded-full ring-[1.5px] ring-black/10 dark:ring-white/15"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </button>
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

        {/* Mobile-only profile strip */}
        <div className="sm:hidden flex items-center gap-3 px-4 py-2.5 border-b border-black/[0.05] dark:border-white/[0.04] bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-tight truncate">{user.name}</p>
            <p className="text-[11px] text-[#6e6e73] dark:text-white/40 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => setIsAvatarModalOpen(true)}
            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0"
          >
            Edit Photo
          </button>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 pb-[96px] sm:pb-5 max-w-5xl mx-auto w-full space-y-5">

          {/* Toast notifications */}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-[12px] p-3.5 flex items-center gap-2.5 text-[12.5px]"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-[12px] p-3.5 flex items-center gap-2.5 text-[12.5px]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="font-semibold">{errorMsg}</span>
            </motion.div>
          )}

          {/* ── 1. GRADEBOOK ── */}
          {activeTab === "gradebook" && (
            <motion.div id="gradebook-panel" className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="apple-title">Student Assessment Gradebook</h2>
                <p className="apple-subtitle">Evaluate, mark, and adjust examination attempt logs.</p>
              </div>
              <div className="p-5 space-y-4">

                {/* Filters */}
                <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="search-student" className={lbl}>Search Student</label>
                      <input
                        id="search-student"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, Reg No, Dept…"
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="filter-course" className={lbl}>Filter Course</label>
                      <select
                        id="filter-course"
                        value={filterCourseId}
                        onChange={(e) => { setFilterCourseId(e.target.value); setFilterQuizId(""); }}
                        className="form-input"
                      >
                        <option value="">All Courses</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="filter-quiz" className={lbl}>Filter Exam / Quiz</label>
                      <select
                        id="filter-quiz"
                        value={filterQuizId}
                        onChange={(e) => setFilterQuizId(e.target.value)}
                        className="form-input"
                      >
                        <option value="">All Assessments</option>
                        {(() => {
                          const asmMap = new Map<string, { id: string; title: string; type: string }>();
                          attempts.filter(att => !filterCourseId || att.courseId === filterCourseId).forEach(att => asmMap.set(att.assessmentId, { id: att.assessmentId, title: att.assessmentTitle, type: att.type }));
                          return Array.from(asmMap.values()).map(a => (
                            <option key={a.id} value={a.id}>
                              [{a.type === "quiz" ? "Quiz" : a.type === "exam" ? "Exam" : "Assignment"}] {a.title}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[12px] rounded-[10px] transition cursor-pointer shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-[12px] border border-black/[0.07] dark:border-white/[0.06]">
                  <table className="min-w-full divide-y divide-black/[0.05] dark:divide-white/[0.05] text-left">
                    <thead className="apple-thead">
                      <tr>
                        {["Student Name","Reg. No.","Dept","Year","Course","Assessment","Type","Status","Score","Action"].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.04]">
                      {loading ? (
                        [1,2,3,4,5].map((i) => (
                          <tr key={i} className="animate-pulse">
                            {[1,2,3,4,5,6,7,8,9,10].map((j) => (
                              <td key={j} className="px-4 py-3"><div className="h-3.5 bg-black/[0.06] dark:bg-white/[0.06] rounded-md w-full" /></td>
                            ))}
                          </tr>
                        ))
                      ) : filteredAttempts.length > 0 ? (
                        filteredAttempts.map((att) => {
                          const scoreDisplay = (() => {
                            if (att.status === "not_submitted") return "-";
                            if (att.type === "quiz") return att.score !== null ? `${att.score.toFixed(1)}%` : "Pending";
                            if (!att.isGraded) return "Pending";
                            if (att.totalMarks) return `${att.score ?? 0}/${att.totalMarks}`;
                            return att.score !== null ? `${att.score.toFixed(1)}%` : "Pending";
                          })();
                          const canOverride = att.status !== "not_submitted";
                          return (
                          <tr key={att.id} className={`hover:bg-emerald-50/30 dark:hover:bg-white/[0.02] transition-colors text-[13px] ${att.status === "not_submitted" ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-white/90 whitespace-nowrap">{att.studentName}</td>
                            <td className="px-4 py-3 font-mono text-[12px] text-[#6e6e73] dark:text-white/40 font-bold uppercase">{att.regNumber}</td>
                            <td className="px-4 py-3 text-[#3a3a3c] dark:text-white/70 text-[12px]">{att.department}</td>
                            <td className="px-4 py-3 font-mono text-[12px] text-[#6e6e73] dark:text-white/40 font-bold">{att.year}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">{att.courseCode}</span>
                              <span className="text-[11px] text-[#6e6e73] dark:text-white/35 block">{att.courseTitle}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#1d1d1f] dark:text-white/85 block leading-none text-[12px]">{att.assessmentTitle}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                att.type === "quiz" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
                                : att.type === "exam" ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30"
                                : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/30"
                              }`}>
                                {att.type === "quiz" ? "Quiz" : att.type === "exam" ? "Exam" : "Assignment"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {att.status === "not_submitted" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                                  Not Submitted
                                </span>
                              ) : att.status === "in_progress" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 animate-pulse">
                                  In Progress
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                                  Submitted
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[12px] font-mono font-bold text-[#1d1d1f] dark:text-white/90 text-center">
                              {scoreDisplay}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canOverride && editingAttemptId === att.id ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="number"
                                    min="0" step="0.5"
                                    value={editingScore}
                                    onChange={(e) => setEditingScore(e.target.value)}
                                    className="w-16 px-1.5 py-1 border border-black/[0.10] dark:border-white/[0.12] rounded-[8px] text-center font-mono text-[12px] bg-[#ffffff] dark:bg-black/30 text-[#1d1d1f] dark:text-white outline-none focus:border-emerald-400"
                                  />
                                  <button onClick={() => handleSaveScoreAdjustment(att.id)} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[8px] transition cursor-pointer">
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => setEditingAttemptId(null)} className="p-1.5 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.08] text-[#3a3a3c] dark:text-white/60 rounded-[8px] transition cursor-pointer">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : canOverride ? (
                                <button
                                  onClick={() => { setEditingAttemptId(att.id); setEditingRowType(att.type); setEditingScore(att.score?.toString() || "0"); }}
                                  className="text-[12px] font-semibold text-[#3a3a3c] dark:text-white/60 border border-black/[0.09] dark:border-white/[0.09] px-2.5 py-1 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition rounded-[8px] cursor-pointer"
                                >
                                  Override
                                </button>
                              ) : (
                                <span className="text-[12px] text-[#6e6e73] dark:text-white/30">—</span>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={10} className="text-center py-12 text-[#6e6e73] dark:text-white/35 text-[12px]">
                            No records match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 2. LIVE LECTURE ── */}
          {activeTab === "live-lecture" && (
            <motion.div id="live-lecture-panel" className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white/90 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                  Live Broadcasting Station
                </h2>
                <p className="apple-subtitle">Audio/video, slides, polls, attendance: all in one live session.</p>
              </div>
              <div className="p-5 space-y-4">

                {!broadcastingSession ? (
                  <form onSubmit={handleLaunchLiveLecture} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Target Course</label>
                        <select value={liveCourseId} onChange={(e) => setLiveCourseId(e.target.value)} className="form-input">
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                        </select>
                        {audienceBadge(liveCourseId)}
                      </div>
                      <div>
                        <label className={lbl}>Lecture Topic</label>
                        <input type="text" required value={liveTopic} onChange={(e) => setLiveTopic(e.target.value)} placeholder="e.g. Lecture 4: Relational Algebra" className="form-input" />
                      </div>
                    </div>

                    {/* PPT Upload */}
                    <div>
                      <label className={lbl}>Upload PowerPoint Slides (.pptx)</label>
                      <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-[12px] px-4 py-5 transition
                        ${preLaunchPptxFile ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-black/[0.10] dark:border-white/[0.10] hover:border-emerald-300 dark:hover:border-emerald-700"}`}>
                        <input type="file" accept=".pptx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePreLaunchPptx(f); e.target.value = ""; }} />
                        {isParsingPptx ? (
                          <><Loader2 className="h-5 w-5 animate-spin text-emerald-500 flex-shrink-0" /><span className="text-[13px] text-[#6e6e73] dark:text-white/50">Extracting slides…</span></>
                        ) : preLaunchPptxFile && parsedSlideCount ? (
                          <>
                            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
                              <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">{preLaunchPptxFile.name}</p>
                              <p className="text-[11.5px] text-emerald-600/70 dark:text-emerald-400/60">{parsedSlideCount} slides extracted — tap to replace</p>
                            </div>
                            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.05] flex-shrink-0">
                              <Upload className="h-4 w-4 text-[#6e6e73] dark:text-white/40" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-[#3a3a3c] dark:text-white/70">Choose a .pptx file</p>
                              <p className="text-[11.5px] text-[#6e6e73] dark:text-white/40">AI extracts each slide into a live board — or type content below</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>

                    {/* Manual content — shown collapsed when PPT loaded, expanded when typing manually */}
                    <div>
                      <label className={lbl}>
                        {parsedSlideCount ? "Extracted Slide Content (editable)" : "Or Type Slides Manually (separate with ---)"}
                      </label>
                      <textarea
                        required
                        rows={parsedSlideCount ? 5 : 7}
                        value={liveContent}
                        onChange={(e) => setLiveContent(e.target.value)}
                        placeholder={"# Slide 1\nYour first slide content here\n\n---\n\n# Slide 2\nSecond slide…"}
                        className="form-input font-mono text-[12px]"
                      />
                      {parsedSlideCount && (
                        <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-1">You can edit the extracted content before launching.</p>
                      )}
                    </div>

                    <button type="submit" className="btn-gradient flex items-center gap-2">
                      <Radio className="h-4 w-4" /> Launch Broadcast
                    </button>
                  </form>
                ) : (() => {
                  const slides = broadcastingSession.content.split(/^---$/m).map((s: string) => s.trim()).filter(Boolean);
                  const currentSlide = broadcastingSession.currentSlide ?? 0;
                  const safeSlide = Math.min(currentSlide, slides.length - 1);
                  const handRaises: any[] = broadcastingSession.handRaises ?? [];
                  const activePoll: any = (broadcastingSession.polls ?? [])[0] ?? null;
                  const attendance: any[] = broadcastingSession.attendance ?? [];

                  return (
                    <div className="space-y-4">
                      {/* Live banner */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-[12px] p-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-2.5 w-2.5"><span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-red-500" /></span>
                          <div>
                            <span className="text-[11px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-widest block">Live</span>
                            <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/85">{broadcastingSession.topic}</p>
                          </div>
                          {handRaises.length > 0 && (
                            <span className="ml-2 flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                              <ThumbsUp className="h-3 w-3" /> {handRaises.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={handleSummarize} disabled={isSummarizing}
                            className="px-3 py-1.5 text-[11px] font-semibold border border-black/[0.09] dark:border-white/[0.10] rounded-[8px] hover:border-emerald-300 text-[#3a3a3c] dark:text-white/60 transition-colors disabled:opacity-50">
                            {isSummarizing ? "Summarizing…" : "AI Summary"}
                          </button>
                          <button onClick={handleEndLiveLecture}
                            className="px-4 py-1.5 bg-[#1d1d1f] dark:bg-white/[0.10] hover:bg-red-700 dark:hover:bg-red-700 text-white rounded-[10px] text-[12px] font-semibold transition flex-shrink-0">
                            End Broadcast
                          </button>
                        </div>
                      </div>

                      {/* AI Summary */}
                      {sessionSummary && (
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-[12px] p-4">
                          <p className={lbl + " text-emerald-700 dark:text-emerald-400"}>AI Session Summary</p>
                          <p className="text-[12.5px] text-[#3a3a3c] dark:text-white/70 leading-relaxed whitespace-pre-line">{sessionSummary}</p>
                        </div>
                      )}

                      {/* Sub-tabs */}
                      <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-[12px] p-1 border border-black/[0.06] dark:border-white/[0.05] overflow-x-auto">
                        {([
                          { id: "audio",      icon: Mic,           label: "Audio/Video" },
                          { id: "slides",     icon: Layers,        label: `Slides${slides.length > 1 ? ` (${safeSlide + 1}/${slides.length})` : ""}` },
                          { id: "poll",       icon: BarChart2,     label: `Poll${activePoll ? " •" : ""}` },
                          { id: "attendance", icon: Users,         label: `Attendance (${attendance.length})` },
                          { id: "chat",       icon: MessageSquare, label: `Chat (${liveChats.length})` },
                        ] as { id: "audio" | "slides" | "poll" | "attendance" | "chat"; icon: React.ElementType; label: string }[]).map(tab => (
                          <button key={tab.id} onClick={() => setLiveSubTab(tab.id)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 ${liveSubTab === tab.id ? "bg-[#ffffff] dark:bg-white/[0.10] text-[#1d1d1f] dark:text-white/90 shadow-sm border border-black/[0.07] dark:border-white/[0.08]" : "text-[#6e6e73] dark:text-white/50 hover:text-[#1d1d1f] dark:hover:text-white/75"}`}>
                            <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* LiveAudioRoom — always mounted so audio stays alive when switching tabs */}
                      <div style={{ display: liveSubTab === "audio" ? "block" : "none" }}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-[#6e6e73] dark:text-white/40">Live audio room — you are the host</p>
                            <button onClick={handleMuteAll}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer">
                              <Mic className="h-3.5 w-3.5" /> Mute All Students
                            </button>
                          </div>
                          <LiveAudioRoom
                            ref={audioRoomRef}
                            roomId={broadcastingSession.id}
                            displayName={user.name}
                            role="lecturer"
                          />
                          <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4 space-y-3">
                            <p className={lbl}>Share a File with Students</p>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-black/[0.12] dark:border-white/[0.15] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors text-[12px] text-[#6e6e73] dark:text-white/50 flex-1">
                                <Upload className="h-4 w-4 shrink-0" />
                                {attachLiveFile ? attachLiveFile.name : "Choose file to share (PDF, DOCX, etc.)"}
                                <input type="file" className="hidden" onChange={e => setAttachLiveFile(e.target.files?.[0] ?? null)} />
                              </label>
                              <button onClick={handleAttachFile} disabled={!attachLiveFile}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold rounded-[10px] transition disabled:opacity-40">
                                Share
                              </button>
                            </div>
                            {broadcastingSession.attachmentName && (
                              <p className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /> Shared: {broadcastingSession.attachmentName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Slides */}
                      {liveSubTab === "slides" && (
                        <div className="space-y-4">
                          {/* Hand raise alerts — shown directly in slides view */}
                          {handRaises.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <ThumbsUp className="h-3.5 w-3.5" /> {handRaises.length} student{handRaises.length !== 1 ? "s" : ""} raised hand
                              </p>
                              {handRaises.map((h: any) => (
                                <div key={h.id} className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border rounded-[10px] ${h.allowedToSpeak ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30"}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[15px]">{h.allowedToSpeak ? "🎤" : "✋"}</span>
                                    <div>
                                      <p className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/90">{h.studentName}</p>
                                      <p className="text-[10.5px] font-mono text-[#6e6e73] dark:text-white/40">
                                        {h.allowedToSpeak ? "Speaking allowed" : new Date(h.raisedAt).toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {!h.allowedToSpeak ? (
                                      <button onClick={() => handleAllowToSpeak(h.id, h.studentName)}
                                        className="px-3 py-1 text-[11px] font-semibold border border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-[8px] transition cursor-pointer">
                                        Allow 🎤
                                      </button>
                                    ) : (
                                      <button onClick={() => handleMuteStudent(h.id, h.studentName)}
                                        className="px-3 py-1 text-[11px] font-semibold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-[8px] transition cursor-pointer">
                                        Mute 🔇
                                      </button>
                                    )}
                                    <button onClick={() => handleDismissHandRaise(h.id)}
                                      className="px-3 py-1 text-[11px] font-semibold border border-black/[0.09] dark:border-white/[0.10] text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-[8px] transition cursor-pointer">
                                      Lower
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {slides.length > 0 && (
                            <div className="space-y-3">
                              <SlideView
                                content={slides[safeSlide]}
                                slideNumber={safeSlide + 1}
                                totalSlides={slides.length}
                                topic={broadcastingSession.topic}
                                courseCode={courses.find((c: any) => c.id === broadcastingSession.courseId)?.code}
                                canNavigate
                                onPrev={() => handleSlideChange(Math.max(0, safeSlide - 1))}
                                onNext={() => handleSlideChange(Math.min(slides.length - 1, safeSlide + 1))}
                              />
                              <div className="flex items-center justify-between gap-3">
                                <button onClick={() => handleSlideChange(Math.max(0, safeSlide - 1))} disabled={safeSlide === 0}
                                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.12] dark:hover:bg-white/[0.14] text-[#3a3a3c] dark:text-white/70 rounded-[10px] disabled:opacity-30 transition cursor-pointer">
                                  <ChevronLeft className="h-4 w-4" /> Previous
                                </button>
                                <span className="text-[11px] font-mono text-[#6e6e73] dark:text-white/40 select-none">← → or hover slide for fullscreen</span>
                                <button onClick={() => handleSlideChange(Math.min(slides.length - 1, safeSlide + 1))} disabled={safeSlide === slides.length - 1}
                                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-[10px] disabled:opacity-30 transition cursor-pointer">
                                  Next <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4 space-y-3">
                            <p className={lbl}>Upload PowerPoint (.pptx)</p>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-black/[0.12] dark:border-white/[0.15] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors text-[12px] text-[#6e6e73] dark:text-white/50 flex-1 min-w-0">
                                <Layers className="h-4 w-4 shrink-0" />
                                <span className="truncate">{pptxFile ? pptxFile.name : "Choose .pptx file"}</span>
                                <input type="file" accept=".pptx" className="hidden" onChange={e => setPptxFile(e.target.files?.[0] ?? null)} />
                              </label>
                              <button onClick={handleUploadPptx} disabled={!pptxFile || isUploadingPptx}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold rounded-[10px] transition disabled:opacity-40 flex-shrink-0">
                                {isUploadingPptx ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Parsing…</> : "Load Slides"}
                              </button>
                            </div>
                            <p className="text-[11px] text-[#6e6e73] dark:text-white/40">Slides are extracted from the PPTX and displayed in order during the live class.</p>
                          </div>
                          <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4 space-y-3">
                            <p className={lbl}>Update Content Manually</p>
                            <input type="text" value={liveTopic} onChange={e => setLiveTopic(e.target.value)} placeholder="Topic" className="form-input" />
                            <textarea rows={8} value={liveContent} onChange={e => setLiveContent(e.target.value)} className="form-input" />
                            <button onClick={handleUpdateLiveLecture} className="btn-gradient flex items-center gap-2">
                              <Save className="h-4 w-4" /> Sync to Students
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Poll */}
                      {liveSubTab === "poll" && (
                        <div className="space-y-4">
                          {activePoll ? (
                            <div className="bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-[12px] p-4">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{activePoll.question}</p>
                                <button onClick={handleClosePoll} className="text-[11px] font-semibold text-red-500 border border-red-200 dark:border-red-900/40 px-2.5 py-1 rounded-[8px] hover:bg-red-50 dark:hover:bg-red-950/20 transition">Close Poll</button>
                              </div>
                              {(() => {
                                const opts: string[] = JSON.parse(activePoll.optionsJson);
                                const responses: any[] = activePoll.responses ?? [];
                                const total = responses.length;
                                return (
                                  <div className="space-y-2">
                                    {opts.map(opt => {
                                      const count = responses.filter((r: any) => r.answer === opt).length;
                                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                      return (
                                        <div key={opt}>
                                          <div className="flex justify-between text-[12px] mb-1">
                                            <span className="font-medium text-[#3a3a3c] dark:text-white/75">{opt}</span>
                                            <span className="text-[#6e6e73] dark:text-white/40 font-mono">{count} ({pct}%)</span>
                                          </div>
                                          <div className="h-2 rounded-full bg-black/[0.07] dark:bg-white/[0.08] overflow-hidden">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-2">{total} response{total !== 1 ? "s" : ""}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4 space-y-3">
                              <p className={lbl}>Launch a Quick Poll</p>
                              <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask the class a question…" className="form-input" />
                              <div className="space-y-2">
                                {pollOptions.map((opt, i) => (
                                  <input key={i} type="text" value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }} placeholder={`Option ${i + 1}`} className="form-input" />
                                ))}
                              </div>
                              <button onClick={handleLaunchPoll} className="btn-gradient flex items-center gap-2 w-full justify-center">
                                <BarChart2 className="h-4 w-4" /> Launch Poll
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Attendance */}
                      {liveSubTab === "attendance" && (
                        <div className="space-y-3">
                          <p className={lbl}>Students Present ({attendance.length})</p>
                          {attendance.length === 0 ? (
                            <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                              <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No students have joined yet.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {handRaises.length > 0 && (
                                <div className="mb-3">
                                  <p className={lbl + " flex items-center gap-1.5 text-amber-600 dark:text-amber-400"}><ThumbsUp className="h-3.5 w-3.5" /> Raised Hands ({handRaises.length})</p>
                                  <div className="space-y-1.5">
                                    {handRaises.map((h: any) => (
                                      <div key={h.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-[10px]">
                                        <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/85">{h.studentName}</span>
                                        <button onClick={() => handleDismissHandRaise(h.id)} className="text-[11px] font-semibold text-[#6e6e73] dark:text-white/50 hover:text-[#1d1d1f] dark:hover:text-white/80 transition">Dismiss</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {attendance.map((a: any) => (
                                <div key={a.studentId} className="flex items-center justify-between p-3 border border-black/[0.07] dark:border-white/[0.06] rounded-[10px]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{a.studentName?.[0] ?? "?"}</span>
                                    </div>
                                    <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/85">{a.studentName}</span>
                                  </div>
                                  <span className="text-[11px] text-[#6e6e73] dark:text-white/40 font-mono">{new Date(a.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Chat */}
                      {liveSubTab === "chat" && (
                        <div className="border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] overflow-hidden flex flex-col h-[420px]">
                          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-black/[0.01] dark:bg-white/[0.02]">
                            {liveChats.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-[#6e6e73] dark:text-white/35 text-[11px] font-medium">Waiting for responses…</div>
                            ) : liveChats.map((chat) => {
                              const isMe = chat.senderRole === "lecturer";
                              return (
                                <div key={chat.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                                  <UserAvatar userId={chat.senderId} role={isMe ? "lecturer" : "student"} size={26} initials={chat.senderName} className="shrink-0" />
                                  <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                    <span className={`text-[11px] font-bold font-mono uppercase tracking-wide ${isMe ? "text-amber-600 dark:text-amber-500" : "text-[#6e6e73] dark:text-white/40"}`}>{chat.senderName}</span>
                                    <div className={`px-3 py-2 rounded-2xl text-[12px] break-words ${isMe ? "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 rounded-br-md text-[#1d1d1f] dark:text-white/85" : "bg-[#f0f0f0] dark:bg-white/[0.07] rounded-bl-md text-[#1d1d1f] dark:text-white/80"}`}>{chat.message}</div>
                                    <span className="text-[8.5px] text-[#6e6e73] dark:text-white/30 font-mono">{new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={chatEndRef} />
                          </div>
                          <form onSubmit={handleSendLecturerChat} className="p-2.5 border-t border-black/[0.06] dark:border-white/[0.06] flex gap-2 bg-[#ffffff] dark:bg-[#1c1c1e]">
                            <input type="text" required value={lecturerChatMessage} onChange={e => setLecturerChatMessage(e.target.value)} placeholder="Reply to class…"
                              className="flex-1 px-3 py-2.5 bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.09] dark:border-white/[0.10] rounded-[10px] text-[12.5px] text-[#1d1d1f] dark:text-white/90 placeholder-[#6e6e73] dark:placeholder-white/30 outline-none focus:border-emerald-500/60 transition" />
                            <button type="submit" disabled={isSendingChat} className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition flex-shrink-0">
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
          )}

          {/* ── 3. PUBLISH NOTES ── */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              {/* Published notes list */}
              <motion.div className="apple-card overflow-hidden" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="apple-title">Published Notes</h2>
                  <p className="apple-subtitle">Your uploaded materials visible to students.</p>
                </div>
                {notesLoading ? (
                  <div className="py-8 text-center text-[12px] text-[#8e8e93] dark:text-white/35">Loading…</div>
                ) : publishedNotes.length === 0 ? (
                  <div className="apple-empty-state py-10">
                    <div className="apple-empty-state__icon"><FileText className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
                    <p className="apple-empty-state__title">No notes published yet</p>
                    <p className="apple-empty-state__body">Use the form below to publish your first note.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {publishedNotes.map(n => {
                      const c = courses.find(x => x.id === n.courseId);
                      return (
                        <div key={n.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c && <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">{c.code}</span>}
                              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{n.title}</p>
                            </div>
                            <p className="text-[11px] text-[#8e8e93] dark:text-white/35 mt-0.5">
                              {new Date(n.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(n.id, n.title)}
                            title="Delete note"
                            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-[8px] text-[#8e8e93] dark:text-white/35 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Create note form */}
              <motion.div id="notes-panel" className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.06 }}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="apple-title">New Study Note</h2>
                    <p className="apple-subtitle">Paste from Word, import a .docx, or write in Markdown.</p>
                  </div>
                  {/* DOCX import */}
                  <div>
                    <input
                      ref={docxInputRef}
                      type="file"
                      accept=".docx,.doc"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleDocxImport(f); e.target.value = ""; }}
                    />
                    <button
                      type="button"
                      onClick={() => docxInputRef.current?.click()}
                      disabled={docxImporting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-black/[0.10] dark:border-white/[0.12] text-[12px] font-semibold text-[#3a3a3c] dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition disabled:opacity-50 cursor-pointer"
                    >
                      {docxImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {docxImporting ? "Importing…" : "Import .docx"}
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  <form onSubmit={handlePublishNote} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Target Course Module</label>
                        <select value={noteCourseId} onChange={(e) => setNoteCourseId(e.target.value)} className="form-input">
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                        </select>
                        {audienceBadge(noteCourseId)}
                      </div>
                      <div>
                        <label className={lbl}>Lecture Note Title</label>
                        <input type="text" required value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. Chapter 3: Normalization…" className="form-input" />
                      </div>
                    </div>

                    {/* Toolbar + paste tip */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          <label className={lbl}>Content</label>
                          <span className="text-[10px] text-[#8e8e93] dark:text-white/30 ml-1">— Markdown · paste from Word preserves formatting</span>
                        </div>
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {([
                            { label: "B",   insert: "**bold**",           title: "Bold" },
                            { label: "I",   insert: "_italic_",           title: "Italic" },
                            { label: "H2",  insert: "\n## Heading\n",     title: "Heading 2" },
                            { label: "H3",  insert: "\n### Heading\n",    title: "Heading 3" },
                            { label: "•",   insert: "\n- item\n",         title: "Bullet list" },
                            { label: "1.",  insert: "\n1. item\n",        title: "Numbered list" },
                            { label: "`",   insert: "`code`",             title: "Inline code" },
                            { label: "```", insert: "\n```\ncode\n```\n", title: "Code block" },
                          ] as const).map(btn => (
                            <button key={btn.label} type="button" title={btn.title}
                              onClick={() => setNoteContent(prev => prev + btn.insert)}
                              className="px-2 py-1 text-[10.5px] font-bold text-[#3a3a3c] dark:text-white/60 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] rounded-[6px] transition font-mono cursor-pointer">
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Split pane */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#8e8e93] dark:text-white/30 mb-1.5">Editor</p>
                          <textarea
                            ref={noteTextareaRef}
                            required
                            rows={18}
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            onPaste={handlePaste}
                            placeholder={"# Introduction\n\nWrite or paste your lecture notes here.\nFormatting from Word (bold, headings, lists) is preserved on paste.\n\n## Key Concepts\n\n- Point one\n- Point two"}
                            className="form-input font-mono text-[12.5px] leading-relaxed resize-none"
                            style={{ minHeight: "360px" }}
                          />
                        </div>
                        <div>
                          <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#8e8e93] dark:text-white/30 mb-1.5">Preview</p>
                          <div className="rounded-[10px] border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-5 overflow-y-auto" style={{ minHeight: "360px" }}>
                            {noteContent.trim() ? (
                              <MarkdownView content={noteContent} />
                            ) : (
                              <p className="text-[12.5px] text-[#c7c7cc] dark:text-white/20 italic">Preview will appear here as you type…</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="btn-gradient flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Publish Note
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          )}

          {/* ── 4. DEPLOY QUIZ ── */}
          {activeTab === "quizzes" && (
            <motion.div id="quizzes-panel" className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="apple-title">Deploy Secure Quiz & Examination</h2>
                <p className="apple-subtitle">Configure timed question sets for instant testing and score logging.</p>
              </div>
              <div className="p-5">
                <form onSubmit={handleDeployQuizSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                    <div>
                      <label className={lbl}>Course Module</label>
                      <select value={quizCourseId} onChange={(e) => setQuizCourseId(e.target.value)} className="form-input">
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                      </select>
                      {audienceBadge(quizCourseId)}
                    </div>
                    <div>
                      <label className={lbl}>Quiz Title</label>
                      <input type="text" required value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="e.g. Mid-Term 2026" className="form-input" />
                    </div>
                    <div>
                      <label className={lbl}>Duration (Minutes)</label>
                      <input type="number" required min="1" value={quizDuration} onChange={(e) => setQuizDuration(e.target.value)} className="form-input" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                    <div>
                      <label className={lbl}>Opens At <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional)</span></label>
                      <input type="datetime-local" value={quizAvailableFrom} onChange={(e) => setQuizAvailableFrom(e.target.value)} className="form-input" />
                    </div>
                    <div>
                      <label className={lbl}>Closes At <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional — students lose access after this)</span></label>
                      <input type="datetime-local" value={quizAvailableUntil} onChange={(e) => setQuizAvailableUntil(e.target.value)} className="form-input" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-[12px] font-bold text-[#3a3a3c] dark:text-white/70 uppercase tracking-wider">Questions ({quizQuestions.length})</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setAiGenOpen(o => !o); setAiGenError(null); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-[8px] transition cursor-pointer border ${
                            aiGenOpen
                              ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700/50 text-purple-700 dark:text-purple-400"
                              : "border-purple-300 dark:border-purple-700/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                          }`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Generate with AI
                        </button>
                        <input
                          ref={parseFileInputRef}
                          type="file"
                          accept=".docx,.doc,.txt"
                          className="hidden"
                          onChange={handleParseDocUpload}
                        />
                        <button
                          type="button"
                          disabled={isParsing}
                          onClick={() => parseFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-[8px] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isParsing ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing…</>
                          ) : (
                            <><Upload className="h-3.5 w-3.5" /> Upload Word Doc</>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBankOpen(o => !o); if (!bankOpen) fetchBank(); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-[8px] transition cursor-pointer border ${
                            bankOpen
                              ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700/50 text-blue-700 dark:text-blue-400"
                              : "border-blue-300 dark:border-blue-700/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          }`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          My Bank
                        </button>
                      </div>
                    </div>

                    {/* Question bank panel */}
                    <AnimatePresence>
                      {bankOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-[12px] border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-[11.5px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Question Bank ({bankQuestions.length})</span>
                            </div>
                            {bankLoading ? (
                              <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-white/40 py-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                              </div>
                            ) : bankQuestions.length === 0 ? (
                              <p className="text-[12px] text-[#6e6e73] dark:text-white/40 italic py-1">No saved questions yet. Use "Save to Bank" on any question below.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {bankQuestions.map((bq: any) => (
                                  <div key={bq.id} className="flex items-start justify-between gap-3 p-2.5 rounded-[8px] bg-white/60 dark:bg-white/[0.04] border border-blue-100 dark:border-blue-900/30">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-medium text-[#1d1d1f] dark:text-white/80 truncate">{bq.text}</p>
                                      {bq.topic && <p className="text-[10px] text-[#6e6e73] dark:text-white/35 mt-0.5">{bq.topic}</p>}
                                    </div>
                                    <button type="button" onClick={() => addFromBank(bq)}
                                      className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-[6px] transition cursor-pointer">
                                      Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* AI generation panel */}
                    <AnimatePresence>
                      {aiGenOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-[12px] border border-purple-200 dark:border-purple-800/40 bg-purple-50/60 dark:bg-purple-950/20 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-[11.5px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">AI Question Generator</span>
                            </div>
                            <div>
                              <label className={lbl}>Topic / Prompt</label>
                              <textarea
                                rows={2}
                                value={aiGenTopic}
                                onChange={e => setAiGenTopic(e.target.value)}
                                placeholder="e.g. Photosynthesis in C3 plants, or 'Basic SQL queries and joins'"
                                className="form-input resize-none"
                              />
                            </div>
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <label className={lbl}>Number of Questions</label>
                                <select value={aiGenCount} onChange={e => setAiGenCount(e.target.value)} className="form-input">
                                  {["5","10","15","20"].map(n => <option key={n} value={n}>{n} questions</option>)}
                                </select>
                              </div>
                              <button
                                type="button"
                                disabled={aiGenLoading || !aiGenTopic.trim()}
                                onClick={handleAiGenerateQuestions}
                                className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-[8px] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                              >
                                {aiGenLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><Sparkles className="h-3.5 w-3.5" /> Generate</>}
                              </button>
                            </div>
                            {aiGenError && (
                              <div className="flex items-center gap-2 text-[11.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-[8px] px-3 py-2">
                                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                {aiGenError}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {parseDocError && (
                      <div className="flex items-center gap-2 text-[11.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-[8px] px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        {parseDocError}
                      </div>
                    )}
                    {quizQuestions.map((q, qIdx) => (
                      <div key={q.uid} className="p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06] dark:border-white/[0.06]">
                          <span className="text-[12px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Question {qIdx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            <button type="button"
                              onClick={() => saveQuestionToBank(q)}
                              title="Save to Question Bank"
                              className="flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-[7px] transition cursor-pointer">
                              <Save className="h-3 w-3" /> Bank
                            </button>
                            {quizQuestions.length > 1 && (
                              <button type="button" onClick={() => handleRemoveQuestionRow(qIdx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 transition rounded-[8px] cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className={lbl}>Question Text</label>
                          <input type="text" required value={q.text} onChange={(e) => handleQuizQuestionChange(qIdx, "text", e.target.value)} placeholder="e.g. What does SQL stand for?" className="form-input" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx}>
                              <label className={lbl}>Option {["A","B","C","D"][optIdx]}</label>
                              <input type="text" required value={opt} onChange={(e) => handleQuizQuestionChange(qIdx, "option", e.target.value, optIdx)} placeholder={`Option ${["A","B","C","D"][optIdx]}`} className="form-input" />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className={lbl}>Correct Option</label>
                          <select value={q.correctOption} onChange={(e) => handleQuizQuestionChange(qIdx, "correctOption", e.target.value)} className={`form-input ${!q.correctOption ? "border-amber-400 dark:border-amber-600" : ""}`}>
                            <option value="">-- Select correct answer --</option>
                            {q.options.map((opt, oIdx) => {
                              const optLabel = ["A","B","C","D"][oIdx];
                              return <option key={oIdx} value={opt}>{optLabel}: {opt || `(Option ${optLabel} empty)`}</option>;
                            })}
                          </select>
                          {!q.correctOption && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Select the correct answer</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddQuestionRow}
                      className="w-full py-2.5 border-2 border-dashed border-black/[0.10] dark:border-white/[0.10] hover:border-emerald-300 dark:hover:border-emerald-700 text-[#6e6e73] dark:text-white/40 hover:text-emerald-600 dark:hover:text-emerald-400 text-[12px] font-semibold rounded-[12px] transition cursor-pointer"
                    >
                      + Add Question
                    </button>
                  </div>

                  <button type="submit" className="btn-gradient flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Deploy Secure Quiz
                  </button>
                </form>

                {/* ── Existing Quizzes ── */}
                <div className="space-y-3 pt-2">
                  <p className={lbl}>Deployed Quizzes ({quizList.length})</p>
                  {quizList.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                      <Award className="h-7 w-7 text-black/20 dark:text-white/20 mx-auto mb-2" />
                      <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No quizzes deployed yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {quizList.map((quiz) => (
                        <div key={quiz.id} className="flex items-center justify-between p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] hover:border-red-200 dark:hover:border-red-900/40 transition-all duration-200 gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10.5px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wide">{quiz.course?.code}</span>
                              <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 truncate">{quiz.title}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10.5px] text-[#6e6e73] dark:text-white/40 font-mono mt-1 flex-wrap">
                              <span>{quiz.durationMinutes} min</span>
                              <span>{quiz._count?.questions ?? 0} questions</span>
                              <span>{quiz._count?.attempts ?? 0} attempts</span>
                              {quiz.availableFrom && <span>Opens {new Date(quiz.availableFrom).toLocaleString()}</span>}
                              {quiz.availableUntil && <span>Closes {new Date(quiz.availableUntil).toLocaleString()}</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap">
                            <button type="button" onClick={() => handleShowAnalytics(quiz.id, quiz.title)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-semibold border border-black/[0.09] dark:border-white/[0.10] text-[#3a3a3c] dark:text-white/60 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-[8px] transition-colors cursor-pointer">
                              <BarChart2 className="h-3.5 w-3.5" /> Stats
                            </button>
                            <button type="button" onClick={() => handleDuplicateQuiz(quiz.id, quiz.title)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-semibold border border-black/[0.09] dark:border-white/[0.10] text-[#3a3a3c] dark:text-white/60 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-[8px] transition-colors cursor-pointer">
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                            <button type="button" onClick={() => openEditQuiz(quiz)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-semibold border border-black/[0.09] dark:border-white/[0.10] text-[#3a3a3c] dark:text-white/60 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-[8px] transition-colors cursor-pointer">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-semibold border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-[8px] transition-colors cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ANALYTICS MODAL ── */}
          {(analyticsData || isLoadingAnalytics) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAnalyticsData(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="apple-card max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h2 className="apple-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Analytics</h2>
                    <p className="apple-subtitle truncate">{analyticsQuizTitle}</p>
                  </div>
                  <button onClick={() => setAnalyticsData(null)} className="p-1.5 rounded-[8px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] cursor-pointer"><X className="h-4 w-4 text-[#6e6e73]" /></button>
                </div>
                <div className="p-5 space-y-5">
                  {isLoadingAnalytics ? (
                    <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
                  ) : analyticsData && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Attempts",  value: analyticsData.total },
                          { label: "Avg Score", value: `${analyticsData.avgScore}%` },
                          { label: "Pass Rate", value: `${analyticsData.passRate}%` },
                          { label: "Passed",    value: `${analyticsData.passCount}/${analyticsData.total}` },
                        ].map(stat => (
                          <div key={stat.label} className="text-center p-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40">{stat.label}</p>
                            <p className="text-[20px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                      {/* Score distribution */}
                      {analyticsData.total > 0 && (() => {
                        const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i*10}–${i*10+9}`, count: 0 }));
                        for (const s of (analyticsData.scores ?? [])) {
                          const idx = Math.min(Math.floor((s ?? 0) / 10), 9);
                          buckets[idx].count += 1;
                        }
                        const maxBucket = Math.max(...buckets.map(b => b.count), 1);
                        return (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">Score Distribution</p>
                            <div className="flex items-end gap-1 h-20">
                              {buckets.map((b, i) => {
                                const h = Math.max((b.count / maxBucket) * 100, b.count > 0 ? 6 : 2);
                                const isPassing = i >= 5;
                                return (
                                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${b.range}%: ${b.count} student${b.count !== 1 ? "s" : ""}`}>
                                    <div className={`w-full rounded-t-[3px] transition-all ${isPassing ? "bg-emerald-500/70" : "bg-red-400/60"}`} style={{ height: `${h}%` }} />
                                    {i % 2 === 0 && <span className="text-[8px] text-[#8e8e93] dark:text-white/25">{i*10}</span>}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[9.5px] text-[#8e8e93] dark:text-white/30 mt-1">Score (%) · green = pass</p>
                          </div>
                        );
                      })()}

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-3">Question Difficulty &amp; Option Breakdown</p>
                        <div className="space-y-4">
                          {analyticsData.questionStats.map((q: any, i: number) => (
                            <div key={q.id} className="p-3 rounded-[10px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] space-y-2">
                              <div className="flex items-center justify-between text-[11.5px] gap-2">
                                <span className="text-[#1d1d1f] dark:text-white/80 flex-1 font-medium">Q{i+1}. {q.text}</span>
                                <span className={`font-bold flex-shrink-0 ${q.correctRate >= 70 ? "text-emerald-600 dark:text-emerald-400" : q.correctRate >= 40 ? "text-amber-500" : "text-red-500"}`}>{q.correctRate}% correct</span>
                              </div>
                              {/* Overall correct-rate bar */}
                              <div className="h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${q.correctRate >= 70 ? "bg-emerald-500" : q.correctRate >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${q.correctRate}%` }} />
                              </div>
                              {/* Per-option choice breakdown */}
                              {q.options && q.attempted > 0 && (
                                <div className="space-y-1 pt-1">
                                  {(q.options as string[]).map((opt: string, oi: number) => {
                                    const count = (q.optionCounts?.[opt] ?? 0) as number;
                                    const pct = q.attempted > 0 ? Math.round((count / q.attempted) * 100) : 0;
                                    const isCorrect = opt === q.correctOption;
                                    return (
                                      <div key={oi} className="flex items-center gap-2 text-[10.5px]">
                                        <span className={`font-bold font-mono flex-shrink-0 w-5 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-[#6e6e73] dark:text-white/35"}`}>
                                          {["A","B","C","D"][oi]}
                                        </span>
                                        <span className="flex-shrink-0 w-32 truncate text-[#6e6e73] dark:text-white/50">{opt}</span>
                                        <div className="flex-1 h-1.5 bg-black/[0.06] dark:bg-white/[0.07] rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${isCorrect ? "bg-emerald-500" : "bg-slate-400 dark:bg-white/25"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className={`flex-shrink-0 w-10 text-right font-mono ${isCorrect ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-[#6e6e73] dark:text-white/35"}`}>{pct}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* ── EDIT QUIZ PANEL ── */}
          {editingQuiz && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditingQuiz(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="apple-card max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h2 className="apple-title flex items-center gap-2"><Pencil className="h-4 w-4 text-amber-500" /> Edit Quiz</h2>
                    <p className="apple-subtitle">Changes replace all existing questions. Existing student attempts keep their original scores.</p>
                  </div>
                  <button onClick={() => setEditingQuiz(null)} className="p-1.5 rounded-[8px] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] cursor-pointer"><X className="h-4 w-4 text-[#6e6e73]" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Title</label><input type="text" value={editQuizTitle} onChange={e => setEditQuizTitle(e.target.value)} className="form-input" /></div>
                    <div><label className={lbl}>Duration (min)</label><input type="number" min="1" value={editQuizDuration} onChange={e => setEditQuizDuration(e.target.value)} className="form-input" /></div>
                    <div><label className={lbl}>Opens At (optional)</label><input type="datetime-local" value={editAvailableFrom} onChange={e => setEditAvailableFrom(e.target.value)} className="form-input" /></div>
                    <div><label className={lbl}>Closes At (optional)</label><input type="datetime-local" value={editAvailableUntil} onChange={e => setEditAvailableUntil(e.target.value)} className="form-input" /></div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[12px] font-bold text-[#3a3a3c] dark:text-white/70 uppercase tracking-wider">Questions ({editQuestions.length})</h3>
                    {editQuestions.length === 0 ? <div className="py-6 text-center text-[12px] text-[#6e6e73]"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-500" />Loading questions…</div> : editQuestions.map((q, idx) => (
                      <div key={q.uid} className="p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] space-y-3">
                        <div className="flex items-center justify-between"><span className="text-[11.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">Q{idx+1}</span>
                          {editQuestions.length > 1 && <button type="button" onClick={() => setEditQuestions(p => p.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                        <input type="text" value={q.text} onChange={e => handleEditQuestionChange(idx, "text", e.target.value)} placeholder="Question text" className="form-input" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => (
                            <div key={oi}><label className={lbl}>Option {["A","B","C","D"][oi]}</label>
                              <input type="text" value={opt} onChange={e => handleEditQuestionChange(idx, "option", e.target.value, oi)} className="form-input" />
                            </div>
                          ))}
                        </div>
                        <div><label className={lbl}>Correct Answer</label>
                          <select value={q.correctOption} onChange={e => handleEditQuestionChange(idx, "correctOption", e.target.value)} className="form-input">
                            <option value="">-- Select --</option>
                            {q.options.map((opt, oi) => <option key={oi} value={opt}>{["A","B","C","D"][oi]}: {opt}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditQuestions(p => [...p, { uid: crypto.randomUUID(), text: "", options: ["","","",""], correctOption: "" }])}
                      className="w-full py-2 border-2 border-dashed border-black/[0.10] dark:border-white/[0.10] hover:border-emerald-300 text-[12px] font-semibold text-[#6e6e73] hover:text-emerald-600 rounded-[10px] transition cursor-pointer">
                      + Add Question
                    </button>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setEditingQuiz(null)} className="flex-1 py-2.5 border border-black/[0.09] dark:border-white/[0.10] text-[13px] font-semibold text-[#3a3a3c] dark:text-white/60 rounded-[10px] hover:bg-black/[0.04] transition cursor-pointer">Cancel</button>
                    <button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 btn-gradient disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSavingEdit ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === "analytics" && (
            <motion.div className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              {lecturerAnalyticsLoading ? (
                <div className="apple-card p-10 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              ) : !lecturerAnalytics ? (
                <div className="apple-card">
                  <div className="apple-empty-state">
                    <div className="apple-empty-state__icon"><TrendingUp className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
                    <p className="apple-empty-state__title">No data yet</p>
                    <p className="apple-empty-state__body">Analytics appear once students start submitting assessments.</p>
                  </div>
                </div>
              ) : (() => {
                const { overview, distribution, courses: courseStats } = lecturerAnalytics as {
                  overview: { totalCourses: number; totalSubmissions: number; overallAvg: number | null; passRate: number | null };
                  distribution: Record<string, number>;
                  courses: Array<{
                    id: string; code: string; title: string; department: string | null;
                    quizCount: number; examCount: number; assignmentCount: number;
                    quizSubmissions: number; examSubmissions: number; assignmentSubmissions: number;
                    quizAvg: number | null; examAvg: number | null; assignmentAvg: number | null;
                    overallAvg: number | null; totalSubmissions: number;
                  }>;
                };
                const maxDist = Math.max(...Object.values(distribution), 1);
                const distBuckets = Object.entries(distribution);
                const gradeLetter = (pct: number) =>
                  pct >= 70 ? "A" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 40 ? "D" : "F";
                const gradeColor = (pct: number) =>
                  pct >= 70 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500";

                return (
                  <>
                    {/* Overview stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Courses", value: String(overview.totalCourses), sub: "registered", accent: "blue" },
                        { label: "Total Submissions", value: String(overview.totalSubmissions), sub: "graded", accent: "emerald" },
                        { label: "Class Average", value: overview.overallAvg != null ? `${overview.overallAvg.toFixed(1)}%` : "—", sub: overview.overallAvg != null ? `Grade ${gradeLetter(overview.overallAvg)}` : "no data", accent: "purple" },
                        { label: "Pass Rate", value: overview.passRate != null ? `${overview.passRate.toFixed(0)}%` : "—", sub: "≥50% threshold", accent: "green" },
                      ].map(s => (
                        <div key={s.label} className="apple-card px-4 py-4">
                          <p className="text-[10px] font-bold text-[#6e6e73] dark:text-white/35 uppercase tracking-widest mb-1">{s.label}</p>
                          <p className="text-[24px] font-bold text-[#1d1d1f] dark:text-white/90 leading-none tracking-tight">{s.value}</p>
                          <p className="text-[11px] text-[#8e8e93] dark:text-white/30 mt-1">{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Score Distribution */}
                      <div className="apple-card">
                        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                          <h3 className="apple-title">Score Distribution</h3>
                          <p className="apple-subtitle">How student scores spread across all assessments</p>
                        </div>
                        <div className="p-5">
                          {overview.totalSubmissions === 0 ? (
                            <p className="text-[12px] text-[#8e8e93] dark:text-white/35 text-center py-6">No graded submissions yet</p>
                          ) : (
                            <div className="space-y-3">
                              {distBuckets.map(([bucket, count]) => {
                                const pct = (count / maxDist) * 100;
                                const midPct = bucket === "0–49" ? 25 : bucket === "50–59" ? 55 : bucket === "60–69" ? 65 : bucket === "70–79" ? 75 : bucket === "80–89" ? 85 : 95;
                                return (
                                  <div key={bucket} className="flex items-center gap-3">
                                    <span className="text-[11px] font-mono font-bold text-[#6e6e73] dark:text-white/40 w-14 text-right flex-shrink-0">{bucket}</span>
                                    <div className="flex-1 h-6 rounded-[6px] bg-black/[0.04] dark:bg-white/[0.05] overflow-hidden relative">
                                      <div
                                        className={`h-full rounded-[6px] transition-all duration-500 ${gradeColor(midPct)}`}
                                        style={{ width: `${pct}%`, opacity: 0.85 }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-bold text-[#3a3a3c] dark:text-white/65 w-8 text-right flex-shrink-0">{count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Per-course averages */}
                      <div className="apple-card">
                        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                          <h3 className="apple-title">Course Performance</h3>
                          <p className="apple-subtitle">Average scores across all assessments per course</p>
                        </div>
                        <div className="p-5">
                          {courseStats.length === 0 ? (
                            <p className="text-[12px] text-[#8e8e93] dark:text-white/35 text-center py-6">No courses yet</p>
                          ) : (
                            <div className="space-y-4">
                              {courseStats.map(c => (
                                <div key={c.id}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="min-w-0">
                                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">{c.code}</span>
                                      <span className="text-[11px] text-[#6e6e73] dark:text-white/40 ml-2 truncate">{c.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                      {c.overallAvg != null ? (
                                        <>
                                          <span className="text-[11.5px] font-mono font-bold text-[#3a3a3c] dark:text-white/70">{c.overallAvg.toFixed(1)}%</span>
                                          <span className={`text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border ${
                                            c.overallAvg >= 70 ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                                            : c.overallAvg >= 50 ? "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                                            : "border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                                          }`}>{gradeLetter(c.overallAvg)}</span>
                                        </>
                                      ) : <span className="text-[11px] text-[#8e8e93] dark:text-white/30">—</span>}
                                    </div>
                                  </div>
                                  {c.overallAvg != null && (
                                    <div className="h-1.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-700 ${gradeColor(c.overallAvg)}`}
                                        style={{ width: `${Math.min(c.overallAvg, 100)}%` }} />
                                    </div>
                                  )}
                                  <div className="flex gap-3 mt-1.5 text-[10px] text-[#8e8e93] dark:text-white/30">
                                    <span>{c.quizSubmissions} quiz sub.</span>
                                    <span>{c.examSubmissions} exam sub.</span>
                                    <span>{c.assignmentSubmissions} assign. sub.</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Per-type breakdown table */}
                    <div className="apple-card overflow-hidden">
                      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                        <h3 className="apple-title">Assessment Breakdown</h3>
                        <p className="apple-subtitle">Average score and submission count per course, by assessment type</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                              {["Course", "Quizzes", "Exams", "Assignments", "Overall"].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#6e6e73] dark:text-white/35 uppercase tracking-widest">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                            {courseStats.map(c => (
                              <tr key={c.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition">
                                <td className="px-4 py-3">
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase">{c.code}</span>
                                  <span className="block text-[11px] text-[#6e6e73] dark:text-white/40 truncate max-w-[120px]">{c.title}</span>
                                </td>
                                {[
                                  { avg: c.quizAvg, count: c.quizSubmissions, n: c.quizCount },
                                  { avg: c.examAvg, count: c.examSubmissions, n: c.examCount },
                                  { avg: c.assignmentAvg, count: c.assignmentSubmissions, n: c.assignmentCount },
                                ].map((col, i) => (
                                  <td key={i} className="px-4 py-3">
                                    {col.n === 0 ? (
                                      <span className="text-[#c7c7cc] dark:text-white/20">—</span>
                                    ) : (
                                      <>
                                        <span className={`font-bold ${col.avg != null && col.avg >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                          {col.avg != null ? `${col.avg.toFixed(1)}%` : "—"}
                                        </span>
                                        <span className="block text-[10px] text-[#8e8e93] dark:text-white/30">{col.count} sub · {col.n} set</span>
                                      </>
                                    )}
                                  </td>
                                ))}
                                <td className="px-4 py-3">
                                  {c.overallAvg != null ? (
                                    <span className={`font-black text-[13px] ${c.overallAvg >= 70 ? "text-emerald-600 dark:text-emerald-400" : c.overallAvg >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                                      {c.overallAvg.toFixed(1)}%
                                    </span>
                                  ) : <span className="text-[#c7c7cc] dark:text-white/20">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* ── CALENDAR TAB ── */}
          {activeTab === "calendar" && <CalendarView token={token} />}

          {/* ── DISCUSSIONS TAB ── */}
          {activeTab === "discussions" && (
            <DiscussionBoard token={token} userId={user.id} userRole="lecturer" userName={user.name} courses={courses.map((c: any) => ({ id: c.id, code: c.code, title: c.title }))} />
          )}

          {/* ── ANNOUNCEMENTS TAB ── */}
          {activeTab === "announcements" && (
            <motion.div className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              <div className="apple-card">
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="apple-title flex items-center gap-2"><Megaphone className="h-4 w-4 text-emerald-500" /> Post Announcement</h2>
                  <p className="apple-subtitle">Notify all students instantly. A push notification is sent when you post.</p>
                </div>
                <form onSubmit={handlePostAnnouncement} className="p-6 space-y-4">
                  <div><label className={lbl}>Title</label><input required value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="e.g. Exam rescheduled to Friday" className="form-input" /></div>
                  <div><label className={lbl}>Message</label><textarea required rows={3} value={annBody} onChange={e => setAnnBody(e.target.value)} placeholder="Write your announcement here…" className="form-input resize-none" /></div>
                  <div><label className={lbl}>Tag Course (optional)</label>
                    <select value={annCourseId} onChange={e => setAnnCourseId(e.target.value)} className="form-input">
                      <option value="">All Students</option>
                      {courses.filter(c => c.lecturerId === user.id).map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={isPostingAnn} className="btn-gradient flex items-center gap-2 disabled:opacity-50">
                    {isPostingAnn ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</> : <><Send className="h-4 w-4" /> Post Announcement</>}
                  </button>
                </form>
              </div>
              <div className="apple-card">
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="apple-title">Posted Announcements</h2>
                </div>
                <div className="p-5">
                  {announcements.length === 0 ? (
                    <div className="apple-empty-state"><div className="apple-empty-state__icon"><Megaphone className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div><p className="apple-empty-state__title">No announcements yet</p></div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map(ann => (
                        <div key={ann.id} className="flex items-start justify-between gap-3 p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px]">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{ann.title}</p>
                              {ann.course && <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">{ann.course.code}</span>}
                            </div>
                            <p className="text-[12px] text-[#6e6e73] dark:text-white/50 leading-relaxed">{ann.body}</p>
                            <p className="text-[10.5px] font-mono text-[#6e6e73] dark:text-white/30 mt-1">{new Date(ann.createdAt).toLocaleString()}</p>
                          </div>
                          {ann.lecturerId === user.id && (
                            <button onClick={() => handleDeleteAnnouncement(ann.id)} className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-[8px] transition cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 5. COURSE REGISTRY ── */}
          {activeTab === "courses" && (
            <motion.div id="courses-panel" className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h2 className="apple-title">Course Registry</h2>
                <p className="apple-subtitle">Register new academic course modules.</p>
              </div>
              <div className="p-5 space-y-5">
                <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                  <div>
                    <label className={lbl}>Course Code</label>
                    <input type="text" required value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CSC301" className="form-input uppercase font-mono" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={lbl}>Course Title</label>
                    <input type="text" required value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. Database Systems" className="form-input" />
                  </div>
                  <div>
                    <label className={lbl}>Department</label>
                    <select value={courseDepId} onChange={(e) => setCourseDepId(e.target.value)} className="form-input">
                      <option value="">All Departments</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className={lbl}>Target Year Level</label>
                    <select value={courseTargetYear} onChange={(e) => setCourseTargetYear(e.target.value)} className="form-input">
                      <option value="">All Years</option>
                      <option value="Year 1">Year 1</option>
                      <option value="Year 2">Year 2</option>
                      <option value="Year 3">Year 3</option>
                      <option value="Year 4">Year 4</option>
                      <option value="Year 5">Year 5</option>
                    </select>
                  </div>
                  {(courseDepId || courseTargetYear) && (
                    <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Visible to:{" "}
                        <span className="font-bold">{courseDepId ? departments.find(d => d.id === courseDepId)?.name ?? "selected dept" : "all departments"}</span>
                        {" · "}
                        <span className="font-bold">{courseTargetYear || "all year levels"}</span>
                      </span>
                    </div>
                  )}
                  <button type="submit" className={`btn-gradient ${courseDepId || courseTargetYear ? "" : "md:col-span-4"}`} style={{ marginTop: "4px" }}>
                    Register Course
                  </button>
                </form>

                <div className="space-y-3">
                  <p className="text-[12px] font-bold text-[#6e6e73] dark:text-white/35 uppercase tracking-widest">Registered Modules ({courses.length})</p>
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse" id="courses-skeleton">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] flex items-center justify-between">
                          <div className="space-y-2 w-2/3">
                            <div className="h-3 bg-black/[0.06] dark:bg-white/[0.06] rounded-md w-16" />
                            <div className="h-4 bg-black/[0.06] dark:bg-white/[0.06] rounded-md w-full" />
                          </div>
                          <div className="h-5 bg-black/[0.06] dark:bg-white/[0.06] rounded-full w-16" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {courses.map((c) => (
                        <div key={c.id} className="p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.02] hover:border-emerald-200 dark:hover:border-emerald-800/40 hover:shadow-sm transition-all duration-200 gap-3">
                          <div className="min-w-0">
                            <span className="block font-mono text-[12px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">{c.code}</span>
                            <span className="block text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/85 leading-tight mt-0.5 truncate">{c.title}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {c.department
                                ? <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 border border-emerald-100 dark:border-emerald-900/30 rounded-full">{c.department.name}</span>
                                : <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 border border-blue-100 dark:border-blue-900/30 rounded-full">All Depts</span>
                              }
                              {(c as any).targetYear
                                ? <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 border border-amber-100 dark:border-amber-900/30 rounded-full">{(c as any).targetYear}</span>
                                : <span className="text-[10px] font-bold bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 px-2 py-0.5 border border-slate-100 dark:border-white/[0.06] rounded-full">All Years</span>
                              }
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-mono font-bold bg-black/[0.04] dark:bg-white/[0.05] text-[#6e6e73] dark:text-white/40 px-2.5 py-1 border border-black/[0.07] dark:border-white/[0.07] rounded-full">
                              {c._count?.notes || 0} notes
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 6. DEPARTMENTS ── */}
          {activeTab === "departments" && (
            <motion.div id="departments-panel" className="space-y-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
              {/* Create form */}
              <div className="apple-card">
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <h2 className="apple-title">Academic Departments</h2>
                  <p className="apple-subtitle">Establish departments — courses and students are linked to them.</p>
                </div>
                <div className="p-5">
                  <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                    <div className="md:col-span-2">
                      <label htmlFor="dept-name" className={lbl}>New Department Name</label>
                      <input id="dept-name" type="text" required value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Information Technology" className="form-input" />
                    </div>
                    <button type="submit" className="btn-gradient" style={{ marginTop: "24px" }}>
                      Create
                    </button>
                  </form>
                </div>
              </div>

              {/* Stats grid */}
              {deptStats.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[12px] font-bold text-[#6e6e73] dark:text-white/35 uppercase tracking-widest">Departments ({deptStats.length})</p>
                  <div className="grid grid-cols-1 gap-4">
                    {deptStats.map((dept) => (
                      <div key={dept.id} className="apple-card p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-[14px] font-bold text-[#1d1d1f] dark:text-white/90">{dept.name}</h3>
                            <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                              {dept.courseCount} course{dept.courseCount !== 1 ? "s" : ""} assigned
                            </p>
                          </div>
                          {dept.avgScore !== null && (
                            <div className={`text-center px-3 py-2 rounded-[10px] ${dept.avgScore >= 50 ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30" : "bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30"}`}>
                              <p className={`text-[18px] font-black ${dept.avgScore >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{dept.avgScore.toFixed(1)}%</p>
                              <p className="text-[10px] font-bold text-[#6e6e73] dark:text-white/40 uppercase tracking-wide">Avg Score</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[10px]">
                            <p className="text-[16px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{dept.studentCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/35 mt-0.5">Students</p>
                          </div>
                          <div className="text-center p-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[10px]">
                            <p className="text-[16px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{dept.courseCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/35 mt-0.5">Courses</p>
                          </div>
                          <div className="text-center p-3 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[10px]">
                            <p className="text-[16px] font-black text-[#1d1d1f] dark:text-white/90 tabular-nums">{dept.gradedCount}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/35 mt-0.5">Graded</p>
                          </div>
                        </div>
                        {dept.courseCount === 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 text-center">No courses assigned yet — assign via Course Registry</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : departments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.02]">
                      <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-white/85">{dept.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                  <Users className="h-7 w-7 text-black/20 dark:text-white/20 mx-auto mb-2" />
                  <p className="text-[12px] text-[#6e6e73] dark:text-white/40 font-medium">No departments established yet.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── 7. WRITTEN EXAMS ── */}
          {activeTab === "exams" && (
            <div className="space-y-5">
              {!selectedExam ? (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h2 className="apple-title">Written Exams: AI Grading</h2>
                    <p className="apple-subtitle">Upload a document with exam questions. Students type their answers. Upload the answer key and the AI grades automatically.</p>
                  </div>
                  <div className="p-5 space-y-5">
                    <form onSubmit={handleCreateExam} className="space-y-4 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Create New Exam</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Exam Title</label>
                          <input type="text" required value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="e.g. CSC301 Mid-Semester Examination" className="form-input" />
                        </div>
                        <div>
                          <label className={lbl}>Course</label>
                          <select value={examCourseId} onChange={e => setExamCourseId(e.target.value)} className="form-input">
                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                          </select>
                          {audienceBadge(examCourseId)}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Opens At <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional)</span></label>
                          <input type="datetime-local" value={examAvailableFrom} onChange={e => setExamAvailableFrom(e.target.value)} className="form-input" />
                        </div>
                        <div>
                          <label className={lbl}>Closes At <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional)</span></label>
                          <input type="datetime-local" value={examAvailableUntil} onChange={e => setExamAvailableUntil(e.target.value)} className="form-input" />
                        </div>
                      </div>

                      {/* Step 1: Upload questions */}
                      <div className="space-y-3 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Step 1 — Upload Questions</p>
                        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-black/[0.10] dark:border-white/[0.12] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors">
                          <Upload className="h-5 w-5 text-[#6e6e73] dark:text-white/40 shrink-0" />
                          <span className="text-[12.5px] text-[#6e6e73] dark:text-white/50">{examFile ? examFile.name : "Click to choose file (.docx or .txt)"}</span>
                          <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setExamFile(e.target.files?.[0] ?? null); setExamQText(""); setExamParsedStructure(null); }} />
                        </label>
                        <div className="relative flex items-center gap-3">
                          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                          <span className="text-[11px] font-semibold text-[#6e6e73] dark:text-white/40 uppercase tracking-wider">or paste text</span>
                          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                        </div>
                        <textarea rows={4} value={examQText} onChange={e => { setExamQText(e.target.value); setExamFile(null); setExamParsedStructure(null); }} placeholder="Paste your exam questions here..." className="form-input resize-none" />
                        <button type="button" onClick={handleParseExamQuestions} disabled={isParsingExam} className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-60">
                          {isParsingExam ? <><Loader2 className="h-4 w-4 animate-spin" />Parsing questions with AI…</> : <><Star className="h-4 w-4" />Parse Questions with AI →</>}
                        </button>
                      </div>

                      {/* Step 2: Marks + answers per question */}
                      {examParsedStructure && examParsedStructure.length > 0 && (
                        <div className="space-y-4 border border-emerald-200 dark:border-emerald-900/40 rounded-[12px] p-4 bg-emerald-50/30 dark:bg-emerald-950/10">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Step 2 — Answer Key &amp; Marks</p>
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/50">For each question, type the model answer and assign marks.</p>
                          {examParsedStructure.map((q: any) => {
                            const hasSubqs = q.subqs?.length > 0;
                            const qTotal = hasSubqs
                              ? q.subqs.reduce((s: number, sq: any) => s + (parseFloat(examQMarks[`${q.label}${sq.label}`] ?? "0") || 0), 0)
                              : (parseFloat(examQMarks[q.label] ?? "0") || 0);
                            return (
                              <div key={q.label} className="space-y-3 border border-black/[0.07] dark:border-white/[0.07] rounded-[10px] p-3 bg-white/60 dark:bg-white/[0.03]">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12px] font-bold text-[#1d1d1f] dark:text-white/90">Q{q.label}: <span className="font-normal text-[#3a3a3c] dark:text-white/60">{q.text}</span></p>
                                  {hasSubqs && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Total: {qTotal} marks</span>}
                                </div>
                                {hasSubqs ? q.subqs.map((sq: any) => {
                                  const key = `${q.label}${sq.label}`;
                                  return (
                                    <div key={key} className="pl-3 border-l-2 border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
                                      <p className="text-[11px] font-semibold text-[#3a3a3c] dark:text-white/70">{key}) {sq.text}</p>
                                      <div className="flex gap-2 items-start">
                                        <textarea rows={2} placeholder={`Model answer for ${key}…`} value={examQAnswers[key] ?? ""} onChange={e => setExamQAnswers(p => ({ ...p, [key]: e.target.value }))} className="form-input resize-none flex-1 text-[12px]" />
                                        <div className="flex flex-col gap-1 w-20 shrink-0">
                                          <label className="text-[10px] text-[#6e6e73] dark:text-white/40 font-semibold uppercase">Marks</label>
                                          <input type="number" min="0" step="0.5" placeholder="0" value={examQMarks[key] ?? ""} onChange={e => setExamQMarks(p => ({ ...p, [key]: e.target.value }))} className="form-input text-[12px] text-center" />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }) : (
                                  <div className="flex gap-2 items-start">
                                    <textarea rows={2} placeholder={`Model answer for Q${q.label}…`} value={examQAnswers[q.label] ?? ""} onChange={e => setExamQAnswers(p => ({ ...p, [q.label]: e.target.value }))} className="form-input resize-none flex-1 text-[12px]" />
                                    <div className="flex flex-col gap-1 w-20 shrink-0">
                                      <label className="text-[10px] text-[#6e6e73] dark:text-white/40 font-semibold uppercase">Marks</label>
                                      <input type="number" min="0" step="0.5" placeholder="0" value={examQMarks[q.label] ?? ""} onChange={e => setExamQMarks(p => ({ ...p, [q.label]: e.target.value }))} className="form-input text-[12px] text-center" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="text-right text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Grand total: {examParsedStructure.reduce((total: number, q: any) => {
                              if (q.subqs?.length > 0) return total + q.subqs.reduce((s: number, sq: any) => s + (parseFloat(examQMarks[`${q.label}${sq.label}`] ?? "0") || 0), 0);
                              return total + (parseFloat(examQMarks[q.label] ?? "0") || 0);
                            }, 0)} marks
                          </div>
                        </div>
                      )}

                      <button type="submit" disabled={!examParsedStructure} className="btn-gradient w-full disabled:opacity-40">
                        {examParsedStructure ? "Create Exam & Save Answer Key" : "Parse Questions First (Step 1)"}
                      </button>
                    </form>

                    <div className="space-y-3">
                      <p className={lbl}>All Exams ({exams.length})</p>
                      {exams.length === 0 ? (
                        <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                          <FileText className="h-7 w-7 text-black/20 dark:text-white/20 mx-auto mb-2" />
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No exams created yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {exams.map(exam => (
                            <button key={exam.id} onClick={() => { setSelectedExam(exam); fetchExamSubmissions(exam.id); }}
                              className="w-full text-left p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{exam.title}</p>
                                <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                                  {exam.course?.code} · {exam._count?.submissions ?? 0} submission{exam._count?.submissions !== 1 ? "s" : ""} · {(exam.answerKeyText || exam.answerKeyJson) ? "✓ Answer key uploaded" : "⚠ No answer key yet"}
                                  {exam.availableFrom && <> · Opens {new Date(exam.availableFrom).toLocaleString()}</>}
                                  {exam.availableUntil && <> · Closes {new Date(exam.availableUntil).toLocaleString()}</>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${exam.isOpen ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30" : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"}`}>
                                  {exam.isOpen ? "Open" : "Closed"}
                                </span>
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Manage →</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => { setSelectedExam(null); setExamSubmissions([]); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Exams
                  </button>

                  <div className="apple-card">
                    <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="apple-title">{selectedExam.title}</h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-white/40 mt-0.5">{selectedExam.course?.code} · {examSubmissions.length} submissions</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleExam(selectedExam.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] border transition-colors border-black/[0.09] dark:border-white/[0.10] hover:border-emerald-300 text-[#3a3a3c] dark:text-white/60">
                          {selectedExam.isOpen ? "Close Exam" : "Reopen Exam"}
                        </button>
                        <button onClick={() => handleDeleteExam(selectedExam.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      <div>
                        <p className={lbl}>Exam Questions</p>
                        <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedExam.questionsText}</pre>
                      </div>
                      <div className="space-y-3 border-t border-black/[0.06] dark:border-white/[0.05] pt-4">
                        <p className={lbl + " flex items-center gap-1.5"}>{(selectedExam.answerKeyText || selectedExam.answerKeyJson) ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Answer Key (Replace)</> : "Upload Answer Key"}</p>
                        {selectedExam.answerKeyText && (
                          <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">{selectedExam.answerKeyText}</pre>
                        )}
                        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-black/[0.10] dark:border-white/[0.12] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors">
                          <Upload className="h-4 w-4 text-[#6e6e73] dark:text-white/40 shrink-0" />
                          <span className="text-[12px] text-[#6e6e73] dark:text-white/50">{answerKeyFile ? answerKeyFile.name : "Upload answer key (.docx or .txt)"}</span>
                          <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setAnswerKeyFile(e.target.files?.[0] ?? null); setAnswerKeyText(""); }} />
                        </label>
                        <textarea rows={4} value={answerKeyText} onChange={e => { setAnswerKeyText(e.target.value); setAnswerKeyFile(null); }} placeholder="Or paste answer key text..." className="form-input resize-none" />
                        <div>
                          <p className={lbl}>Marks Per Question <span className="text-[#6e6e73] dark:text-white/40 font-normal">(optional — comma-separated, e.g. 5,10,5,3)</span></p>
                          <input type="text" value={answerKeyMarks} onChange={e => setAnswerKeyMarks(e.target.value)} placeholder="e.g. 5,10,5,3" className="form-input" />
                          {answerKeyMarks.trim() && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                              Total: {answerKeyMarks.split(",").map(m => parseFloat(m.trim())).filter(m => !isNaN(m) && m > 0).reduce((a, b) => a + b, 0)} marks
                            </p>
                          )}
                          {selectedExam.marksText && !answerKeyMarks.trim() && (
                            <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-1">Current: {selectedExam.marksText}</p>
                          )}
                        </div>
                        <button onClick={() => handleUploadAnswerKey(selectedExam.id)} className="btn-gradient w-full">
                          {selectedExam.answerKeyText ? "Replace Answer Key" : "Upload Answer Key"}
                        </button>
                      </div>
                      {(selectedExam.answerKeyText || selectedExam.answerKeyJson) && examSubmissions.length > 0 && (
                        <div className="border-t border-black/[0.06] dark:border-white/[0.05] pt-4">
                          <button onClick={() => handleGradeAll(selectedExam.id)} disabled={isGrading}
                            className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-60">
                            {isGrading
                              ? <><Loader2 className="h-4 w-4 animate-spin" />{gradingProgress ? `Grading ${gradingProgress.done}/${gradingProgress.total}…` : "Starting…"}</>
                              : <><Star className="h-4 w-4" />Grade All with AI</>}
                          </button>
                          {isGrading && gradingProgress && (
                            <div className="mt-2 w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(gradingProgress.done / gradingProgress.total) * 100}%` }} />
                            </div>
                          )}
                          <p className="text-[11px] text-[#6e6e73] dark:text-white/40 text-center mt-1.5">Or expand a submission below to set a manual mark</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="apple-card">
                    <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                      <h3 className="apple-title">Student Submissions ({examSubmissions.length})</h3>
                    </div>
                    <div className="p-5">
                      {examSubmissions.length === 0 ? (
                        <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No submissions yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {examSubmissions.map(sub => (
                            <div key={sub.id} className="border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] overflow-hidden">
                              <button onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{sub.student?.fullName?.[0] ?? "?"}</span>
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{sub.student?.fullName}</p>
                                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40">{sub.student?.regNumber} · {new Date(sub.submittedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {sub.isGraded ? (() => {
                                    const pct = sub.totalMarks ? ((sub.score ?? 0) / sub.totalMarks) * 100 : (sub.score ?? 0);
                                    const pass = pct >= 50;
                                    return (
                                      <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${pass ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/40 text-red-500"}`}>
                                        {sub.totalMarks ? `${sub.score?.toFixed(1)} / ${sub.totalMarks}` : `${sub.score?.toFixed(1)}%`}
                                      </span>
                                    );
                                  })() : (
                                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">Pending</span>
                                  )}
                                  {expandedSubmission === sub.id ? <ChevronUp className="h-4 w-4 text-[#6e6e73] dark:text-white/40" /> : <ChevronDown className="h-4 w-4 text-[#6e6e73] dark:text-white/40" />}
                                </div>
                              </button>
                              {expandedSubmission === sub.id && (
                                <div className="border-t border-black/[0.06] dark:border-white/[0.05] p-4 space-y-3 bg-black/[0.01] dark:bg-white/[0.01]">
                                  <div>
                                    <p className={lbl}>Student's Answers</p>
                                    <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{sub.answersText}</pre>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 border-t border-black/[0.06] dark:border-white/[0.05]">
                                    {sub.isGraded && sub.score != null && (
                                      <span className="text-[12px] text-[#6e6e73] dark:text-white/50 shrink-0">
                                        Current: <strong className="text-[#1d1d1f] dark:text-white/80">{sub.score}{sub.totalMarks ? ` / ${sub.totalMarks}` : ""}</strong>
                                      </span>
                                    )}
                                    <input
                                      type="number" min="0" step="0.5"
                                      placeholder="Add marks"
                                      value={manualScoreInputs[sub.id] ?? ""}
                                      onChange={e => setManualScoreInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                      className="form-input w-24 text-[13px]"
                                    />
                                    <button onClick={() => handleAddMarks("exam", selectedExam.id, sub.id)} className="btn-gradient px-4 py-2 text-[12px] font-semibold">
                                      Add
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 8. ASSIGNMENTS ── */}
          {activeTab === "assignments" && (
            <div className="space-y-5">
              {!selectedAssignment ? (
                <motion.div className="apple-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h2 className="apple-title">Assignments</h2>
                    <p className="apple-subtitle">Post take-home assignments. Students type and submit their answers. Upload an answer key to enable AI grading.</p>
                  </div>
                  <div className="p-5 space-y-5">
                    <form onSubmit={handleCreateAssignment} className="space-y-4 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[12px] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Create New Assignment</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Assignment Title</label>
                          <input type="text" required value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="e.g. CSC301 Week 5 Assignment" className="form-input" />
                        </div>
                        <div>
                          <label className={lbl}>Course</label>
                          <select value={assignmentCourseId} onChange={e => setAssignmentCourseId(e.target.value)} className="form-input">
                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                          </select>
                          {audienceBadge(assignmentCourseId)}
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Description <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional)</span></label>
                        <input type="text" value={assignmentDescription} onChange={e => setAssignmentDescription(e.target.value)} placeholder="Brief instructions for students..." className="form-input" />
                      </div>
                      <div>
                        <label className={lbl}>Due Date <span className="normal-case font-normal text-[#6e6e73] dark:text-white/30">(optional — blocks submissions after this)</span></label>
                        <input type="datetime-local" value={assignmentDueDate} onChange={e => setAssignmentDueDate(e.target.value)} className="form-input" />
                      </div>
                      {/* Step 1: Upload questions */}
                      <div className="space-y-3 border border-black/[0.07] dark:border-white/[0.07] rounded-[12px] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Step 1 — Upload Questions</p>
                        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-black/[0.10] dark:border-white/[0.12] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors">
                          <Upload className="h-5 w-5 text-[#6e6e73] dark:text-white/40 shrink-0" />
                          <span className="text-[12.5px] text-[#6e6e73] dark:text-white/50">{assignmentFile ? assignmentFile.name : "Click to choose file (.docx or .txt)"}</span>
                          <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setAssignmentFile(e.target.files?.[0] ?? null); setAssignmentQText(""); setAssignmentParsedStructure(null); }} />
                        </label>
                        <div className="relative flex items-center gap-3">
                          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                          <span className="text-[11px] font-semibold text-[#6e6e73] dark:text-white/40 uppercase tracking-wider">or paste text</span>
                          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
                        </div>
                        <textarea rows={4} value={assignmentQText} onChange={e => { setAssignmentQText(e.target.value); setAssignmentFile(null); setAssignmentParsedStructure(null); }} placeholder="Paste assignment questions here..." className="form-input resize-none" />
                        <button type="button" onClick={handleParseAssignmentQuestions} disabled={isParsingAssignment} className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-60">
                          {isParsingAssignment ? <><Loader2 className="h-4 w-4 animate-spin" />Parsing questions with AI…</> : <><Star className="h-4 w-4" />Parse Questions with AI →</>}
                        </button>
                      </div>

                      {/* Step 2: Marks + answers per question */}
                      {assignmentParsedStructure && assignmentParsedStructure.length > 0 && (
                        <div className="space-y-4 border border-emerald-200 dark:border-emerald-900/40 rounded-[12px] p-4 bg-emerald-50/30 dark:bg-emerald-950/10">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Step 2 — Answer Key &amp; Marks</p>
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/50">For each question, type the model answer and assign marks.</p>
                          {assignmentParsedStructure.map((q: any) => {
                            const hasSubqs = q.subqs?.length > 0;
                            const qTotal = hasSubqs
                              ? q.subqs.reduce((s: number, sq: any) => s + (parseFloat(assignmentQMarks[`${q.label}${sq.label}`] ?? "0") || 0), 0)
                              : (parseFloat(assignmentQMarks[q.label] ?? "0") || 0);
                            return (
                              <div key={q.label} className="space-y-3 border border-black/[0.07] dark:border-white/[0.07] rounded-[10px] p-3 bg-white/60 dark:bg-white/[0.03]">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12px] font-bold text-[#1d1d1f] dark:text-white/90">Q{q.label}: <span className="font-normal text-[#3a3a3c] dark:text-white/60">{q.text}</span></p>
                                  {hasSubqs && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Total: {qTotal} marks</span>}
                                </div>
                                {hasSubqs ? q.subqs.map((sq: any) => {
                                  const key = `${q.label}${sq.label}`;
                                  return (
                                    <div key={key} className="pl-3 border-l-2 border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
                                      <p className="text-[11px] font-semibold text-[#3a3a3c] dark:text-white/70">{key}) {sq.text}</p>
                                      <div className="flex gap-2 items-start">
                                        <textarea rows={2} placeholder={`Model answer for ${key}…`} value={assignmentQAnswers[key] ?? ""} onChange={e => setAssignmentQAnswers(p => ({ ...p, [key]: e.target.value }))} className="form-input resize-none flex-1 text-[12px]" />
                                        <div className="flex flex-col gap-1 w-20 shrink-0">
                                          <label className="text-[10px] text-[#6e6e73] dark:text-white/40 font-semibold uppercase">Marks</label>
                                          <input type="number" min="0" step="0.5" placeholder="0" value={assignmentQMarks[key] ?? ""} onChange={e => setAssignmentQMarks(p => ({ ...p, [key]: e.target.value }))} className="form-input text-[12px] text-center" />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }) : (
                                  <div className="flex gap-2 items-start">
                                    <textarea rows={2} placeholder={`Model answer for Q${q.label}…`} value={assignmentQAnswers[q.label] ?? ""} onChange={e => setAssignmentQAnswers(p => ({ ...p, [q.label]: e.target.value }))} className="form-input resize-none flex-1 text-[12px]" />
                                    <div className="flex flex-col gap-1 w-20 shrink-0">
                                      <label className="text-[10px] text-[#6e6e73] dark:text-white/40 font-semibold uppercase">Marks</label>
                                      <input type="number" min="0" step="0.5" placeholder="0" value={assignmentQMarks[q.label] ?? ""} onChange={e => setAssignmentQMarks(p => ({ ...p, [q.label]: e.target.value }))} className="form-input text-[12px] text-center" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="text-right text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Grand total: {assignmentParsedStructure.reduce((total: number, q: any) => {
                              if (q.subqs?.length > 0) return total + q.subqs.reduce((s: number, sq: any) => s + (parseFloat(assignmentQMarks[`${q.label}${sq.label}`] ?? "0") || 0), 0);
                              return total + (parseFloat(assignmentQMarks[q.label] ?? "0") || 0);
                            }, 0)} marks
                          </div>
                        </div>
                      )}

                      <button type="submit" disabled={!assignmentParsedStructure} className="btn-gradient w-full disabled:opacity-40">
                        {assignmentParsedStructure ? "Post Assignment & Save Answer Key" : "Parse Questions First (Step 1)"}
                      </button>
                    </form>

                    <div className="space-y-3">
                      <p className={lbl}>All Assignments ({assignments.length})</p>
                      {assignments.length === 0 ? (
                        <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                          <Pencil className="h-7 w-7 text-black/20 dark:text-white/20 mx-auto mb-2" />
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No assignments created yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {assignments.map(a => (
                            <button key={a.id} onClick={() => { setSelectedAssignment(a); fetchAssignmentSubmissions(a.id); }}
                              className="w-full text-left p-4 border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] bg-black/[0.01] dark:bg-white/[0.02] hover:border-emerald-300/60 dark:hover:border-emerald-700/40 hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{a.title}</p>
                                <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                                  {a.course?.code} · {a._count?.submissions ?? 0} submission{a._count?.submissions !== 1 ? "s" : ""} · {(a.answerKeyText || a.answerKeyJson) ? "✓ Answer key uploaded" : "⚠ No answer key yet"}
                                  {a.dueDate && <> · Due {new Date(a.dueDate).toLocaleString()}</>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${a.isOpen ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30" : "bg-black/[0.04] dark:bg-white/[0.04] text-[#6e6e73] dark:text-white/40 border-black/[0.07] dark:border-white/[0.07]"}`}>
                                  {a.isOpen ? "Open" : "Closed"}
                                </span>
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Manage →</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => { setSelectedAssignment(null); setAssignmentSubmissions([]); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Assignments
                  </button>

                  <div className="apple-card">
                    <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="apple-title">{selectedAssignment.title}</h2>
                        <p className="text-[12px] text-[#6e6e73] dark:text-white/40 mt-0.5">{selectedAssignment.course?.code} · {assignmentSubmissions.length} submissions{selectedAssignment.dueDate && ` · Due ${new Date(selectedAssignment.dueDate).toLocaleString()}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleAssignment(selectedAssignment.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] border transition-colors border-black/[0.09] dark:border-white/[0.10] hover:border-emerald-300 text-[#3a3a3c] dark:text-white/60">
                          {selectedAssignment.isOpen ? "Close" : "Reopen"}
                        </button>
                        <button onClick={() => handleDeleteAssignment(selectedAssignment.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      {selectedAssignment.description && (
                        <div>
                          <p className={lbl}>Description</p>
                          <p className="text-[13px] text-[#3a3a3c] dark:text-white/70">{selectedAssignment.description}</p>
                        </div>
                      )}
                      <div>
                        <p className={lbl}>Assignment Questions</p>
                        <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedAssignment.questionsText}</pre>
                      </div>
                      <div className="space-y-3 border-t border-black/[0.06] dark:border-white/[0.05] pt-4">
                        <p className={lbl + " flex items-center gap-1.5"}>{(selectedAssignment.answerKeyText || selectedAssignment.answerKeyJson) ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Answer Key (Replace)</> : "Upload Answer Key"}</p>
                        {selectedAssignment.answerKeyText && (
                          <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-[10px] p-4 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">{selectedAssignment.answerKeyText}</pre>
                        )}
                        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-black/[0.10] dark:border-white/[0.12] rounded-[10px] cursor-pointer hover:border-emerald-400 transition-colors">
                          <Upload className="h-4 w-4 text-[#6e6e73] dark:text-white/40 shrink-0" />
                          <span className="text-[12px] text-[#6e6e73] dark:text-white/50">{assignmentKeyFile ? assignmentKeyFile.name : "Upload answer key (.docx or .txt)"}</span>
                          <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setAssignmentKeyFile(e.target.files?.[0] ?? null); setAssignmentKeyText(""); }} />
                        </label>
                        <textarea rows={4} value={assignmentKeyText} onChange={e => { setAssignmentKeyText(e.target.value); setAssignmentKeyFile(null); }} placeholder="Or paste answer key text..." className="form-input resize-none" />
                        <div>
                          <p className={lbl}>Marks Per Question <span className="text-[#6e6e73] dark:text-white/40 font-normal">(optional — comma-separated, e.g. 5,10,5,3)</span></p>
                          <input type="text" value={assignmentKeyMarks} onChange={e => setAssignmentKeyMarks(e.target.value)} placeholder="e.g. 5,10,5,3" className="form-input" />
                          {assignmentKeyMarks.trim() && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                              Total: {assignmentKeyMarks.split(",").map(m => parseFloat(m.trim())).filter(m => !isNaN(m) && m > 0).reduce((a, b) => a + b, 0)} marks
                            </p>
                          )}
                          {selectedAssignment.marksText && !assignmentKeyMarks.trim() && (
                            <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-1">Current: {selectedAssignment.marksText}</p>
                          )}
                        </div>
                        <button onClick={() => handleUploadAssignmentKey(selectedAssignment.id)} className="btn-gradient w-full">
                          {selectedAssignment.answerKeyText ? "Replace Answer Key" : "Upload Answer Key"}
                        </button>
                      </div>
                      {(selectedAssignment.answerKeyText || selectedAssignment.answerKeyJson) && assignmentSubmissions.length > 0 && (
                        <div className="border-t border-black/[0.06] dark:border-white/[0.05] pt-4">
                          <button onClick={() => handleGradeAssignments(selectedAssignment.id)} disabled={isGradingAssignment}
                            className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-60">
                            {isGradingAssignment
                              ? <><Loader2 className="h-4 w-4 animate-spin" />{gradingAssignmentProgress ? `Grading ${gradingAssignmentProgress.done}/${gradingAssignmentProgress.total}…` : "Starting…"}</>
                              : <><Star className="h-4 w-4" />Grade All with AI</>}
                          </button>
                          {isGradingAssignment && gradingAssignmentProgress && (
                            <div className="mt-2 w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(gradingAssignmentProgress.done / gradingAssignmentProgress.total) * 100}%` }} />
                            </div>
                          )}
                          <p className="text-[11px] text-[#6e6e73] dark:text-white/40 text-center mt-1.5">Or expand a submission below to set a manual mark</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="apple-card">
                    <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                      <h3 className="apple-title">Student Submissions ({assignmentSubmissions.length})</h3>
                    </div>
                    <div className="p-5">
                      {assignmentSubmissions.length === 0 ? (
                        <div className="py-10 text-center border border-dashed border-black/[0.10] dark:border-white/[0.10] rounded-[12px]">
                          <p className="text-[12px] text-[#6e6e73] dark:text-white/40">No submissions yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {assignmentSubmissions.map(sub => (
                            <div key={sub.id} className="border border-black/[0.07] dark:border-white/[0.06] rounded-[12px] overflow-hidden">
                              <button onClick={() => setExpandedAssignmentSub(expandedAssignmentSub === sub.id ? null : sub.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{sub.student?.fullName?.[0] ?? "?"}</span>
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90">{sub.student?.fullName}</p>
                                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40">{sub.student?.regNumber} · {new Date(sub.submittedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {sub.isGraded ? (() => {
                                    const pct = sub.totalMarks ? ((sub.score ?? 0) / sub.totalMarks) * 100 : (sub.score ?? 0);
                                    const pass = pct >= 50;
                                    return (
                                      <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${pass ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/40 text-red-500"}`}>
                                        {sub.totalMarks ? `${sub.score?.toFixed(1)} / ${sub.totalMarks}` : `${sub.score?.toFixed(1)}%`}
                                      </span>
                                    );
                                  })() : (
                                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">Pending</span>
                                  )}
                                  {expandedAssignmentSub === sub.id ? <ChevronUp className="h-4 w-4 text-[#6e6e73] dark:text-white/40" /> : <ChevronDown className="h-4 w-4 text-[#6e6e73] dark:text-white/40" />}
                                </div>
                              </button>
                              {expandedAssignmentSub === sub.id && (
                                <div className="border-t border-black/[0.06] dark:border-white/[0.05] p-4 space-y-3 bg-black/[0.01] dark:bg-white/[0.01]">
                                  {sub.answersText && (
                                    <div>
                                      <p className={lbl}>Student's Answers</p>
                                      <pre className="text-[12px] text-[#3a3a3c] dark:text-white/60 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] rounded-[10px] p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{sub.answersText}</pre>
                                    </div>
                                  )}
                                  {sub.attachmentName && (
                                    <div>
                                      <p className={lbl}>Attached File</p>
                                      {sub.attachmentData ? (
                                        <a href={sub.attachmentData} download={sub.attachmentName}
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 text-[12.5px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-950/30 transition">
                                          <Download className="h-3.5 w-3.5" />
                                          {sub.attachmentName}
                                        </a>
                                      ) : (
                                        <span className="text-[12px] text-[#6e6e73] dark:text-white/40">{sub.attachmentName}</span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 pt-1 border-t border-black/[0.06] dark:border-white/[0.05]">
                                    {sub.isGraded && sub.score != null && (
                                      <span className="text-[12px] text-[#6e6e73] dark:text-white/50 shrink-0">
                                        Current: <strong className="text-[#1d1d1f] dark:text-white/80">{sub.score}{sub.totalMarks ? ` / ${sub.totalMarks}` : ""}</strong>
                                      </span>
                                    )}
                                    <input
                                      type="number" min="0" step="0.5"
                                      placeholder="Add marks"
                                      value={manualScoreInputs[sub.id] ?? ""}
                                      onChange={e => setManualScoreInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                      className="form-input w-24 text-[13px]"
                                    />
                                    <button onClick={() => handleAddMarks("assignment", selectedAssignment.id, sub.id)} className="btn-gradient px-4 py-2 text-[12px] font-semibold">
                                      Add
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
            { id: "gradebook",    label: "Grades"      },
            { id: "live-lecture", label: "Live"        },
            { id: "quizzes",      label: "Quizzes"     },
            { id: "exams",        label: "Exams"       },
            { id: "assignments",  label: "Tasks"       },
          ] as const).map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.id === "gradebook" ? ClipboardList
              : item.id === "live-lecture" ? Radio
              : item.id === "quizzes" ? Award
              : item.id === "assignments" ? Pencil
              : FileText;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  if (item.id === "gradebook") fetchGradebook();
                }}
                className="flex flex-col items-center justify-center gap-[5px] min-w-[52px] min-h-[44px] px-1.5 rounded-[14px] transition-all"
                style={{ transform: isActive ? "scale(1.06)" : "scale(1)", transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"} ${item.id === "live-lecture" && broadcastingSession ? "text-red-500 animate-pulse" : ""}`}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                <span className={`text-[9.5px] font-semibold tracking-[0.01em] transition-colors ${isActive ? "text-emerald-500" : "text-[#8e8e93]"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── MOBILE HAMBURGER DRAWER (lecturer) ── */}
      <AnimatePresence>
        {mobileLecturerOpen && (
          <>
            <motion.div
              className="sm:hidden fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileLecturerOpen(false)}
            />
            <motion.div
              className="sm:hidden fixed top-0 left-0 bottom-0 z-[201] w-[280px] flex flex-col apple-sidebar shadow-2xl"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
            >
              {/* Close + logo */}
              <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-[6px]">
                  <span className="h-[13px] w-[13px] rounded-full bg-[#ff5f57] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)] cursor-pointer" onClick={() => setMobileLecturerOpen(false)} />
                  <span className="h-[13px] w-[13px] rounded-full bg-[#ffbd2e] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)]" />
                  <span className="h-[13px] w-[13px] rounded-full bg-[#28c840] shadow-[0_0_0_0.5px_rgba(0,0,0,0.14)]" />
                </div>
                <button onClick={() => setMobileLecturerOpen(false)} className="p-1.5 rounded-[8px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition">
                  <X className="h-4 w-4 text-[#6e6e73] dark:text-white/50" />
                </button>
              </div>

              {/* Avatar */}
              <div className="px-3 pb-3 flex-shrink-0">
                <button onClick={() => { setIsAvatarModalOpen(true); setMobileLecturerOpen(false); }}
                  className="group w-full flex items-center gap-3 p-2.5 rounded-[12px] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition cursor-pointer text-left">
                  <div className="relative flex-shrink-0">
                    <UserAvatar userId={user.id} role="lecturer" size={34} initials={user.name} refreshTrigger={avatarRefreshTrigger} className="rounded-full ring-[1.5px] ring-black/10 dark:ring-white/15 shadow-sm" />
                    <div className="absolute inset-0 bg-black/45 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/90 leading-tight truncate">{user.name}</p>
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/38 truncate mt-0.5">{user.email}</p>
                  </div>
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 px-2 overflow-y-auto min-h-0 space-y-0.5 pb-2">
                {([
                  { id: "gradebook",     label: "Gradebook",      icon: <ClipboardList className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "analytics",     label: "Analytics",      icon: <TrendingUp className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "calendar",      label: "Calendar",       icon: <Calendar className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "live-lecture",  label: "Live Lecture",   icon: <Radio className={`h-4 w-4 ${broadcastingSession ? "text-red-500 animate-pulse" : ""}`} strokeWidth={1.6} /> },
                  { id: "notes",         label: "Publish Notes",  icon: <PlusCircle className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "quizzes",       label: "Deploy Quiz",    icon: <Award className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "exams",         label: "Written Exams",  icon: <FileText className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "assignments",   label: "Assignments",    icon: <Pencil className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "courses",       label: "Courses",        icon: <BookOpen className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "announcements", label: "Announcements",  icon: <Megaphone className="h-4 w-4" strokeWidth={1.6} /> },
                  { id: "departments",   label: "Departments",    icon: <Users className="h-4 w-4" strokeWidth={1.6} /> },
                ] as const).map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button key={item.id}
                      onClick={() => { setActiveTab(item.id as any); setMobileLecturerOpen(false); if (item.id === "gradebook") fetchGradebook(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition ${
                        isActive
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "text-[#3a3a3c] dark:text-white/55 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {/* Departments I Teach */}
                {departments.length > 0 && (
                  <div className="pt-3 pb-1">
                    <p className="px-3 text-[9.5px] font-bold text-[#6e6e73] dark:text-white/30 uppercase tracking-widest mb-1.5">Departments I Teach</p>
                    <div className="space-y-0.5">
                      {departments.map((d: any) => (
                        <button key={d.id} onClick={() => handleToggleLecturerDept(d.name)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition text-left">
                          <span className={`h-3.5 w-3.5 rounded flex-shrink-0 border-[1.5px] flex items-center justify-center transition ${
                            lecturerDepts.includes(d.name) ? "bg-emerald-500 border-emerald-500" : "border-[#8e8e93] dark:border-white/30 bg-transparent"
                          }`}>
                            {lecturerDepts.includes(d.name) && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                          </span>
                          <span className="text-[#3a3a3c] dark:text-white/65 truncate leading-tight">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom: theme + logout */}
              <div className="flex-shrink-0 px-2 pb-8 pt-3 space-y-0.5 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button onClick={onToggleTheme}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-[#3a3a3c] dark:text-white/55 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition">
                  {theme === "dark" ? <Sun className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} /> : <Moon className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} />}
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <button onClick={onLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-500/[0.08] transition">
                  <LogOut className="h-4 w-4 flex-shrink-0" strokeWidth={1.6} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        token={token}
        role="lecturer"
        userId={user.id}
        userName={user.name}
        onAvatarUpdated={() => setAvatarRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
