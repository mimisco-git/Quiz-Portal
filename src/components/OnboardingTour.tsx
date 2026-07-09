import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, X } from "lucide-react";

interface Step {
  icon: string;
  title: string;
  body: string;
}

interface Props {
  role: "student" | "lecturer";
  onDone: () => void;
}

const STUDENT_STEPS: Step[] = [
  { icon: "📚", title: "Your courses are here", body: "The sidebar shows every course your department is enrolled in. Tap a course to jump straight to its notes, quizzes, or exams." },
  { icon: "🧠", title: "Take quizzes & exams", body: "Quizzes are auto-graded the moment you submit. Written exams are AI-graded by your lecturer. You can see your score and feedback in My Grades." },
  { icon: "📊", title: "Track your progress", body: "Open My Grades to see your full grade history, trend chart, and overall academic standing. Download a PDF report any time." },
  { icon: "📅", title: "Never miss a deadline", body: "The Calendar tab shows every upcoming quiz, exam, and assignment due date across all your courses — with countdown badges." },
  { icon: "💬", title: "Ask questions", body: "The Discussions tab is your course forum. Post questions, get answers from classmates or your lecturer, right inside the portal." },
  { icon: "🔒", title: "Secure assessments", body: "Quizzes run in a secure proctored mode. Switching tabs or leaving the window will be logged. Stay focused — three violations auto-submit your attempt." },
];

const LECTURER_STEPS: Step[] = [
  { icon: "🎓", title: "Manage your courses", body: "Create courses, set target year levels, and assign departments. Students in the matching dept/year automatically see your content." },
  { icon: "🧪", title: "Deploy quizzes with AI", body: "Type a topic and let the AI generate ready-to-use MCQ questions. Edit, reorder, or pull questions from your personal Question Bank." },
  { icon: "📝", title: "Post exams & assignments", body: "Upload a question document, set an answer key, and the AI grades all submissions in one click. You can still override any score manually." },
  { icon: "📈", title: "Analytics at a glance", body: "The Analytics tab shows average scores, pass rates, and per-course performance bars — updated in real time as submissions come in." },
  { icon: "💬", title: "Discussion boards", body: "Students post questions under each course. You can pin important threads, reply from the lecturer side, and keep discourse in one place." },
  { icon: "✏️", title: "Rich Markdown notes", body: "The notes editor supports full Markdown with live preview. Use $...$ for inline math and $$...$$ for display equations — perfect for STEM." },
];

export default function OnboardingTour({ role, onDone }: Props) {
  const steps = role === "student" ? STUDENT_STEPS : LECTURER_STEPS;
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="apple-card w-full max-w-sm overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-black/[0.06] dark:bg-white/[0.06]">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="p-6">
          <div className="text-5xl mb-4 text-center">{steps[step].icon}</div>
          <h2 className="text-[18px] font-bold text-[#1d1d1f] dark:text-white/90 tracking-tight text-center mb-2">{steps[step].title}</h2>
          <p className="text-[13.5px] text-[#6e6e73] dark:text-white/50 text-center leading-relaxed">{steps[step].body}</p>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-5 mb-6">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-emerald-500" : "w-1.5 bg-black/[0.12] dark:bg-white/[0.15]"}`} />
            ))}
          </div>

          <div className="flex gap-2">
            {isLast ? (
              <button onClick={onDone}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[14px] font-bold rounded-[12px] transition cursor-pointer">
                Get Started
              </button>
            ) : (
              <>
                <button onClick={onDone}
                  className="px-4 py-3 text-[13px] font-semibold text-[#6e6e73] dark:text-white/40 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] rounded-[12px] transition cursor-pointer">
                  Skip
                </button>
                <button onClick={() => setStep(s => s + 1)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[13px] font-bold rounded-[12px] transition hover:opacity-90 cursor-pointer">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
