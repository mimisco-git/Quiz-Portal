import React, { useState, useEffect } from "react";
import { MessageSquare, PlusCircle, ChevronLeft, Pin, Trash2, Send, BookOpen, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Thread {
  id: string;
  courseId: string;
  authorId: string;
  authorRole: string;
  authorName: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  _count?: { replies: number };
  course?: { code: string; title: string };
}

interface Reply {
  id: string;
  authorId: string;
  authorRole: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface CourseOption {
  id: string;
  code: string;
  title: string;
}

interface Props {
  token: string;
  userId: string;
  userRole: "student" | "lecturer";
  userName: string;
  courses?: CourseOption[];
  courseId?: string;
  courseCode?: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DiscussionBoard({ token, userId, userRole, userName, courses = [], courseId: propCourseId, courseCode: propCourseCode }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState(propCourseId ?? "");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<(Thread & { replies: Reply[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authH = { Authorization: `Bearer ${token}` };
  const jsonH = { ...authH, "Content-Type": "application/json" };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const fetchThreads = async (cid: string) => {
    if (!cid) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/courses/${cid}/threads`, { headers: authH });
      if (r.ok) setThreads(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (selectedCourseId) fetchThreads(selectedCourseId);
    else setThreads([]);
  }, [selectedCourseId]);

  const openThread = async (t: Thread) => {
    const r = await fetch(`/api/threads/${t.id}`, { headers: authH });
    if (r.ok) setActiveThread(await r.json());
  };

  const submitThread = async () => {
    if (!newTitle.trim() || !newBody.trim() || !selectedCourseId) return;
    setSubmitting(true);
    const r = await fetch(`/api/courses/${selectedCourseId}/threads`, {
      method: "POST", headers: jsonH,
      body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
    });
    if (r.ok) {
      setComposing(false); setNewTitle(""); setNewBody("");
      fetchThreads(selectedCourseId);
    }
    setSubmitting(false);
  };

  const submitReply = async () => {
    if (!replyBody.trim() || !activeThread) return;
    setSubmitting(true);
    const r = await fetch(`/api/threads/${activeThread.id}/replies`, {
      method: "POST", headers: jsonH,
      body: JSON.stringify({ body: replyBody.trim() }),
    });
    if (r.ok) {
      setReplyBody("");
      const updated = await fetch(`/api/threads/${activeThread.id}`, { headers: authH });
      if (updated.ok) setActiveThread(await updated.json());
      fetchThreads(selectedCourseId);
    }
    setSubmitting(false);
  };

  const pinThread = async (id: string) => {
    await fetch(`/api/threads/${id}/pin`, { method: "PATCH", headers: authH });
    fetchThreads(selectedCourseId);
    if (activeThread?.id === id) {
      const updated = await fetch(`/api/threads/${id}`, { headers: authH });
      if (updated.ok) setActiveThread(await updated.json());
    }
  };

  const deleteThread = async (id: string) => {
    if (!confirm("Delete this thread and all its replies?")) return;
    await fetch(`/api/threads/${id}`, { method: "DELETE", headers: authH });
    if (activeThread?.id === id) setActiveThread(null);
    fetchThreads(selectedCourseId);
  };

  const avatarCls = (role: string) =>
    role === "lecturer"
      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
      : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";

  // ── Thread detail view ──────────────────────────────────────
  if (activeThread) {
    return (
      <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>
        <div className="apple-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <button onClick={() => setActiveThread(null)} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2 cursor-pointer">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Discussions
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="apple-title">{activeThread.title}</h2>
                <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5">
                  {selectedCourse && <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mr-1">{selectedCourse.code}</span>}
                  {activeThread.authorName} · {timeAgo(activeThread.createdAt)}
                  {activeThread.isPinned && <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold">📌 Pinned</span>}
                </p>
              </div>
              {(userRole === "lecturer" || activeThread.authorId === userId) && (
                <div className="flex gap-1 flex-shrink-0">
                  {userRole === "lecturer" && (
                    <button onClick={() => pinThread(activeThread.id)} title="Pin / Unpin"
                      className="p-1.5 rounded-[8px] hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-500 transition cursor-pointer">
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteThread(activeThread.id)} title="Delete thread"
                    className="p-1.5 rounded-[8px] hover:bg-red-50 dark:hover:bg-red-950/20 text-[#8e8e93] hover:text-red-500 transition cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Original post */}
          <div className="p-5">
            <div className="flex gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${avatarCls(activeThread.authorRole)}`}>
                {activeThread.authorName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white/88">{activeThread.authorName}
                  {activeThread.authorRole === "lecturer" && <span className="ml-1.5 text-[9.5px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Lecturer</span>}
                </p>
                <p className="text-[13px] text-[#3a3a3c] dark:text-white/70 mt-1 leading-relaxed whitespace-pre-wrap">{activeThread.body}</p>
              </div>
            </div>
          </div>

          {/* Replies */}
          {activeThread.replies.length > 0 && (
            <div className="border-t border-black/[0.06] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {activeThread.replies.map(r => (
                <div key={r.id} className="px-5 py-4 flex gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarCls(r.authorRole)}`}>
                    {r.authorName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold text-[#1d1d1f] dark:text-white/88">{r.authorName}
                      {r.authorRole === "lecturer" && <span className="ml-1.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Lecturer</span>}
                      <span className="ml-2 text-[10px] text-[#8e8e93] dark:text-white/30 font-normal">{timeAgo(r.createdAt)}</span>
                    </p>
                    <p className="text-[12.5px] text-[#3a3a3c] dark:text-white/70 mt-0.5 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <div className="border-t border-black/[0.06] dark:border-white/[0.06] p-5">
            <textarea
              rows={3} value={replyBody} onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
              className="form-input resize-none text-[13px] mb-3"
            />
            <button onClick={submitReply} disabled={submitting || !replyBody.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold rounded-[10px] transition disabled:opacity-50 cursor-pointer">
              <Send className="h-3.5 w-3.5" /> Post Reply
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Thread list ─────────────────────────────────────────────
  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}>

      {/* Course selector — only shown when courses list is provided and no fixed courseId prop */}
      {courses.length > 0 && !propCourseId && (
        <div className="apple-card px-5 py-4">
          <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-2">
            Select Course
          </label>
          <div className="relative">
            <select
              value={selectedCourseId}
              onChange={e => { setSelectedCourseId(e.target.value); setActiveThread(null); }}
              className="form-input text-[13px] appearance-none pr-8 cursor-pointer"
            >
              <option value="">— Choose a course to view discussions —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e8e93] dark:text-white/30" />
          </div>
        </div>
      )}

      {/* Prompt when no course selected */}
      {!selectedCourseId && (
        <div className="apple-card">
          <div className="apple-empty-state py-16">
            <div className="apple-empty-state__icon">
              <BookOpen className="h-7 w-7 text-[#8e8e93] dark:text-white/30" />
            </div>
            <p className="apple-empty-state__title">Select a course above</p>
            <p className="apple-empty-state__body">Choose a course from the dropdown to see its discussions and post questions.</p>
          </div>
        </div>
      )}

      {/* Threads panel — shown only when a course is selected */}
      {selectedCourseId && (
        <div className="apple-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="apple-title flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                {selectedCourse
                  ? `${selectedCourse.code} Discussions`
                  : propCourseCode
                    ? `${propCourseCode} Discussions`
                    : "Discussions"}
              </h2>
              <p className="apple-subtitle">Ask questions, share insights, help each other.</p>
            </div>
            <button onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold rounded-[10px] transition cursor-pointer">
              <PlusCircle className="h-3.5 w-3.5" /> New Thread
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[12px] text-[#8e8e93] dark:text-white/35">Loading discussions…</div>
          ) : threads.length === 0 ? (
            <div className="apple-empty-state">
              <div className="apple-empty-state__icon"><MessageSquare className="h-6 w-6 text-[#8e8e93] dark:text-white/30" /></div>
              <p className="apple-empty-state__title">No threads yet</p>
              <p className="apple-empty-state__body">Be the first to start a discussion for this course.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {threads.map(t => (
                <button key={t.id} onClick={() => openThread(t)}
                  className="w-full flex items-start gap-3 px-5 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition text-left cursor-pointer">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 ${avatarCls(t.authorRole)}`}>
                    {t.authorName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.isPinned && <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                      <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white/88 truncate">{t.title}</p>
                    </div>
                    <p className="text-[11px] text-[#6e6e73] dark:text-white/40 mt-0.5 line-clamp-1">{t.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10.5px] text-[#8e8e93] dark:text-white/30">{t.authorName} · {timeAgo(t.createdAt)}</span>
                      {(t._count?.replies ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10.5px] text-[#6e6e73] dark:text-white/40">
                          <MessageSquare className="h-3 w-3" /> {t._count!.replies}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setComposing(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="apple-card w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h3 className="apple-title">Start a Discussion</h3>
                {selectedCourse && (
                  <p className="apple-subtitle mt-0.5">
                    Posting in <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{selectedCourse.code}</span> — {selectedCourse.title}
                  </p>
                )}
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-1">Title</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's your question or topic?" className="form-input text-[13px]" />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[#6e6e73] dark:text-white/40 mb-1">Details</label>
                  <textarea rows={4} value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Provide details, show your work, describe what you've tried…" className="form-input resize-none text-[13px]" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={submitThread} disabled={submitting || !newTitle.trim() || !newBody.trim()}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold rounded-[10px] transition disabled:opacity-50 cursor-pointer">
                    {submitting ? "Posting…" : "Post Thread"}
                  </button>
                  <button onClick={() => setComposing(false)}
                    className="px-4 py-2.5 text-[13px] font-semibold text-[#6e6e73] dark:text-white/50 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] rounded-[10px] transition cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
