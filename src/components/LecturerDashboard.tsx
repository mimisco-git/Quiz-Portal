import React, { useState, useEffect, useRef } from "react";
import { GraduationCap, BookOpen, PlusCircle, Trash2, Award, ClipboardList, Check, Save, Radio, Users, Send, MessageSquare, AlertTriangle, Download, Sun, Moon, Camera } from "lucide-react";
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
  // Navigation State
  const [activeTab, setActiveTab] = useState<"gradebook" | "notes" | "quizzes" | "courses" | "departments" | "live-lecture">("gradebook");

  // Global Lists
  const [courses, setCourses] = useState<Course[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // User Profile Avatar State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Course State
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");

  // New Lecture Note State
  const [noteCourseId, setNoteCourseId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // New Quiz State
  const [quizCourseId, setQuizCourseId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDuration, setQuizDuration] = useState("10");
  const [quizQuestions, setQuizQuestions] = useState<
    Array<{ text: string; options: string[]; correctOption: string }>
  >([
    {
      text: "",
      options: ["", "", "", ""],
      correctOption: "",
    },
  ]);

  // Departments State
  const [newDeptName, setNewDeptName] = useState("");

  // Live Lectures State
  const [liveCourseId, setLiveCourseId] = useState("");
  const [liveTopic, setLiveTopic] = useState("");
  const [liveContent, setLiveContent] = useState("");
  const [broadcastingSession, setBroadcastingSession] = useState<any | null>(null);
  const [liveChats, setLiveChats] = useState<any[]>([]);
  const [lecturerChatMessage, setLecturerChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Manual Grading State
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState("");

  // Gradebook Filter States
  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterQuizId, setFilterQuizId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCourses();
    fetchGradebook();
    fetchDepartments();
  }, []);

  // Poll chats & slides if live-lecture is active
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
              // Ended from somewhere else
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

  // Scroll live chat
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
          // Check if any active lecture exists for the first course
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
      try {
        const res = await fetch(`/api/lectures/active/${c.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.lecturerId === user.id) {
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

  // Create Course Action
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseTitle) return;

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  // Publish Note Action
  const handlePublishNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteCourseId || !noteTitle || !noteContent) {
      showError("Please fill out all fields.");
      return;
    }

    try {
      const res = await fetch("/api/lecturer/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: noteCourseId,
          title: noteTitle,
          content: noteContent,
        }),
      });

      if (res.ok) {
        showSuccess(`Study Note "${noteTitle}" published successfully!`);
        setNoteTitle("");
        setNoteContent("");
        fetchCourses(); // refresh note counts
      } else {
        const d = await res.json();
        showError(d.error || "Failed to publish study note");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Deploy Quiz / Question Upload Action
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
    setQuizQuestions((prev) => [
      ...prev,
      { text: "", options: ["", "", "", ""], correctOption: "" },
    ]);
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

    // Validate questions
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.text.trim()) {
        showError(`Question ${i + 1} has no text question.`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        showError(`Question ${i + 1} is missing option values.`);
        return;
      }
      if (!q.correctOption.trim()) {
        showError(`Question ${i + 1} must have a designated correct answer.`);
        return;
      }
    }

    try {
      const res = await fetch("/api/lecturer/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: quizCourseId,
          title: quizTitle,
          durationMinutes: parseInt(quizDuration),
          questions: quizQuestions,
        }),
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

  // Manual Score Adjustment / Grading Action
  const handleSaveScoreAdjustment = async (attemptId: string) => {
    if (!editingScore) return;
    try {
      const res = await fetch(`/api/attempts/${attemptId}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  // Download Gradebook Excel / CSV action
  const handleDownloadExcel = () => {
    if (attempts.length === 0) {
      showError("No attempt records available to export.");
      return;
    }

    // Apply any active filters
    const filteredAttempts = attempts.filter((att) => {
      // Course filter
      if (filterCourseId && att.quiz?.courseId !== filterCourseId) return false;
      // Quiz filter
      if (filterQuizId && att.quizId !== filterQuizId) return false;
      // Search filter
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

    // Headers compatible with requested fields
    const headers = [
      "Student Name",
      "Registration Number",
      "Department",
      "Study Year",
      "Course Code",
      "Course Title",
      "Exam/Quiz Title",
      "Status",
      "Score (%)",
      "Date Started",
      "Date Submitted"
    ];

    const rows = filteredAttempts.map((att) => {
      return [
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
        att.submittedAt ? new Date(att.submittedAt).toLocaleString() : ""
      ];
    });

    // Generate CSV content with escaping
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            const str = String(val).replace(/"/g, '""');
            return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
          })
          .join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    // Create a descriptive file name
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

  // Department management Action
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  // Live Lectures Broadcasting Actions
  const handleLaunchLiveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveCourseId || !liveTopic.trim() || !liveContent.trim()) {
      showError("Fill out all required live lecture fields");
      return;
    }

    try {
      const res = await fetch("/api/lectures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: liveCourseId,
          topic: liveTopic,
          content: liveContent,
        }),
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
    if (!broadcastingSession || !liveTopic.trim() || !liveContent.trim()) return;
    try {
      const res = await fetch("/api/lectures/active", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: liveTopic,
          content: liveContent,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBroadcastingSession(updated);
        showSuccess("Live slides updated for all connected student panels!");
      } else {
        showError("Failed to update broadcast materials");
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleEndLiveLecture = async () => {
    if (!broadcastingSession) return;
    try {
      const res = await fetch("/api/lectures/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId: broadcastingSession.courseId }),
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
      console.error("Lecturer chat failed:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const filteredAttempts = attempts.filter((att) => {
    // Course filter
    if (filterCourseId && att.quiz?.courseId !== filterCourseId) return false;
    // Quiz/Exam filter
    if (filterQuizId && att.quizId !== filterQuizId) return false;
    // Search query
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FUTOLogo className="h-9 w-9" />
          <span className="text-md font-bold text-slate-950 font-display tracking-tight uppercase">
            FUTO • Lecturers Workspace
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAvatarModalOpen(true)}
            className="group relative flex items-center justify-center cursor-pointer focus:outline-none"
            title="Click to update your FUTO academic identity photo / avatar"
          >
            <UserAvatar
              userId={user.id}
              role="lecturer"
              size={36}
              initials={user.name}
              refreshTrigger={avatarRefreshTrigger}
              className="border border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-100 transition-colors"
            />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="h-3 w-3 text-white" />
            </div>
          </button>

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 leading-none">{user.name}</p>
            <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-1">{user.email}</p>
          </div>
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-lecturer-btn"
            onClick={onToggleTheme}
            className="flex items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-none transition cursor-pointer border border-slate-200 dark:border-slate-800"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center p-2 text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-none transition cursor-pointer border border-slate-200 text-xs font-bold uppercase tracking-wider gap-1"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Left Side Navigation Drawer */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 border border-slate-200 rounded-none shadow-xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Academic Management</h3>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab("gradebook");
                  fetchGradebook();
                }}
                className={`w-full flex items-center gap-2.5 p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "gradebook"
                    ? "bg-slate-50 text-slate-950 border-slate-900 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Registry Gradebook
              </button>

              <button
                onClick={() => setActiveTab("live-lecture")}
                className={`w-full flex items-center justify-between p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "live-lecture"
                    ? "bg-slate-550 text-slate-950 border-slate-900 bg-slate-50 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                  Live Virtual Lecture
                </div>
                {broadcastingSession && (
                  <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-ping"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("notes")}
                className={`w-full flex items-center gap-2.5 p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "notes"
                    ? "bg-slate-50 text-slate-950 border-slate-900 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                Publish Study Notes
              </button>

              <button
                onClick={() => setActiveTab("quizzes")}
                className={`w-full flex items-center gap-2.5 p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "quizzes"
                    ? "bg-slate-50 text-slate-950 border-slate-900 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <Award className="h-4 w-4" />
                Deploy Term Exam
              </button>

              <button
                onClick={() => setActiveTab("courses")}
                className={`w-full flex items-center gap-2.5 p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "courses"
                    ? "bg-slate-50 text-slate-950 border-slate-900 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Course Modules
              </button>

              <button
                onClick={() => {
                  setActiveTab("departments");
                  fetchDepartments();
                }}
                className={`w-full flex items-center gap-2.5 p-3 rounded-none text-left text-xs uppercase tracking-wider font-bold transition cursor-pointer border ${
                  activeTab === "departments"
                    ? "bg-slate-50 text-slate-950 border-slate-900 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent"
                }`}
              >
                <Users className="h-4 w-4" />
                Departments List
              </button>
            </nav>
          </div>
        </aside>

        {/* Right Side Main Console */}
        <section className="lg:col-span-9 space-y-6">
          
          {/* Action Toasts */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-none p-4 flex items-center gap-2 text-xs">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-750 rounded-none p-4 flex items-center gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* 1. REGISTRY GRADEBOOK */}
          {activeTab === "gradebook" && (
            <div id="gradebook-panel" className="bg-white border border-slate-200 rounded-none shadow-xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Student Assessment Gradebook</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Evaluate, mark, score, and adjust examination attempt logs manually here.</p>
                </div>
              </div>

              {/* Filter and Download controls */}
              <div className="bg-slate-50 p-4 border border-slate-200 flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:max-w-3xl">
                  
                  {/* Search Student Input */}
                  <div className="text-left">
                    <label htmlFor="search-student" className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Search Student</label>
                    <input
                      id="search-student"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name, Reg No, Dept, Year..."
                      className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-none text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  {/* Course Filter Dropdown */}
                  <div className="text-left">
                    <label htmlFor="filter-course" className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Filter Course</label>
                    <select
                      id="filter-course"
                      value={filterCourseId}
                      onChange={(e) => {
                        setFilterCourseId(e.target.value);
                        setFilterQuizId(""); // Reset quiz filter when course changes
                      }}
                      className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-none text-xs text-slate-750 outline-none focus:border-slate-900"
                    >
                      <option value="">All Courses</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exam/Quiz Filter Dropdown */}
                  <div className="text-left">
                    <label htmlFor="filter-quiz" className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Filter Exam/Quiz</label>
                    <select
                      id="filter-quiz"
                      value={filterQuizId}
                      onChange={(e) => setFilterQuizId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-none text-xs text-slate-750 outline-none focus:border-slate-900"
                    >
                      <option value="">All Exams / Quizzes</option>
                      {attempts
                        .reduce((acc: any[], att) => {
                          if (att.quiz && !acc.some(q => q.id === att.quizId)) {
                            if (!filterCourseId || att.quiz.courseId === filterCourseId) {
                              acc.push(att.quiz);
                            }
                          }
                          return acc;
                        }, [])
                        .map((q) => (
                          <option key={q.id} value={q.id}>{q.title}</option>
                        ))
                      }
                    </select>
                  </div>

                </div>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-xs rounded-none border border-emerald-700 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Download className="h-4 w-4" />
                  Download Student List (Excel/CSV)
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-none">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Registration No.</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Study Year</th>
                      <th className="px-4 py-3">Exam Target</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Score Grade</th>
                      <th className="px-4 py-3 text-center">Action Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {loading ? (
                      [1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-24"></div></td>
                          <td className="px-4 py-3"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-20"></div></td>
                          <td className="px-4 py-3"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-24"></div></td>
                          <td className="px-4 py-3"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-12"></div></td>
                          <td className="px-4 py-3">
                            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 w-32 mb-1"></div>
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-900 w-16"></div>
                          </td>
                          <td className="px-4 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 w-16 mx-auto"></div></td>
                          <td className="px-4 py-3 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 w-12 mx-auto"></div></td>
                          <td className="px-4 py-3 text-center"><div className="h-6 bg-slate-200 dark:bg-slate-800 w-16 mx-auto"></div></td>
                        </tr>
                      ))
                    ) : filteredAttempts.length > 0 ? (
                      filteredAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50/50 text-[11px]">
                          <td className="px-4 py-3 font-semibold text-slate-900">{att.student?.fullName}</td>
                          <td className="px-4 py-3 font-mono uppercase text-slate-500 font-bold">{att.student?.regNumber}</td>
                          <td className="px-4 py-3 text-slate-600">{att.student?.department}</td>
                          <td className="px-4 py-3 font-mono text-slate-500 font-bold">{att.student?.year}</td>
                          <td className="px-4 py-3 text-slate-800">
                            <span className="font-bold block leading-none">{att.quiz?.title}</span>
                            <span className="text-[9px] font-mono opacity-60 uppercase font-bold mt-1 block">{att.quiz?.course?.code}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att.isCompleted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[9px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                SUBMITTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                IN PROGRESS
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-mono font-bold text-slate-900">
                            {att.score !== null ? `${att.score?.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {editingAttemptId === att.id ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={editingScore}
                                  onChange={(e) => setEditingScore(e.target.value)}
                                  className="w-12 px-1 py-0.5 border border-slate-300 rounded-none text-center font-mono text-[10px]"
                                  required
                                />
                                <button
                                  onClick={() => handleSaveScoreAdjustment(att.id)}
                                  className="bg-slate-900 text-white p-1 hover:bg-slate-800"
                                  title="Save Evaluation"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setEditingAttemptId(null)}
                                  className="bg-slate-100 text-slate-600 p-1 hover:bg-slate-200"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingAttemptId(att.id);
                                  setEditingScore(att.score?.toString() || "0");
                                }}
                                className="text-[10px] font-bold text-slate-900 border border-slate-200 px-2 py-1 bg-slate-50 hover:bg-slate-100 transition rounded-none uppercase tracking-wide cursor-pointer"
                              >
                                Mark/Regrade
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 font-mono">
                          No student attempts or active sessions match your active filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. LIVE VIRTUAL LECTURE BROADCAST */}
          {activeTab === "live-lecture" && (
            <div id="live-lecture-panel" className="bg-white border border-slate-200 rounded-none shadow-xs p-6 space-y-6">
              <div>
                <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                  Live Broadcasting Station
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Post real-time lecture slides/notebooks and coordinate live chats with student audiences.</p>
              </div>

              {!broadcastingSession ? (
                <form onSubmit={handleLaunchLiveLecture} className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                    <strong>Virtual Lecturing Station Instructions:</strong> Creating a live session establishes an active channel. Any student connected to their dashboard can enter your classroom, see live slides, and participate in discussion threads.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="live-course" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Course Module</label>
                      <select
                        id="live-course"
                        value={liveCourseId}
                        onChange={(e) => setLiveCourseId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="live-topic" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Broadcasting Topic</label>
                      <input
                        id="live-topic"
                        type="text"
                        required
                        value={liveTopic}
                        onChange={(e) => setLiveTopic(e.target.value)}
                        placeholder="e.g. Lecture 4: Relational Algebra Operations"
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="live-content" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Slides & Board Content (Supports Markdown syntax)</label>
                    <textarea
                      id="live-content"
                      required
                      rows={6}
                      value={liveContent}
                      onChange={(e) => setLiveContent(e.target.value)}
                      placeholder="# Markdown Headings&#10;Write detailed lecture concepts here. Code notebooks or definitions also supported."
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs border border-red-700 cursor-pointer transition flex items-center justify-center gap-2"
                  >
                    <Radio className="h-4 w-4 text-white" />
                    Launch Interactive Broadcast
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Active Broadcaster Control Hub */}
                  <div className="p-4 bg-red-50 border border-red-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 bg-red-600 rounded-full animate-ping"></span>
                        <span className="text-[10px] font-mono font-bold text-red-700 uppercase tracking-wider">Broadcasting Live Stream Channel</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase mt-1">
                        Topic: {broadcastingSession.topic}
                      </h4>
                    </div>
                    <button
                      onClick={handleEndLiveLecture}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-850 border border-slate-950 rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Disconnect Broadcast Stream
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Live slides update form */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="bg-slate-50 p-4 border border-slate-200 space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update Live Blackboard Material</h4>
                        
                        <div>
                          <label htmlFor="live-topic-active" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lecture Topic</label>
                          <input
                            id="live-topic-active"
                            type="text"
                            required
                            value={liveTopic}
                            onChange={(e) => setLiveTopic(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-250 bg-white rounded-none text-xs text-slate-800 font-bold"
                          />
                        </div>

                        <div>
                          <label htmlFor="live-content-active" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Board Markdown Content</label>
                          <textarea
                            id="live-content-active"
                            required
                            rows={8}
                            value={liveContent}
                            onChange={(e) => setLiveContent(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-250 bg-white rounded-none text-xs font-mono"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleUpdateLiveLecture}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest border border-slate-950 cursor-pointer"
                        >
                          Sync Board to Students Panels
                        </button>
                      </div>
                    </div>

                    {/* Chat group thread list */}
                    <div className="lg:col-span-5 border border-slate-200 bg-slate-50 flex flex-col h-[400px]">
                      <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Students Class Chat</span>
                        <span className="text-[9px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-none font-bold">
                          {liveChats.length} Messages
                        </span>
                      </div>

                      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                        {liveChats.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-450 font-mono text-[10px]">
                            Waiting for students to respond to slides...
                          </div>
                        ) : (
                          liveChats.map((chat) => {
                            const isMe = chat.senderRole === "lecturer" || chat.senderId === user.id || !chat.studentId;
                            const isStaff = chat.senderRole === "lecturer" || !chat.studentId;
                            const displayName = chat.senderName || chat.studentName || chat.lecturerName || (isMe ? "Staff Admin" : "Anonymous");
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
                                    <span className={isMe ? "text-amber-800" : ""}>{displayName}</span>
                                    <span>• {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className={`p-2 rounded-none leading-relaxed break-words ${
                                    isMe ? "bg-amber-100 border border-amber-200 text-slate-800 font-medium" : "bg-white border border-slate-200 text-slate-800"
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

                      <form onSubmit={handleSendLecturerChat} className="p-2 border-t border-slate-200 bg-white flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={lecturerChatMessage}
                          onChange={(e) => setLecturerChatMessage(e.target.value)}
                          placeholder="Reply to class..."
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-none focus:outline-none text-slate-900"
                        />
                        <button
                          type="submit"
                          disabled={isSendingChat}
                          className="px-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer flex items-center justify-center"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. PUBLISH STUDY NOTES */}
          {activeTab === "notes" && (
            <div id="notes-panel" className="bg-white border border-slate-200 rounded-none shadow-xs p-6 space-y-6">
              <div>
                <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Publish Course Study Notes</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Upload comprehensive module details and notes for students to read.</p>
              </div>

              <form onSubmit={handlePublishNote} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Target Course Module</label>
                    <select
                      value={noteCourseId}
                      onChange={(e) => setNoteCourseId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs text-slate-750 outline-none"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lecture Note Title</label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g. Chapter 3: Normalization and Functional Dependencies"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Markdown Body Content</label>
                  <textarea
                    required
                    rows={12}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Provide full academic notes with markdown support..."
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none font-mono text-xs text-slate-700 outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-none text-xs font-bold uppercase tracking-widest border border-slate-950 transition cursor-pointer"
                >
                  Publish Note to Course Syllabus
                </button>
              </form>
            </div>
          )}

          {/* 4. DEPLOY SECURE EXAM QUIZ */}
          {activeTab === "quizzes" && (
            <div id="quizzes-panel" className="bg-white border border-slate-200 rounded-none shadow-xs p-6 space-y-6">
              <div>
                <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Deploy Secure Quiz & Examination</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Configure timed question sets to deliver instant testing and score logging.</p>
              </div>

              <form onSubmit={handleDeployQuizSubmit} className="space-y-6">
                
                {/* Meta Details Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 border border-slate-250 rounded-none">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Course Module</label>
                    <select
                      value={quizCourseId}
                      onChange={(e) => setQuizCourseId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs text-slate-750"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Quiz Title</label>
                    <input
                      type="text"
                      required
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="e.g. Mid-Term Examination 2026"
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs text-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">SLA Timer Duration (Minutes)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={quizDuration}
                      onChange={(e) => setQuizDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none text-xs text-slate-700 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Upload Question Builder */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">Questions Upload Manager</h3>
                  
                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 border border-slate-200 rounded-none bg-white space-y-3 relative">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-400">QUESTION {qIdx + 1}</span>
                        {quizQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionRow(qIdx)}
                            className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 transition"
                            title="Remove Question"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Question Text</label>
                        <input
                          type="text"
                          required
                          value={q.text}
                          onChange={(e) => handleQuizQuestionChange(qIdx, "text", e.target.value)}
                          placeholder="e.g. What does SQL stand for?"
                          className="w-full px-3 py-2 border border-slate-200 rounded-none text-xs text-slate-700 outline-none focus:border-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx}>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">Option {["A", "B", "C", "D"][optIdx]}</label>
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={(e) => handleQuizQuestionChange(qIdx, "option", e.target.value, optIdx)}
                              placeholder={`Option ${["A", "B", "C", "D"][optIdx]}`}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-none text-xs text-slate-700 outline-none focus:border-slate-900"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <label className="block text-[9px] font-bold uppercase text-slate-550 mb-1">Correct designated option</label>
                        <select
                          required
                          value={q.correctOption}
                          onChange={(e) => handleQuizQuestionChange(qIdx, "correctOption", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-none text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="">-- Choose correct option --</option>
                          {q.options.map((opt, oIdx) => {
                            const optLabel = ["A", "B", "C", "D"][oIdx];
                            return (
                              <option key={oIdx} value={opt}>
                                {optLabel}: {opt || `(Option ${optLabel} empty)`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddQuestionRow}
                    className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-900 text-slate-600 hover:text-slate-900 text-xs font-bold uppercase tracking-wider rounded-none transition"
                  >
                    + Append Question Form Row
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-none text-xs font-bold uppercase tracking-widest border border-slate-950 transition cursor-pointer"
                >
                  Publish and Deploy Secure Quiz
                </button>
              </form>
            </div>
          )}

          {/* 5. COURSE REGISTRY */}
          {activeTab === "courses" && (
            <div id="courses-panel" className="bg-white border border-slate-200 rounded-none shadow-xs p-6 space-y-6">
              <div>
                <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Course Registry</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Register new academic course modules to organize syllabus contents.</p>
              </div>

              <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 border border-slate-250 rounded-none">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CSC301"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none focus:ring-1 focus:ring-slate-900 text-xs text-slate-700 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. Database Systems"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none focus:ring-1 focus:ring-slate-900 text-xs text-slate-700 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-none text-xs font-bold uppercase tracking-widest border border-slate-950 cursor-pointer transition"
                >
                  Register Course
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Modules</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse" id="courses-skeleton">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 border border-slate-200 dark:border-slate-800 rounded-none flex items-center justify-between bg-white dark:bg-slate-900 shadow-xs">
                        <div className="space-y-2 w-2/3">
                          <div className="h-3 bg-slate-200 dark:bg-slate-800 w-16"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-800 w-full"></div>
                        </div>
                        <div className="h-5 bg-slate-200 dark:bg-slate-800 w-12"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {courses.map((c) => (
                      <div key={c.id} className="p-4 border border-slate-200 rounded-none flex items-center justify-between bg-white shadow-xs">
                        <div>
                          <span className="block font-mono text-[10px] font-bold uppercase text-slate-400 tracking-wider">{c.code}</span>
                          <span className="block text-xs font-bold text-slate-800 leading-tight mt-0.5">{c.title}</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold bg-slate-150 text-slate-750 px-2 py-0.5 border border-slate-200 rounded-none">
                          {c._count?.notes || 0} NOTES
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. DEPARTMENTS LIST & MANAGEMENT */}
          {activeTab === "departments" && (
            <div id="departments-panel" className="bg-white border border-slate-200 p-6 rounded-none shadow-xs space-y-6">
              <div>
                <h2 className="text-md font-bold text-slate-900 uppercase tracking-tight font-display">Academic Departments</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Establish, maintain, and examine school departments inside FUTO.</p>
              </div>

              <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 border border-slate-250 rounded-none">
                <div className="md:col-span-2">
                  <label htmlFor="dept-name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">New Department Name</label>
                  <input
                    id="dept-name"
                    type="text"
                    required
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Information Technology"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-none focus:ring-1 focus:ring-slate-900 text-xs text-slate-750 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-none text-xs font-bold uppercase tracking-widest border border-slate-950 cursor-pointer transition"
                >
                  Create Department
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Departments</h3>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse" id="departments-skeleton">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 border border-slate-200 dark:border-slate-800 rounded-none flex items-center justify-between bg-white dark:bg-slate-900 shadow-xs">
                        <div className="space-y-2 w-2/3">
                          <div className="h-4 bg-slate-200 dark:bg-slate-800 w-3/4"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-800 w-24"></div>
                        </div>
                        <div className="h-5 bg-slate-200 dark:bg-slate-800 w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {departments.length > 0 ? (
                      departments.map((dept) => (
                        <div key={dept.id} className="p-4 border border-slate-200 rounded-none flex items-center justify-between bg-white shadow-xs">
                          <div>
                            <span className="block text-xs font-bold text-slate-800 leading-tight">{dept.name}</span>
                            <span className="block font-mono text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">ID: {dept.id.substring(0, 8)}</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-200 rounded-none">
                            FUTO SCHOOL
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-8 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-250">
                        No departments established yet.
                      </div>
                    )}
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
