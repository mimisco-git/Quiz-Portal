import React, { useState, useEffect, useRef } from "react";
import { GraduationCap, BookOpen, PlusCircle, Trash2, Award, ClipboardList, Check, Save, Radio, Users, Send, MessageSquare, AlertTriangle, Download, Sun, Moon, Camera, LogOut } from "lucide-react";
import { Course, LectureNote, Quiz, StudentAttempt, Question } from "../types";
import UserAvatar from "./UserAvatar";
import AvatarModal from "./AvatarModal";
import { motion } from "motion/react";
import FUTOLogo from "./FUTOLogo";

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
  const [activeTab, setActiveTab] = useState<"gradebook" | "notes" | "quizzes" | "courses" | "departments" | "live-lecture">("gradebook");

  const [courses, setCourses] = useState<Course[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");

  const [noteCourseId, setNoteCourseId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const [quizCourseId, setQuizCourseId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDuration, setQuizDuration] = useState("10");
  const [quizQuestions, setQuizQuestions] = useState<
    Array<{ text: string; options: string[]; correctOption: string }>
  >([{ text: "", options: ["", "", "", ""], correctOption: "" }]);

  const [newDeptName, setNewDeptName] = useState("");

  const [liveCourseId, setLiveCourseId] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveContent, setLiveContent] = useState("");
  const [broadcastingSession, setBroadcastingSession] = useState<any | null>(null);
  const [liveChats, setLiveChats] = useState<any[]>([]);
  const [lecturerChatMessage, setLecturerChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState("");

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterQuizId, setFilterQuizId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCourses();
    fetchGradebook();
    fetchDepartments();
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
          checkActiveLectureOnLoad(data);
        }
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
    }
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

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseTitle) return;
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: courseCode, title: courseTitle }),
      });
      if (res.ok) {
        showSuccess(`Course module ${courseCode} successfully registered.`);
        setCourseCode("");
        setCourseTitle("");
        fetchCourses();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to create course");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

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
      updated[index].options[optIndex] = value;
    }
    setQuizQuestions(updated);
  };

  const handleAddQuestionRow = () => {
    setQuizQuestions((prev) => [...prev, { text: "", options: ["", "", "", ""], correctOption: "" }]);
  };

  const handleRemoveQuestionRow = (index: number) => {
    if (quizQuestions.length === 1) return;
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
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
        body: JSON.stringify({ courseId: quizCourseId, title: quizTitle, durationMinutes: parseInt(quizDuration), questions: quizQuestions }),
      });
      if (res.ok) {
        showSuccess(`Exam Quiz "${quizTitle}" deployed successfully!`);
        setQuizTitle("");
        setQuizDuration("10");
        setQuizQuestions([{ text: "", options: ["", "", "", ""], correctOption: "" }]);
        fetchGradebook();
      } else {
        const d = await res.json();
        showError(d.error || "Failed to deploy quiz");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleSaveScoreAdjustment = async (attemptId: string) => {
    if (!editingScore) return;
    try {
      const res = await fetch(`/api/attempts/${attemptId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: parseFloat(editingScore) }),
      });
      if (res.ok) {
        showSuccess("Manual evaluation scorecard recorded successfully.");
        setEditingAttemptId(null);
        fetchGradebook();
      } else {
        const d = await res.json();
        showError(d.error || "Evaluation grading failed");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleDownloadExcel = () => {
    if (attempts.length === 0) {
      showError("No attempt records available to export.");
      return;
    }
    const filteredAttempts = attempts.filter((att) => {
      if (filterCourseId && att.quiz?.courseId !== filterCourseId) return false;
      if (filterQuizId && att.quizId !== filterQuizId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = att.student?.fullName?.toLowerCase().includes(query);
        const regMatch = att.student?.regNumber?.toLowerCase().includes(query);
        const deptMatch = att.student?.department?.toLowerCase().includes(query);
        if (!nameMatch && !regMatch && !deptMatch) return false;
      }
      return true;
    });

    if (filteredAttempts.length === 0) {
      showError("No records matching the current filters to export.");
      return;
    }

    const headers = ["Student Name","Registration Number","Department","Study Year","Course Code","Course Title","Exam/Quiz Title","Status","Score (%)","Date Started","Date Submitted"];
    const rows = filteredAttempts.map((att) => [
      att.student?.fullName || "",
      att.student?.regNumber || "",
      att.student?.department || "",
      att.student?.year || "",
      att.quiz?.course?.code || "",
      att.quiz?.course?.title || "",
      att.quiz?.title || "",
      att.isCompleted ? "SUBMITTED" : "IN PROGRESS",
      att.score !== null && att.score !== undefined ? att.score.toFixed(1) : "N/A",
      att.startedAt ? new Date(att.startedAt).toLocaleString() : "",
      att.submittedAt ? new Date(att.submittedAt).toLocaleString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => { const str = String(val).replace(/"/g, '""'); return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str; }).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    let fileName = "FUTO_Student_Exam_Attempts";
    if (filterCourseId) {
      const selectedC = courses.find((c) => c.id === filterCourseId);
      if (selectedC) fileName += `_${selectedC.code}`;
    }
    fileName += `_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess("Exam student list downloaded successfully in Excel/CSV format!");
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

  const filteredAttempts = attempts.filter((att) => {
    if (filterCourseId && att.quiz?.courseId !== filterCourseId) return false;
    if (filterQuizId && att.quizId !== filterQuizId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = att.student?.fullName?.toLowerCase().includes(q);
      const regMatch = att.student?.regNumber?.toLowerCase().includes(q);
      const deptMatch = att.student?.department?.toLowerCase().includes(q);
      const yearMatch = att.student?.year?.toLowerCase().includes(q);
      if (!nameMatch && !regMatch && !deptMatch && !yearMatch) return false;
    }
    return true;
  });

  /* ─── nav item helpers ─── */
  const navBtn = (id: string, label: string, icon: React.ReactNode, live?: boolean) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => {
          setActiveTab(id as any);
          if (id === "gradebook") fetchGradebook();
          if (id === "departments") fetchDepartments();
        }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-[12px] font-medium transition-all duration-150 cursor-pointer ${
          isActive
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`flex-shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>{icon}</span>
          {label}
        </div>
        {live && broadcastingSession && (
          <span className="h-2 w-2 bg-red-500 rounded-full animate-ping flex-shrink-0" />
        )}
      </button>
    );
  };

  /* ─── label helper ─── */
  const lbl = "block text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#010e07]/90 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} alt="QuizOS" className="h-9 w-auto select-none rounded-md" />
            <div className="hidden sm:block">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white font-display tracking-tight">QuizOS</span>
              <span className="text-[12px] text-slate-400 dark:text-slate-500 font-mono ml-1.5">Lecturer</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:block text-right mr-1">
              <p className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">{user.name}</p>
              <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{user.email}</p>
            </div>

            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="group relative flex-shrink-0 cursor-pointer"
              title="Update profile photo"
            >
              <UserAvatar
                userId={user.id}
                role="lecturer"
                size={34}
                initials={user.name}
                refreshTrigger={avatarRefreshTrigger}
                className="ring-2 ring-white dark:ring-slate-800 group-hover:ring-emerald-200 dark:group-hover:ring-emerald-800 transition-all rounded-full"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </button>

            <button
              id="theme-toggle-lecturer-btn"
              onClick={onToggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              {theme === "light" ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
            </button>

            <button
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

        {/* Sidebar nav */}
        <aside className="lg:col-span-3">
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">Workspace</p>
            <nav className="space-y-1">
              {navBtn("gradebook",    "Registry Gradebook",    <ClipboardList className="h-4 w-4" />)}
              {navBtn("live-lecture", "Live Virtual Lecture",  <Radio className={`h-4 w-4 ${broadcastingSession ? "text-red-500 animate-pulse" : "text-slate-400"}`} />, true)}
              {navBtn("notes",        "Publish Study Notes",   <PlusCircle className="h-4 w-4" />)}
              {navBtn("quizzes",      "Deploy Term Exam",      <Award className="h-4 w-4" />)}
              {navBtn("courses",      "Course Modules",        <BookOpen className="h-4 w-4" />)}
              {navBtn("departments",  "Departments",           <Users className="h-4 w-4" />)}
            </nav>
          </div>
        </aside>

        {/* Content area */}
        <section className="lg:col-span-9 space-y-4">

          {/* Toast notifications */}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl p-3.5 flex items-center gap-2.5 text-[12.5px] shadow-sm"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex items-center gap-2.5 text-[12.5px] shadow-sm"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="font-semibold">{errorMsg}</span>
            </motion.div>
          )}

          {/* ── 1. GRADEBOOK ── */}
          {activeTab === "gradebook" && (
            <div id="gradebook-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Student Assessment Gradebook</h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Evaluate, mark, and adjust examination attempt logs.</p>
              </div>

              {/* Filters */}
              <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
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
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
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
                      <option value="">All Exams</option>
                      {attempts.reduce((acc: any[], att) => {
                        if (att.quiz && !acc.some(q => q.id === att.quizId)) {
                          if (!filterCourseId || att.quiz.courseId === filterCourseId) acc.push(att.quiz);
                        }
                        return acc;
                      }, []).map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[12px] rounded-xl border border-emerald-700 transition cursor-pointer shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
                <table className="min-w-full divide-y divide-slate-200/60 dark:divide-white/[0.06] text-left">
                  <thead className="bg-slate-50/80 dark:bg-white/[0.03]">
                    <tr>
                      {["Student Name","Reg. No.","Department","Year","Exam Target","Status","Score","Action"].map((h) => (
                        <th key={h} className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/70 dark:divide-white/[0.04]">
                    {loading ? (
                      [1,2,3,4,5].map((i) => (
                        <tr key={i} className="animate-pulse">
                          {[1,2,3,4,5,6,7,8].map((j) => (
                            <td key={j} className="px-4 py-3"><div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-md w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredAttempts.length > 0 ? (
                      filteredAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-emerald-50/30 dark:hover:bg-white/[0.02] transition-colors text-[13px]">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{att.student?.fullName}</td>
                          <td className="px-4 py-3 font-mono text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase">{att.student?.regNumber}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{att.student?.department}</td>
                          <td className="px-4 py-3 font-mono text-[12px] text-slate-500 dark:text-slate-400 font-bold">{att.student?.year}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block leading-none">{att.quiz?.title}</span>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 block">{att.quiz?.course?.code}</span>
                          </td>
                          <td className="px-4 py-3">
                            {att.isCompleted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 animate-pulse">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100 text-center">
                            {att.score !== null ? `${att.score?.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {editingAttemptId === att.id ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="0" max="100" step="0.5"
                                  value={editingScore}
                                  onChange={(e) => setEditingScore(e.target.value)}
                                  className="w-14 px-1.5 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-center font-mono text-[12px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-emerald-400"
                                />
                                <button
                                  onClick={() => handleSaveScoreAdjustment(att.id)}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setEditingAttemptId(null)}
                                  className="p-1.5 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-600 dark:text-slate-400 rounded-lg transition cursor-pointer text-[12px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingAttemptId(att.id); setEditingScore(att.score?.toString() || "0"); }}
                                className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.10] px-2.5 py-1 bg-slate-50 dark:bg-white/[0.04] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-100 dark:hover:border-emerald-900/30 transition rounded-lg cursor-pointer"
                              >
                                Regrade
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-600 text-[12px]">
                          No student attempts match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 2. LIVE LECTURE ── */}
          {activeTab === "live-lecture" && (
            <div id="live-lecture-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                  Live Broadcasting Station
                </h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Post real-time lecture slides and coordinate live discussions.</p>
              </div>

              {!broadcastingSession ? (
                <form onSubmit={handleLaunchLiveLecture} className="space-y-4">
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-[12.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    <strong>Instructions:</strong> Creating a live session establishes an active broadcast channel. Students can join, view your slides, and participate in real-time discussions.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="live-course" className={lbl}>Target Course Module</label>
                      <select id="live-course" value={liveCourseId} onChange={(e) => setLiveCourseId(e.target.value)} className="form-input">
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="live-topic" className={lbl}>Lecture Topic</label>
                      <input id="live-topic" type="text" required value={liveTopic} onChange={(e) => setLiveTopic(e.target.value)} placeholder="e.g. Lecture 4: Relational Algebra" className="form-input" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="live-content" className={lbl}>Slides & Board Content (Markdown)</label>
                    <textarea id="live-content" required rows={7} value={liveContent} onChange={(e) => setLiveContent(e.target.value)} placeholder={"# Heading\nWrite lecture content here with full Markdown support…"} className="form-input" />
                  </div>

                  <button type="submit" className="btn-gradient">
                    <Radio className="h-4 w-4" />
                    Launch Broadcast
                  </button>
                </form>
              ) : (
                <div className="space-y-5">
                  {/* Live banner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="h-2 w-2 bg-red-600 rounded-full animate-ping" />
                        <span className="text-[12px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Broadcasting Live</span>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">Topic: {broadcastingSession.topic}</p>
                    </div>
                    <button
                      onClick={handleEndLiveLecture}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-red-700 dark:hover:bg-red-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer border border-slate-950 dark:border-slate-700 flex-shrink-0"
                    >
                      End Broadcast
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Update form */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
                        <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Update Board Material</p>
                        <div>
                          <label htmlFor="live-topic-active" className={lbl}>Topic</label>
                          <input id="live-topic-active" type="text" required value={liveTopic} onChange={(e) => setLiveTopic(e.target.value)} className="form-input" />
                        </div>
                        <div>
                          <label htmlFor="live-content-active" className={lbl}>Board Content (Markdown)</label>
                          <textarea id="live-content-active" required rows={8} value={liveContent} onChange={(e) => setLiveContent(e.target.value)} className="form-input" />
                        </div>
                        <button type="button" onClick={handleUpdateLiveLecture} className="btn-gradient">
                          <Save className="h-4 w-4" />
                          Sync to Students
                        </button>
                      </div>
                    </div>

                    {/* Chat panel */}
                    <div className="lg:col-span-5 border border-slate-200/60 dark:border-white/[0.06] rounded-xl overflow-hidden flex flex-col h-[420px] bg-white dark:bg-white/[0.02]">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between bg-slate-50/80 dark:bg-white/[0.03]">
                        <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">Class Chat</span>
                        <span className="text-[11px] font-mono bg-slate-100 dark:bg-white/[0.06] text-slate-500 px-1.5 py-0.5 rounded-md font-bold">{liveChats.length}</span>
                      </div>
                      <div className="flex-1 p-3 overflow-y-auto space-y-3">
                        {liveChats.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-[11px] font-medium text-center">
                            Waiting for student responses…
                          </div>
                        ) : (
                          liveChats.map((chat) => {
                            const isMe = chat.senderRole === "lecturer" || chat.senderId === user.id || !chat.studentId;
                            const isStaff = chat.senderRole === "lecturer" || !chat.studentId;
                            const displayName = chat.senderName || chat.studentName || chat.lecturerName || (isMe ? "You" : "Student");
                            const senderId = chat.senderId || chat.studentId || chat.lecturerId || "";
                            return (
                              <div key={chat.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                                <UserAvatar userId={senderId} role={isStaff ? "lecturer" : "student"} size={26} initials={displayName} className="shrink-0" />
                                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                  <span className={`text-[11px] font-bold font-mono uppercase tracking-wide ${isMe ? "text-amber-600 dark:text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>
                                    {displayName}
                                  </span>
                                  <div className={`px-3 py-2 rounded-2xl leading-relaxed break-words text-[12px] ${
                                    isMe
                                      ? "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 text-slate-800 dark:text-slate-200 rounded-br-md"
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
                      <form onSubmit={handleSendLecturerChat} className="p-2.5 border-t border-slate-100 dark:border-white/[0.06] flex gap-2 bg-white dark:bg-[#011a0d]">
                        <input
                          type="text"
                          required
                          value={lecturerChatMessage}
                          onChange={(e) => setLecturerChatMessage(e.target.value)}
                          placeholder="Reply to class…"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07] rounded-xl text-[12.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-300 dark:focus:border-emerald-700 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat}
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 text-white" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. PUBLISH NOTES ── */}
          {activeTab === "notes" && (
            <div id="notes-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Publish Course Study Notes</h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Upload comprehensive module details for students to study.</p>
              </div>

              <form onSubmit={handlePublishNote} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Target Course Module</label>
                    <select value={noteCourseId} onChange={(e) => setNoteCourseId(e.target.value)} className="form-input">
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Lecture Note Title</label>
                    <input type="text" required value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. Chapter 3: Normalization…" className="form-input" />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Markdown Body Content</label>
                  <textarea required rows={12} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Provide full academic notes with markdown support…" className="form-input" />
                </div>

                <button type="submit" className="btn-gradient">
                  <PlusCircle className="h-4 w-4" />
                  Publish Note
                </button>
              </form>
            </div>
          )}

          {/* ── 4. DEPLOY QUIZ ── */}
          {activeTab === "quizzes" && (
            <div id="quizzes-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Deploy Secure Quiz & Examination</h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Configure timed question sets for instant testing and score logging.</p>
              </div>

              <form onSubmit={handleDeployQuizSubmit} className="space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4">
                  <div>
                    <label className={lbl}>Course Module</label>
                    <select value={quizCourseId} onChange={(e) => setQuizCourseId(e.target.value)} className="form-input">
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.title}</option>)}
                    </select>
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

                {/* Questions */}
                <div className="space-y-3">
                  <h3 className="text-[12px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Questions</h3>

                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl bg-white dark:bg-white/[0.02] space-y-3">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                        <span className="text-[12px] font-mono font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Question {qIdx + 1}</span>
                        {quizQuestions.length > 1 && (
                          <button type="button" onClick={() => handleRemoveQuestionRow(qIdx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-600 transition rounded-lg cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
                        <select required value={q.correctOption} onChange={(e) => handleQuizQuestionChange(qIdx, "correctOption", e.target.value)} className="form-input">
                          <option value="">-- Select correct answer --</option>
                          {q.options.map((opt, oIdx) => {
                            const optLabel = ["A","B","C","D"][oIdx];
                            return <option key={oIdx} value={opt}>{optLabel}: {opt || `(Option ${optLabel} empty)`}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddQuestionRow}
                    className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-white/[0.10] hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-[12px] font-semibold rounded-xl transition cursor-pointer"
                  >
                    + Add Question
                  </button>
                </div>

                <button type="submit" className="btn-gradient">
                  <Award className="h-4 w-4" />
                  Deploy Secure Quiz
                </button>
              </form>
            </div>
          )}

          {/* ── 5. COURSE REGISTRY ── */}
          {activeTab === "courses" && (
            <div id="courses-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Course Registry</h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Register new academic course modules.</p>
              </div>

              <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4">
                <div>
                  <label className={lbl}>Course Code</label>
                  <input type="text" required value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CSC301" className="form-input uppercase font-mono" />
                </div>
                <div>
                  <label className={lbl}>Course Title</label>
                  <input type="text" required value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. Database Systems" className="form-input" />
                </div>
                <button type="submit" className="btn-gradient" style={{ marginTop: "24px" }}>
                  Register
                </button>
              </form>

              <div className="space-y-3">
                <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Registered Modules ({courses.length})</p>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse" id="courses-skeleton">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between">
                        <div className="space-y-2 w-2/3">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-16" />
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-full" />
                        </div>
                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {courses.map((c) => (
                      <div key={c.id} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between bg-white dark:bg-white/[0.02] hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-all">
                        <div>
                          <span className="block font-mono text-[12px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">{c.code}</span>
                          <span className="block text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight mt-0.5">{c.title}</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 px-2.5 py-1 border border-slate-200 dark:border-white/[0.07] rounded-full">
                          {c._count?.notes || 0} notes
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 6. DEPARTMENTS ── */}
          {activeTab === "departments" && (
            <div id="departments-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display">Academic Departments</h2>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Establish and manage school departments.</p>
              </div>

              <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4">
                <div className="md:col-span-2">
                  <label htmlFor="dept-name" className={lbl}>New Department Name</label>
                  <input id="dept-name" type="text" required value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Information Technology" className="form-input" />
                </div>
                <button type="submit" className="btn-gradient" style={{ marginTop: "24px" }}>
                  Create
                </button>
              </form>

              <div className="space-y-3">
                <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Departments ({departments.length})</p>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse" id="departments-skeleton">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between">
                        <div className="space-y-2 w-2/3">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-24" />
                        </div>
                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
                      </div>
                    ))}
                  </div>
                ) : departments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {departments.map((dept) => (
                      <div key={dept.id} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between bg-white dark:bg-white/[0.02] hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-all">
                        <div>
                          <span className="block text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">{dept.name}</span>
                          <span className="block font-mono text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">ID: {dept.id.substring(0, 8)}</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 border border-emerald-100 dark:border-emerald-900/30 rounded-full">
                          FUTO
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                    <Users className="h-7 w-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">No departments established yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </section>
      </main>

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
