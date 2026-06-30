import React, { useState, useEffect, useRef } from "react";
import { GraduationCap, BookOpen, PlusCircle, Trash2, Award, ClipboardList, Check, Save, Radio, Users, Send, MessageSquare, AlertTriangle, Download, Sun, Moon, Camera, LogOut, FileText, Upload, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Mic, Layers, BarChart2, ThumbsUp, ArrowLeft, CheckCircle } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"gradebook" | "notes" | "quizzes" | "courses" | "departments" | "live-lecture" | "exams">("gradebook");

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

  // Exam state
  const [exams, setExams] = useState<any[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [examCourseId, setExamCourseId] = useState("");
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examQText, setExamQText] = useState("");
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [examSubmissions, setExamSubmissions] = useState<any[]>([]);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // Live lecture sub-features
  const [liveSubTab, setLiveSubTab] = useState<"jitsi" | "slides" | "poll" | "attendance" | "chat">("jitsi");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Option A", "Option B", "Option C", "Option D"]);
  const [attachLiveFile, setAttachLiveFile] = useState<File | null>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [isUploadingPptx, setIsUploadingPptx] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab === "exams") fetchExams();
  }, [activeTab]);

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
          checkActiveLectureOnLoad(data);
        }
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setLoading(false);
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

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examCourseId) { showError("Title and course are required"); return; }
    if (!examFile && !examQText.trim()) { showError("Upload a .docx/.txt file or paste the questions text"); return; }
    try {
      const fd = new FormData();
      fd.append("title", examTitle);
      fd.append("courseId", examCourseId);
      if (examFile) fd.append("file", examFile);
      else fd.append("questionsText", examQText);
      const res = await fetch("/api/exams", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Exam created successfully!");
        setExamTitle(""); setExamFile(null); setExamQText("");
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
      const res = await fetch(`/api/exams/${examId}/answer-key`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (res.ok) {
        showSuccess("Answer key uploaded!");
        setAnswerKeyFile(null); setAnswerKeyText("");
        const updated = await res.json();
        setSelectedExam(updated);
        fetchExams();
      } else {
        const d = await res.json(); showError(d.error || "Failed to upload answer key");
      }
    } catch (err: any) { showError(err.message); }
  };

  const handleGradeAll = async (examId: string) => {
    setIsGrading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/grade`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        showSuccess(`Graded ${d.graded} submission${d.graded !== 1 ? "s" : ""} with AI!`);
        fetchExamSubmissions(examId);
      } else {
        showError(d.error || "Grading failed");
      }
    } catch (err: any) { showError(err.message); }
    finally { setIsGrading(false); }
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
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 shadow-[0_1px_4px_rgba(4,120,87,0.10),inset_0_1px_0_rgba(255,255,255,0.80)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.06)]"
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
  const lbl = "block text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400 mb-2";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Background depth layers */}
      <div className="fixed inset-0 pointer-events-none dark:opacity-0"
        style={{background: "radial-gradient(ellipse 70% 50% at 18% 12%, rgba(167,243,208,0.20) 0%, transparent 70%)"}} />
      <div className="fixed inset-0 pointer-events-none opacity-0 dark:opacity-100"
        style={{background: "radial-gradient(ellipse 70% 50% at 18% 12%, rgba(4,120,87,0.10) 0%, transparent 70%)"}} />
      <div className="fixed inset-0 pointer-events-none opacity-[0.018] dark:opacity-[0.032]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }} />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#010e07]/90 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} alt="QuizOS" className="h-12 w-auto select-none rounded-md" />
            <span className="hidden sm:block text-[13px] text-slate-400 dark:text-slate-500 font-mono">Lecturer</span>
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
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-4 dash-card">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">Workspace</p>
            <nav className="space-y-1">
              {navBtn("gradebook",    "Registry Gradebook",    <ClipboardList className="h-4 w-4" />)}
              {navBtn("live-lecture", "Live Virtual Lecture",  <Radio className={`h-4 w-4 ${broadcastingSession ? "text-red-500 animate-pulse" : "text-slate-400"}`} />, true)}
              {navBtn("notes",        "Publish Study Notes",   <PlusCircle className="h-4 w-4" />)}
              {navBtn("quizzes",      "Deploy MCQ Quiz",       <Award className="h-4 w-4" />)}
              {navBtn("exams",        "Written Exams (AI)",    <FileText className="h-4 w-4" />)}
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
              className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl p-3.5 flex items-center gap-2.5 text-[12.5px] shadow-[0_2px_8px_rgba(4,120,87,0.12),0_6px_20px_rgba(4,120,87,0.08)]"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 rounded-xl p-3.5 flex items-center gap-2.5 text-[12.5px] shadow-[0_2px_8px_rgba(239,68,68,0.10),0_6px_20px_rgba(239,68,68,0.06)]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="font-semibold">{errorMsg}</span>
            </motion.div>
          )}

          {/* ── 1. GRADEBOOK ── */}
          {activeTab === "gradebook" && (
            <div id="gradebook-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Student Assessment Gradebook</h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Evaluate, mark, and adjust examination attempt logs.</p>
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
                            {att.score !== null ? `${att.score?.toFixed(1)}%` : "N/A"}
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
            <div id="live-lecture-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                  Live Broadcasting Station
                </h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Audio/video, slides, polls, attendance: all in one live session.</p>
              </div>

              {!broadcastingSession ? (
                <form onSubmit={handleLaunchLiveLecture} className="space-y-4">
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-[12.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    <strong>Tip:</strong> Separate slides with <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">---</code> on its own line. Use audio/video via Jitsi. Students join automatically.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Target Course</label>
                      <select value={liveCourseId} onChange={(e) => setLiveCourseId(e.target.value)} className="form-input">
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Lecture Topic</label>
                      <input type="text" required value={liveTopic} onChange={(e) => setLiveTopic(e.target.value)} placeholder="e.g. Lecture 4: Relational Algebra" className="form-input" />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Slides / Board Content (Markdown: separate slides with ---)</label>
                    <textarea required rows={7} value={liveContent} onChange={(e) => setLiveContent(e.target.value)} placeholder={"# Slide 1\nYour first slide content here\n\n---\n\n# Slide 2\nSecond slide…"} className="form-input" />
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5"><span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" /><span className="relative h-2.5 w-2.5 rounded-full bg-red-500" /></span>
                        <div>
                          <span className="text-[11px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-widest block">Live</span>
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{broadcastingSession.topic}</p>
                        </div>
                        {handRaises.length > 0 && (
                          <span className="ml-2 flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            <ThumbsUp className="h-3 w-3" /> {handRaises.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={handleSummarize} disabled={isSummarizing}
                          className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 dark:border-white/10 rounded-lg hover:border-emerald-300 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50">
                          {isSummarizing ? "Summarizing…" : "AI Summary"}
                        </button>
                        <button onClick={handleEndLiveLecture}
                          className="px-4 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-red-700 dark:hover:bg-red-700 text-white rounded-xl text-[12px] font-semibold transition flex-shrink-0">
                          End Broadcast
                        </button>
                      </div>
                    </div>

                    {/* AI Summary panel */}
                    {sessionSummary && (
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
                        <p className={lbl + " text-emerald-700 dark:text-emerald-400"}>AI Session Summary</p>
                        <p className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{sessionSummary}</p>
                      </div>
                    )}

                    {/* Sub-tabs */}
                    <div className="flex gap-1 bg-slate-100/80 dark:bg-white/[0.04] rounded-xl p-1 border border-slate-200/60 dark:border-white/[0.05] overflow-x-auto">
                      {([
                        { id: "jitsi",      icon: Mic,           label: "Audio/Video" },
                        { id: "slides",     icon: Layers,        label: `Slides${slides.length > 1 ? ` (${safeSlide + 1}/${slides.length})` : ""}` },
                        { id: "poll",       icon: BarChart2,     label: `Poll${activePoll ? " •" : ""}` },
                        { id: "attendance", icon: Users,         label: `Attendance (${attendance.length})` },
                        { id: "chat",       icon: MessageSquare, label: `Chat (${liveChats.length})` },
                      ] as { id: "jitsi" | "slides" | "poll" | "attendance" | "chat"; icon: React.ElementType; label: string }[]).map(tab => (
                        <button key={tab.id} onClick={() => setLiveSubTab(tab.id)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all duration-150 ${liveSubTab === tab.id ? "bg-white dark:bg-white/[0.10] text-slate-800 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/[0.08]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}>
                          <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Jitsi Audio/Video */}
                    {liveSubTab === "jitsi" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/[0.06]" style={{ height: 420 }}>
                          <iframe
                            src={`https://meet.jit.si/${broadcastingSession.jitsiRoom ?? broadcastingSession.id}#userInfo.displayName=${encodeURIComponent(user.name)}&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`}
                            allow="camera; microphone; fullscreen; display-capture; autoplay"
                            className="w-full h-full border-0"
                            title="Jitsi Meet"
                          />
                        </div>
                        {/* File attachment */}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
                          <p className={lbl}>Share a File with Students</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors text-[12px] text-slate-500 dark:text-slate-400 flex-1">
                              <Upload className="h-4 w-4 shrink-0" />
                              {attachLiveFile ? attachLiveFile.name : "Choose file to share (PDF, DOCX, etc.)"}
                              <input type="file" className="hidden" onChange={e => setAttachLiveFile(e.target.files?.[0] ?? null)} />
                            </label>
                            <button onClick={handleAttachFile} disabled={!attachLiveFile}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold rounded-xl transition disabled:opacity-40">
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
                    )}

                    {/* Slides */}
                    {liveSubTab === "slides" && (
                      <div className="space-y-4">
                        {slides.length > 1 && (
                          <div className="bg-slate-900 dark:bg-black/40 rounded-2xl overflow-hidden">
                            <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.08]">
                              <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-widest">Slide {safeSlide + 1} of {slides.length}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleSlideChange(Math.max(0, safeSlide - 1))} disabled={safeSlide === 0}
                                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white rounded-lg disabled:opacity-30 transition"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
                                <button onClick={() => handleSlideChange(Math.min(slides.length - 1, safeSlide + 1))} disabled={safeSlide === slides.length - 1}
                                  className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-30 transition">Next <ChevronRight className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            <pre className="p-5 text-[13px] text-slate-100 whitespace-pre-wrap leading-relaxed min-h-[120px] font-sans">{slides[safeSlide]}</pre>
                          </div>
                        )}
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
                          <p className={lbl}>Upload PowerPoint (.pptx)</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors text-[12px] text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                              <Layers className="h-4 w-4 shrink-0" />
                              <span className="truncate">{pptxFile ? pptxFile.name : "Choose .pptx file"}</span>
                              <input type="file" accept=".pptx" className="hidden" onChange={e => setPptxFile(e.target.files?.[0] ?? null)} />
                            </label>
                            <button onClick={handleUploadPptx} disabled={!pptxFile || isUploadingPptx}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold rounded-xl transition disabled:opacity-40 flex-shrink-0">
                              {isUploadingPptx ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Parsing…</> : "Load Slides"}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">Slides are extracted from the PPTX and displayed in order during the live class.</p>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
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
                          <div className="space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{activePoll.question}</p>
                                <button onClick={handleClosePoll} className="text-[11px] font-semibold text-red-500 border border-red-200 dark:border-red-900/40 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition">Close Poll</button>
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
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{opt}</span>
                                            <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                                          </div>
                                          <div className="h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <p className="text-[11px] text-slate-400 mt-2">{total} response{total !== 1 ? "s" : ""}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 space-y-3">
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
                          <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                            <p className="text-[12px] text-slate-400">No students have joined yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {handRaises.length > 0 && (
                              <div className="mb-3">
                                <p className={lbl + " flex items-center gap-1.5 text-amber-600 dark:text-amber-400"}><ThumbsUp className="h-3.5 w-3.5" /> Raised Hands ({handRaises.length})</p>
                                <div className="space-y-1.5">
                                  {handRaises.map((h: any) => (
                                    <div key={h.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                                      <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">{h.studentName}</span>
                                      <button onClick={() => handleDismissHandRaise(h.id)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition">Dismiss</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {attendance.map((a: any) => (
                              <div key={a.studentId} className="flex items-center justify-between p-3 border border-slate-200/60 dark:border-white/[0.06] rounded-xl">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{a.studentName?.[0] ?? "?"}</span>
                                  </div>
                                  <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">{a.studentName}</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">{new Date(a.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat */}
                    {liveSubTab === "chat" && (
                      <div className="border border-slate-200/60 dark:border-white/[0.06] rounded-xl overflow-hidden flex flex-col h-[420px] bg-white dark:bg-white/[0.02]">
                        <div className="flex-1 p-3 overflow-y-auto space-y-3">
                          {liveChats.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-[11px] font-medium">Waiting for responses…</div>
                          ) : liveChats.map((chat) => {
                            const isMe = chat.senderRole === "lecturer";
                            return (
                              <div key={chat.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                                <UserAvatar userId={chat.senderId} role={isMe ? "lecturer" : "student"} size={26} initials={chat.senderName} className="shrink-0" />
                                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                  <span className={`text-[11px] font-bold font-mono uppercase tracking-wide ${isMe ? "text-amber-600 dark:text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>{chat.senderName}</span>
                                  <div className={`px-3 py-2 rounded-2xl text-[12px] break-words ${isMe ? "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 rounded-br-md" : "bg-slate-100 dark:bg-white/[0.06] rounded-bl-md"} text-slate-800 dark:text-slate-200`}>{chat.message}</div>
                                  <span className="text-[8.5px] text-slate-400 font-mono">{new Date(chat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={handleSendLecturerChat} className="p-2.5 border-t border-slate-100 dark:border-white/[0.06] flex gap-2 bg-white dark:bg-[#011a0d]">
                          <input type="text" required value={lecturerChatMessage} onChange={e => setLecturerChatMessage(e.target.value)} placeholder="Reply to class…"
                            className="flex-1 px-3 py-2.5 bg-white dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] rounded-xl text-[12.5px] text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-emerald-400 focus:shadow-[0_0_0_3px_rgba(5,150,105,0.12)] transition-[border-color,box-shadow] duration-200" />
                          <button type="submit" disabled={isSendingChat} className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 transition flex-shrink-0">
                            <Send className="h-3.5 w-3.5 text-white" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── 3. PUBLISH NOTES ── */}
          {activeTab === "notes" && (
            <div id="notes-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Publish Course Study Notes</h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Upload comprehensive module details for students to study.</p>
              </div>

              <form onSubmit={handlePublishNote} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Target Course Module</label>
                    <select value={noteCourseId} onChange={(e) => setNoteCourseId(e.target.value)} className="form-input">
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
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
            <div id="quizzes-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Deploy Secure Quiz & Examination</h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Configure timed question sets for instant testing and score logging.</p>
              </div>

              <form onSubmit={handleDeployQuizSubmit} className="space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4">
                  <div>
                    <label className={lbl}>Course Module</label>
                    <select value={quizCourseId} onChange={(e) => setQuizCourseId(e.target.value)} className="form-input">
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} / {c.title}</option>)}
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
            <div id="courses-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Course Registry</h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Register new academic course modules.</p>
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
                      <div key={c.id} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between bg-white dark:bg-white/[0.02] hover:border-emerald-100 dark:hover:border-emerald-900/30 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(4,120,87,0.10),0_1px_4px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.22)] transition-all duration-300 ease-out">
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
            <div id="departments-panel" className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Academic Departments</h2>
                <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Establish and manage school departments.</p>
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
                      <div key={dept.id} className="p-4 border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex items-center justify-between bg-white dark:bg-white/[0.02] hover:border-emerald-100 dark:hover:border-emerald-900/30 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(4,120,87,0.10),0_1px_4px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.22)] transition-all duration-300 ease-out">
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

          {activeTab === "exams" && (
            <div className="space-y-5">
              {/* Create Exam */}
              {!selectedExam ? (
                <div className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
                  <div>
                    <h2 className="text-[16px] font-bold text-slate-900 dark:text-white font-display">Written Exams: AI Grading</h2>
                    <p className="text-[12.5px] text-slate-400 dark:text-slate-500 mt-0.5">Upload a document with exam questions. Students type their answers. Upload the answer key and the AI grades automatically.</p>
                  </div>

                  <form onSubmit={handleCreateExam} className="space-y-4 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4">
                    <p className={lbl.replace("mb-2","mb-3") + " text-emerald-600 dark:text-emerald-400"}>Create New Exam</p>
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
                      </div>
                    </div>

                    <div>
                      <label className={lbl}>Upload Questions Document (.docx or .txt)</label>
                      <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors">
                        <Upload className="h-5 w-5 text-slate-400 shrink-0" />
                        <span className="text-[12.5px] text-slate-500 dark:text-slate-400">
                          {examFile ? examFile.name : "Click to choose file"}
                        </span>
                        <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setExamFile(e.target.files?.[0] ?? null); setExamQText(""); }} />
                      </label>
                    </div>

                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or paste text</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>

                    <div>
                      <label className={lbl}>Questions Text</label>
                      <textarea rows={6} value={examQText} onChange={e => { setExamQText(e.target.value); setExamFile(null); }} placeholder="Paste your exam questions here..." className="form-input resize-none" />
                    </div>

                    <button type="submit" className="btn-gradient w-full">Create Exam</button>
                  </form>

                  {/* Exam list */}
                  <div className="space-y-3">
                    <p className={lbl}>All Exams ({exams.length})</p>
                    {exams.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                        <FileText className="h-7 w-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-[12px] text-slate-400 dark:text-slate-500">No exams created yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {exams.map(exam => (
                          <button key={exam.id} onClick={() => { setSelectedExam(exam); fetchExamSubmissions(exam.id); }}
                            className="w-full text-left p-4 border border-slate-200/70 dark:border-white/[0.06] rounded-xl bg-white dark:bg-white/[0.02] hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-[0_4px_16px_rgba(4,120,87,0.10)] transition-all duration-200 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{exam.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{exam.course?.code} · {exam._count?.submissions ?? 0} submission{exam._count?.submissions !== 1 ? "s" : ""} · {exam.answerKeyText ? "Answer key uploaded" : "No answer key yet"}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${exam.isOpen ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}>
                              {exam.isOpen ? "Open" : "Closed"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Exam detail / management view */
                <div className="space-y-4">
                  <button onClick={() => { setSelectedExam(null); setExamSubmissions([]); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Exams
                  </button>

                  <div className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{selectedExam.title}</h2>
                        <p className="text-[12px] text-slate-400 mt-0.5">{selectedExam.course?.code} · {examSubmissions.length} submissions</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleExam(selectedExam.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors border-slate-200 dark:border-white/10 hover:border-emerald-300 text-slate-600 dark:text-slate-300">
                          {selectedExam.isOpen ? "Close Exam" : "Reopen Exam"}
                        </button>
                        <button onClick={() => handleDeleteExam(selectedExam.id)}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Questions preview */}
                    <div>
                      <p className={lbl}>Exam Questions</p>
                      <pre className="text-[12px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-4 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedExam.questionsText}</pre>
                    </div>

                    {/* Answer key upload */}
                    <div className="space-y-3 border-t border-slate-100 dark:border-white/[0.05] pt-4">
                      <p className={lbl + " flex items-center gap-1.5"}>{selectedExam.answerKeyText ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Answer Key (Replace)</> : "Upload Answer Key"}</p>
                      {selectedExam.answerKeyText && (
                        <pre className="text-[12px] text-slate-600 dark:text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl p-4 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">{selectedExam.answerKeyText}</pre>
                      )}
                      <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors">
                        <Upload className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-[12px] text-slate-500 dark:text-slate-400">{answerKeyFile ? answerKeyFile.name : "Upload answer key (.docx or .txt)"}</span>
                        <input type="file" accept=".docx,.doc,.txt" className="hidden" onChange={e => { setAnswerKeyFile(e.target.files?.[0] ?? null); setAnswerKeyText(""); }} />
                      </label>
                      <textarea rows={4} value={answerKeyText} onChange={e => { setAnswerKeyText(e.target.value); setAnswerKeyFile(null); }} placeholder="Or paste answer key text..." className="form-input resize-none" />
                      <button onClick={() => handleUploadAnswerKey(selectedExam.id)} className="btn-gradient w-full">
                        {selectedExam.answerKeyText ? "Replace Answer Key" : "Upload Answer Key"}
                      </button>
                    </div>

                    {/* Grade button */}
                    {selectedExam.answerKeyText && examSubmissions.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-white/[0.05] pt-4">
                        <button onClick={() => handleGradeAll(selectedExam.id)} disabled={isGrading}
                          className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-60">
                          {isGrading ? <><Loader2 className="h-4 w-4 animate-spin" />Grading with AI…</> : <><Star className="h-4 w-4" />Grade All Submissions with AI</>}
                        </button>
                        <p className="text-[11px] text-slate-400 text-center mt-2">NVIDIA AI will evaluate each student's answers against your answer key</p>
                      </div>
                    )}
                  </div>

                  {/* Submissions list */}
                  <div className="bg-white dark:bg-[#011a0d] border border-slate-200/70 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 dash-card space-y-4">
                    <p className="text-[14px] font-bold text-slate-900 dark:text-white">Student Submissions ({examSubmissions.length})</p>
                    {examSubmissions.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-700/50 rounded-xl">
                        <p className="text-[12px] text-slate-400">No submissions yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {examSubmissions.map(sub => (
                          <div key={sub.id} className="border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
                            <button onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-3 text-left">
                                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{sub.student?.fullName?.[0] ?? "?"}</span>
                                </div>
                                <div>
                                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{sub.student?.fullName}</p>
                                  <p className="text-[11px] text-slate-400">{sub.student?.regNumber} · {new Date(sub.submittedAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {sub.isGraded ? (
                                  <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${sub.score >= 50 ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/40 text-red-500"}`}>
                                    {sub.score?.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">Pending</span>
                                )}
                                {expandedSubmission === sub.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                              </div>
                            </button>
                            {expandedSubmission === sub.id && (
                              <div className="border-t border-slate-100 dark:border-white/[0.05] p-4 space-y-3 bg-slate-50/50 dark:bg-white/[0.01]">
                                <div>
                                  <p className={lbl}>Student's Answers</p>
                                  <pre className="text-[12px] text-slate-600 dark:text-slate-400 bg-white dark:bg-black/20 border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{sub.answersText}</pre>
                                </div>
                                {sub.isGraded && sub.feedback && (
                                  <div>
                                    <p className={lbl}>AI Feedback</p>
                                    <p className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-black/20 border border-slate-200/60 dark:border-white/[0.05] rounded-xl p-3">{sub.feedback}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
