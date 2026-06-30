import express from "express";
import path from "path";
import fs from "fs";
// vite is imported dynamically inside startServer() so it's excluded from the Vercel Lambda bundle
import jwt from "jsonwebtoken";
import multer from "multer";
import mammoth from "mammoth";
import JSZip from "jszip";
import OpenAI from "openai";
import { prisma } from "./src/lib/db.js";
import { seedDatabase } from "./src/lib/seed.js";

const app = express();
const PORT = 3000;
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[WARN] JWT_SECRET env var is not set — using fallback. Set it in Vercel → Settings → Environment Variables for proper security.");
}
const JWT_SECRET = process.env.JWT_SECRET || "futo-quizos-fallback-secret-2026-set-jwt-secret-env-var";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Helper Middleware to verify authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// -------------------------------------------------------------
// AUTHENTICATION API
// -------------------------------------------------------------

// Student Registration Route
app.post("/api/auth/student-register", async (req, res) => {
  const { fullName, email, regNumber, department, year, securityQuestion, securityAnswer } = req.body;

  if (!fullName || !email || !regNumber || !department || !year || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: "All registration fields are required." });
  }

  try {
    const normalizedReg = regNumber.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if registration number is already registered
    const existingReg = await prisma.student.findUnique({
      where: { regNumber: normalizedReg },
    });
    if (existingReg) {
      return res.status(400).json({ error: "This Registration Number is already registered." });
    }

    // Check if email already exists
    const existingEmail = await prisma.student.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      return res.status(400).json({ error: "This email address is already in use." });
    }

    // Create the student
    const student = await prisma.student.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        regNumber: normalizedReg,
        department: department.trim(),
        year: year.trim(),
        securityQuestion: securityQuestion.trim(),
        securityAnswer: securityAnswer.trim().toLowerCase(),
      },
    });

    const token = jwt.sign(
      {
        id: student.id,
        fullName: student.fullName,
        regNumber: student.regNumber,
        department: student.department,
        year: student.year,
        role: "student",
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.status(201).json({
      token,
      user: {
        id: student.id,
        fullName: student.fullName,
        regNumber: student.regNumber,
        department: student.department,
        year: student.year,
        role: "student",
      },
    });
  } catch (error: any) {
    console.error("Student registration error:", error);
    return res.status(500).json({ error: "Failed to register student. Please try again." });
  }
});

// Student Login Route (with only regNumber and year)
app.post("/api/auth/student-login", async (req, res) => {
  const { regNumber, year } = req.body;

  if (!regNumber || !year) {
    return res.status(400).json({ error: "Registration Number and Year of Study are required." });
  }

  try {
    const normalizedReg = regNumber.trim().toUpperCase();

    // Find student
    const student = await prisma.student.findUnique({
      where: { regNumber: normalizedReg },
    });

    if (!student) {
      return res.status(404).json({
        error: "Registration Number not found. Please register to access the portal.",
      });
    }

    // Verify year matches closely (case-insensitive)
    if (student.year.toLowerCase().trim() !== year.toLowerCase().trim()) {
      return res.status(400).json({
        error: `The Year of Study provided does not match our records for ${normalizedReg}. If you forgot or need to update your year, use the security verification helper below.`,
        mismatch: true,
      });
    }

    // Generate secure JWT token
    const token = jwt.sign(
      {
        id: student.id,
        fullName: student.fullName,
        regNumber: student.regNumber,
        department: student.department,
        year: student.year,
        role: "student",
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({
      token,
      user: {
        id: student.id,
        fullName: student.fullName,
        regNumber: student.regNumber,
        department: student.department,
        year: student.year,
        role: "student",
      },
    });
  } catch (error: any) {
    console.error("Student login error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

// Get student's security question
app.post("/api/auth/student-get-security-question", async (req, res) => {
  const { regNumber } = req.body;
  if (!regNumber) {
    return res.status(400).json({ error: "Registration Number is required." });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { regNumber: regNumber.trim().toUpperCase() },
      select: { securityQuestion: true },
    });

    if (!student) {
      return res.status(404).json({ error: "Registration Number not found." });
    }

    return res.json({ securityQuestion: student.securityQuestion });
  } catch (error: any) {
    console.error("Error retrieving security question:", error);
    return res.status(500).json({ error: "Error retrieving security question." });
  }
});

// Answer security question and fix/update year
app.post("/api/auth/student-fix-year", async (req, res) => {
  const { regNumber, securityAnswer, newYear } = req.body;

  if (!regNumber || !securityAnswer || !newYear) {
    return res.status(400).json({ error: "Registration Number, security answer, and target Year of Study are required." });
  }

  try {
    const normalizedReg = regNumber.trim().toUpperCase();
    const student = await prisma.student.findUnique({
      where: { regNumber: normalizedReg },
    });

    if (!student) {
      return res.status(404).json({ error: "Registration Number not found." });
    }

    // Compare security answers
    if (student.securityAnswer.toLowerCase().trim() !== securityAnswer.toLowerCase().trim()) {
      return res.status(400).json({ error: "Incorrect answer to security question. Access denied." });
    }

    // Security answer is correct, update the student's year!
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: { year: newYear.trim() },
    });

    // Generate login token directly for a seamless experience
    const token = jwt.sign(
      {
        id: updatedStudent.id,
        fullName: updatedStudent.fullName,
        regNumber: updatedStudent.regNumber,
        department: updatedStudent.department,
        year: updatedStudent.year,
        role: "student",
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({
      message: "Year successfully verified and updated. Welcome back!",
      token,
      user: {
        id: updatedStudent.id,
        fullName: updatedStudent.fullName,
        regNumber: updatedStudent.regNumber,
        department: updatedStudent.department,
        year: updatedStudent.year,
        role: "student",
      },
    });
  } catch (error: any) {
    console.error("Error verifying security question:", error);
    return res.status(500).json({ error: "Error updating Year of Study." });
  }
});

// Lecturer Registration Route
app.post("/api/auth/lecturer-register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Verify if email already registered
    const existingLecturer = await prisma.lecturer.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingLecturer) {
      return res.status(400).json({ error: "This email address is already registered as a lecturer." });
    }

    const lecturer = await prisma.lecturer.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: password, // In production we should hash this, but for school assessment mock/auth plain text works
      },
    });

    const token = jwt.sign(
      {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        role: "lecturer",
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(201).json({
      token,
      user: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        role: "lecturer",
      },
    });
  } catch (error: any) {
    console.error("Lecturer registration error:", error);
    return res.status(500).json({ error: "Failed to register lecturer." });
  }
});

// Lecturer Login Route
app.post("/api/auth/lecturer-login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password are required." });
  }

  try {
    const lecturer = await prisma.lecturer.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!lecturer || lecturer.password !== password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        role: "lecturer",
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        role: "lecturer",
      },
    });
  } catch (error: any) {
    console.error("Lecturer login error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

// -------------------------------------------------------------
// COURSE & NOTE PLATFORM API
// -------------------------------------------------------------

// Fetch all courses with basic info
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lecturer: {
          select: { name: true, email: true },
        },
        _count: {
          select: { notes: true, quizzes: true },
        },
      },
    });
    return res.json(courses);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({ error: "Error fetching courses" });
  }
});

// Fetch detailed course view with its notes and quizzes
app.get("/api/courses/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lecturer: {
          select: { name: true, email: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
        quizzes: {
          include: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    return res.json(course);
  } catch (error: any) {
    console.error("Error fetching course detail:", error);
    return res.status(500).json({ error: "Error fetching course details" });
  }
});

// Fetch all lecture notes (optionally filter by course)
app.get("/api/notes", async (req, res) => {
  const { courseId } = req.query;
  try {
    const where: any = {};
    if (courseId) {
      where.courseId = String(courseId);
    }
    const notes = await prisma.lectureNote.findMany({
      where,
      include: {
        course: {
          select: { code: true, title: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(notes);
  } catch (error: any) {
    console.error("Error fetching lecture notes:", error);
    return res.status(500).json({ error: "Error fetching lecture notes" });
  }
});

// Create Course (Lecturer Only)
app.post("/api/courses", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only Lecturers can perform this action" });
  }

  const { code, title } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Course code and title are required" });
  }

  try {
    const newCourse = await prisma.course.create({
      data: {
        code: code.toUpperCase().replace(/\s+/g, ""),
        title,
        lecturerId: req.user.id,
      },
    });
    return res.status(201).json(newCourse);
  } catch (error: any) {
    console.error("Error creating course:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "A course with this code already exists" });
    }
    return res.status(500).json({ error: "Error creating course" });
  }
});

// Create Lecture Note (Lecturer Only)
app.post("/api/notes", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only Lecturers can perform this action" });
  }

  const { title, content, courseId } = req.body;
  if (!title || !content || !courseId) {
    return res.status(400).json({ error: "Title, Content, and Course ID are required" });
  }

  try {
    const newNote = await prisma.lectureNote.create({
      data: {
        title,
        content,
        courseId,
      },
    });
    return res.status(201).json(newNote);
  } catch (error: any) {
    console.error("Error creating lecture note:", error);
    return res.status(500).json({ error: "Error creating lecture note" });
  }
});

// Delete Lecture Note (Lecturer Only)
app.delete("/api/notes/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only Lecturers can perform this action" });
  }

  const { id } = req.params;
  try {
    await prisma.lectureNote.delete({ where: { id } });
    return res.json({ message: "Lecture note deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting note:", error);
    return res.status(500).json({ error: "Error deleting note" });
  }
});

// Create Quiz (Lecturer Only)
app.post("/api/quizzes", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only Lecturers can perform this action" });
  }

  const { title, durationMinutes, courseId, questions } = req.body;
  if (!title || !durationMinutes || !courseId || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing required fields or invalid format." });
  }

  try {
    const quiz = await prisma.quiz.create({
      data: {
        title,
        durationMinutes: parseInt(durationMinutes, 10),
        courseId,
      },
    });

    // Create questions
    for (const q of questions) {
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          text: q.text,
          optionsJson: JSON.stringify(q.options),
          correctOption: q.correctOption,
        },
      });
    }

    return res.status(201).json(quiz);
  } catch (error: any) {
    console.error("Error creating quiz:", error);
    return res.status(500).json({ error: "Error creating quiz" });
  }
});

// Fetch Quiz detailed view (Students get version without correctOption)
app.get("/api/quizzes/:id", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        course: true,
        questions: true,
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Secure correctOptions from students who are in-progress
    if (req.user.role === "student") {
      // Find if they have a completed attempt to see results
      const completedAttempt = await prisma.studentAttempt.findFirst({
        where: {
          quizId: id,
          studentId: req.user.id,
          isCompleted: true,
        },
      });

      // If they haven't completed, strip correct options
      if (!completedAttempt) {
        quiz.questions = quiz.questions.map((q) => ({
          ...q,
          correctOption: "", // Hide the answer!
        }));
      }
    }

    return res.json(quiz);
  } catch (error: any) {
    console.error("Error fetching quiz detail:", error);
    return res.status(500).json({ error: "Error fetching quiz details" });
  }
});

// -------------------------------------------------------------
// EXAMINATION ENGINE & TIMER API
// -------------------------------------------------------------

// Start Quiz (Student)
app.post("/api/quiz/start", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only Students can take quizzes" });
  }

  const { quizId } = req.body;
  if (!quizId) {
    return res.status(400).json({ error: "Quiz ID is required" });
  }

  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Check if there is an active/uncompleted attempt already
    let attempt = await prisma.studentAttempt.findFirst({
      where: {
        quizId,
        studentId: req.user.id,
        isCompleted: false,
      },
    });

    if (!attempt) {
      // Check if they already have a completed attempt
      const completedAttempt = await prisma.studentAttempt.findFirst({
        where: {
          quizId,
          studentId: req.user.id,
          isCompleted: true,
        },
      });

      if (completedAttempt) {
        return res.status(400).json({
          error: "You have already completed this exam. Multi-attempt is not allowed.",
          attempt: completedAttempt,
        });
      }

      // Create a brand new attempt
      attempt = await prisma.studentAttempt.create({
        data: {
          quizId,
          studentId: req.user.id,
          startedAt: new Date(),
          isCompleted: false,
        },
      });
    }

    return res.json({
      attempt,
      durationMinutes: quiz.durationMinutes,
      serverTime: new Date(),
    });
  } catch (error: any) {
    console.error("Error starting quiz:", error);
    return res.status(500).json({ error: "Error starting quiz session" });
  }
});

// Get Secures Remaining Time API (Prevents Client Clock Tampering)
app.get("/api/quiz/remaining-time/:attemptId", authenticateToken, async (req: any, res) => {
  const { attemptId } = req.params;

  try {
    const attempt = await prisma.studentAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Quiz session attempt not found" });
    }

    if (attempt.isCompleted) {
      return res.json({ remainingSeconds: 0, isCompleted: true });
    }

    const now = new Date();
    const startedAt = new Date(attempt.startedAt);
    const durationMs = attempt.quiz.durationMinutes * 60 * 1000;
    const elapsedMs = now.getTime() - startedAt.getTime();
    const remainingMs = durationMs - elapsedMs;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    return res.json({
      remainingSeconds,
      isCompleted: false,
      serverTime: now,
    });
  } catch (error: any) {
    console.error("Error fetching remaining time:", error);
    return res.status(500).json({ error: "Error fetching remaining time" });
  }
});

// Quiz Submission Route (With Server Validation and Grace Period)
app.post("/api/quiz/submit", authenticateToken, async (req: any, res) => {
  const { attemptId, answers } = req.body; // 'answers' is a map of questionId -> selectedOption

  if (!attemptId) {
    return res.status(400).json({ error: "Attempt ID is required" });
  }

  try {
    const attempt = await prisma.studentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: { questions: true },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ error: "This attempt has already been submitted or locked." });
    }

    const now = new Date();
    const startedAt = new Date(attempt.startedAt);
    const allowedDurationSeconds = attempt.quiz.durationMinutes * 60;
    const elapsedSeconds = (now.getTime() - startedAt.getTime()) / 1000;

    const GRACE_PERIOD_SECONDS = 10;
    const maxAllowedTimeSeconds = allowedDurationSeconds + GRACE_PERIOD_SECONDS;

    let finalScore = 0;
    let timedOut = false;

    // Time-tampering or legitimate time-out backend duration check
    if (elapsedSeconds > maxAllowedTimeSeconds) {
      timedOut = true;
      // "automatically lock the score, set isCompleted to true, and invalidate the session."
      // Let's compute the score based on whatever answers were submitted, OR set to zero if invalid tampering.
      // We will award score only for answers that were completed, but lock it as timed-out!
      console.warn(`Attempt ${attemptId} exceeded duration limits: elapsed ${elapsedSeconds}s vs max ${maxAllowedTimeSeconds}s.`);
    }

    // Process quiz scoring
    const questions = attempt.quiz.questions;
    const submissionAnswers = answers || {};

    // Validate for skipped/unanswered questions unless it's a forced background/timeout submit
    const isAutoSubmit = req.body.isAutoSubmit || req.body.autoSubmit || false;
    if (!timedOut && !isAutoSubmit && req.body.confirmSkipped !== true) {
      const skippedCount = questions.filter((q) => !submissionAnswers[q.id]).length;
      if (skippedCount > 0) {
        return res.status(400).json({
          error: "skipped_questions",
          message: `Submission rejected: You have ${skippedCount} skipped/unanswered question(s).`,
          skippedCount,
        });
      }
    }

    let correctCount = 0;

    questions.forEach((q) => {
      const studentAnswer = submissionAnswers[q.id];
      if (studentAnswer && studentAnswer === q.correctOption) {
        correctCount++;
      }
    });

    finalScore = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    // Update attempt
    const updatedAttempt = await prisma.studentAttempt.update({
      where: { id: attemptId },
      data: {
        isCompleted: true,
        submittedAt: now,
        score: timedOut ? Math.max(0, finalScore - 10) : finalScore, // minor penalty or lock score
        answersJson: JSON.stringify(submissionAnswers),
      },
    });

    if (timedOut) {
      return res.status(408).json({
        error: "Exam duration limit exceeded. Session invalidated and score locked.",
        attempt: updatedAttempt,
        timedOut: true,
      });
    }

    return res.json({
      message: "Quiz submitted successfully",
      attempt: updatedAttempt,
      score: finalScore,
      timedOut: false,
    });
  } catch (error: any) {
    console.error("Error submitting quiz:", error);
    return res.status(500).json({ error: "An error occurred during submission" });
  }
});

// -------------------------------------------------------------
// LECTURER GRADEBOOK / MONITORING API
// -------------------------------------------------------------
app.get("/api/lecturer/gradebook", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Unauthorized access" });
  }

  try {
    const attempts = await prisma.studentAttempt.findMany({
      include: {
        student: {
          select: { fullName: true, regNumber: true, department: true, year: true },
        },
        quiz: {
          select: { title: true, course: { select: { code: true } } },
        },
      },
      orderBy: { submittedAt: "desc" },
    });
    return res.json(attempts);
  } catch (error: any) {
    console.error("Error fetching gradebook:", error);
    return res.status(500).json({ error: "Error fetching gradebook" });
  }
});


// -------------------------------------------------------------
// DEPARTMENT MANAGEMENT API
// -------------------------------------------------------------
app.get("/api/departments", async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    return res.json(departments);
  } catch (error: any) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ error: "Error fetching departments" });
  }
});

app.post("/api/departments", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only lecturers can create departments." });
  }
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Department name is required" });
  }

  try {
    const newDept = await prisma.department.create({
      data: { name: name.trim() },
    });
    return res.status(201).json(newDept);
  } catch (error: any) {
    console.error("Error creating department:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "A department with this name already exists" });
    }
    return res.status(500).json({ error: "Error creating department" });
  }
});

// -------------------------------------------------------------
// STUDENT PROFILE & YEAR ADVANCEMENT API
// -------------------------------------------------------------
app.post("/api/student/promote-year", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only students can update their profile." });
  }
  const { newYear } = req.body;
  if (!newYear) {
    return res.status(400).json({ error: "New Year of Study is required." });
  }

  try {
    const updated = await prisma.student.update({
      where: { id: req.user.id },
      data: { year: newYear.trim() },
    });
    return res.json(updated);
  } catch (error: any) {
    console.error("Error promoting/updating student year:", error);
    return res.status(500).json({ error: "Error updating Year of Study." });
  }
});

// Student: get own exam attempts
app.get("/api/student/attempts", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only students can access their own attempts." });
  }
  try {
    const attempts = await prisma.studentAttempt.findMany({
      where: { studentId: req.user.id },
      include: {
        quiz: {
          select: { id: true, title: true, courseId: true, course: { select: { code: true } } },
        },
      },
      orderBy: { startedAt: "desc" },
    });
    return res.json(attempts);
  } catch (error: any) {
    console.error("Error fetching student attempts:", error);
    return res.status(500).json({ error: "Error fetching attempts." });
  }
});

// -------------------------------------------------------------
// LIVE LECTURING & STUDY CHANNELS API
// -------------------------------------------------------------
app.post("/api/lectures", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only lecturers can broadcast lectures." });
  }
  const { courseId, topic, content } = req.body;
  if (!courseId || !topic || !content) {
    return res.status(400).json({ error: "Course ID, topic, and content are required." });
  }

  try {
    // Deactivate previous active lectures for this course first
    await prisma.lectureSession.updateMany({
      where: { courseId, isActive: true },
      data: { isActive: false },
    });

    const session = await prisma.lectureSession.create({
      data: {
        courseId,
        topic: topic.trim(),
        content,
        isActive: true,
        jitsiRoom: `quizos-${Date.now().toString(36)}`,
      },
    });

    return res.status(201).json(session);
  } catch (error: any) {
    console.error("Error launching live lecture:", error);
    return res.status(500).json({ error: "Error launching live lecture" });
  }
});

app.get("/api/lectures/active/:courseId", authenticateToken, async (req: any, res) => {
  const { courseId } = req.params;
  try {
    const session = await prisma.lectureSession.findFirst({
      where: { courseId, isActive: true },
      include: {
        chats: { orderBy: { createdAt: "asc" } },
        attendance: { select: { studentId: true, studentName: true, joinedAt: true } },
        handRaises: { where: { isResolved: false }, orderBy: { raisedAt: "asc" } },
        polls: {
          where: { isActive: true },
          take: 1,
          include: { responses: { select: { studentId: true, answer: true, studentName: true } } },
        },
      },
    });
    return res.json(session);
  } catch (error: any) {
    console.error("Error fetching active lecture session:", error);
    return res.status(500).json({ error: "Error fetching active lecture session" });
  }
});

app.post("/api/lectures/:id/chat", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message content cannot be empty." });
  }

  try {
    const chat = await prisma.lectureChat.create({
      data: {
        lectureSessionId: id,
        message: message.trim(),
        senderId: req.user.id,
        senderName: req.user.role === "student" ? req.user.fullName : req.user.name,
        senderRole: req.user.role,
      },
    });
    return res.status(201).json(chat);
  } catch (error: any) {
    console.error("Error posting chat in lecture:", error);
    return res.status(500).json({ error: "Error posting chat message" });
  }
});

app.get("/api/lectures/:id/chat", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    const chats = await prisma.lectureChat.findMany({
      where: { lectureSessionId: id },
      orderBy: { createdAt: "asc" },
    });
    return res.json(chats);
  } catch (error: any) {
    console.error("Error fetching chat messages:", error);
    return res.status(500).json({ error: "Error fetching chat messages" });
  }
});

app.post("/api/lectures/:id/end", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only lecturers can end lectures." });
  }
  const { id } = req.params;
  try {
    const ended = await prisma.lectureSession.update({
      where: { id },
      data: { isActive: false },
    });
    return res.json(ended);
  } catch (error: any) {
    console.error("Error ending live lecture:", error);
    return res.status(500).json({ error: "Error ending live lecture" });
  }
});

app.patch("/api/lectures/:id/content", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only lecturers can update lecture content." });
  }
  const { id } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Content is required to update slides." });
  }

  try {
    const updated = await prisma.lectureSession.update({
      where: { id },
      data: { content },
    });
    return res.json(updated);
  } catch (error: any) {
    console.error("Error updating lecture content:", error);
    return res.status(500).json({ error: "Error updating lecture content" });
  }
});

// Record student attendance (upsert — safe to call on every poll)
app.post("/api/lectures/:id/join", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.json({ ok: true });
  try {
    await prisma.lectureAttendance.upsert({
      where: { sessionId_studentId: { sessionId: req.params.id, studentId: req.user.id } },
      update: {},
      create: { sessionId: req.params.id, studentId: req.user.id, studentName: req.user.fullName ?? req.user.name ?? "Student" },
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.json({ ok: true }); // non-critical
  }
});

// Get attendance list (lecturer)
app.get("/api/lectures/:id/attendance", authenticateToken, async (req: any, res) => {
  try {
    const list = await prisma.lectureAttendance.findMany({
      where: { sessionId: req.params.id },
      orderBy: { joinedAt: "asc" },
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Student raises / lowers hand
app.post("/api/lectures/:id/hand-raise", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  try {
    const existing = await prisma.handRaise.findFirst({
      where: { sessionId: req.params.id, studentId: req.user.id, isResolved: false },
    });
    if (existing) {
      await prisma.handRaise.update({ where: { id: existing.id }, data: { isResolved: true } });
      return res.json({ raised: false });
    }
    await prisma.handRaise.create({
      data: { sessionId: req.params.id, studentId: req.user.id, studentName: req.user.fullName ?? req.user.name ?? "Student" },
    });
    return res.json({ raised: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to toggle hand raise" });
  }
});

// Lecturer dismisses a hand raise
app.delete("/api/lectures/:id/hand-raises/:raiseId", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    await prisma.handRaise.update({ where: { id: req.params.raiseId }, data: { isResolved: true } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to dismiss hand raise" });
  }
});

// Lecturer creates a poll
app.post("/api/lectures/:id/poll", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { question, options } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: "Question and at least 2 options required" });
  }
  try {
    // Close any existing active poll first
    await prisma.lecturePoll.updateMany({ where: { sessionId: req.params.id, isActive: true }, data: { isActive: false } });
    const poll = await prisma.lecturePoll.create({
      data: { sessionId: req.params.id, question, optionsJson: JSON.stringify(options) },
    });
    return res.status(201).json(poll);
  } catch (e) {
    return res.status(500).json({ error: "Failed to create poll" });
  }
});

// Close active poll
app.delete("/api/lectures/:id/poll", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    await prisma.lecturePoll.updateMany({ where: { sessionId: req.params.id, isActive: true }, data: { isActive: false } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to close poll" });
  }
});

// Student responds to poll
app.post("/api/lectures/:id/poll/:pollId/respond", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: "Answer required" });
  try {
    await prisma.pollResponse.upsert({
      where: { pollId_studentId: { pollId: req.params.pollId, studentId: req.user.id } },
      update: { answer, respondedAt: new Date() },
      create: { pollId: req.params.pollId, studentId: req.user.id, studentName: req.user.fullName ?? req.user.name ?? "Student", answer },
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to record poll response" });
  }
});

// Advance slide (lecturer)
app.post("/api/lectures/:id/slide", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { slide } = req.body;
  if (slide === undefined) return res.status(400).json({ error: "Slide index required" });
  try {
    const updated = await prisma.lectureSession.update({ where: { id: req.params.id }, data: { currentSlide: Number(slide) } });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: "Failed to update slide" });
  }
});

// Upload file attachment
app.post("/api/lectures/:id/attachment", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!req.file) return res.status(400).json({ error: "File required" });
  try {
    const b64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;
    await prisma.lectureSession.update({
      where: { id: req.params.id },
      data: { attachmentName: req.file.originalname, attachmentData: dataUrl },
    });
    return res.json({ ok: true, name: req.file.originalname });
  } catch (e) {
    return res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// Upload PPTX and convert slides to content
async function extractPptxSlides(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0");
      return na - nb;
    });
  const slides: string[] = [];
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("string");
    const texts: string[] = [];
    for (const m of xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gs)) {
      const t = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      if (t) texts.push(t);
    }
    if (texts.length > 0) slides.push(texts.join("\n"));
  }
  return slides;
}

app.post("/api/lectures/:id/pptx", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!req.file) return res.status(400).json({ error: "File required" });
  try {
    const slides = await extractPptxSlides(req.file.buffer);
    if (slides.length === 0) return res.status(400).json({ error: "No slide content found in file" });
    const content = slides.join("\n\n---\n\n");
    const updated = await prisma.lectureSession.update({
      where: { id: req.params.id },
      data: { content, currentSlide: 0 },
    });
    return res.json({ ok: true, slideCount: slides.length, session: updated });
  } catch (e: any) {
    console.error("PPTX parse error:", e);
    return res.status(500).json({ error: "Failed to parse PPTX file" });
  }
});

// AI summary of ended session
app.post("/api/lectures/:id/summarize", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!process.env.NVIDIA_API_KEY) return res.status(400).json({ error: "NVIDIA_API_KEY not configured" });
  try {
    const session = await prisma.lectureSession.findUnique({
      where: { id: req.params.id },
      include: { chats: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const chatLog = session.chats.map((c: any) => `[${c.senderRole}] ${c.senderName}: ${c.message}`).join("\n");
    const nvidia = getNvidiaClient();
    const resp = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{
        role: "user",
        content: `You are an academic assistant. Summarize the following live lecture session concisely in 3–5 bullet points covering the main topics taught and key discussion points from the chat.\n\nLECTURE TOPIC: ${session.topic}\n\nCONTENT:\n${session.content}\n\nCHAT LOG:\n${chatLog || "(no chat messages)"}\n\nProvide a clean, readable summary.`,
      }],
      temperature: 0.3,
      max_tokens: 600,
    });
    const summary = resp.choices[0]?.message?.content ?? "Summary unavailable.";
    await prisma.lectureSession.update({ where: { id: req.params.id }, data: { aiSummary: summary } });
    return res.json({ summary });
  } catch (e: any) {
    console.error("Summarize error:", e);
    return res.status(500).json({ error: "Failed to generate summary" });
  }
});

// -------------------------------------------------------------
// MANUAL SCORE ADJUSTMENT & MARKING API
// -------------------------------------------------------------
app.patch("/api/attempts/:id/score", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only lecturers can adjust or mark student grades." });
  }
  const { id } = req.params;
  const { score } = req.body;

  if (score === undefined || score === null) {
    return res.status(400).json({ error: "Score is required." });
  }

  try {
    const updated = await prisma.studentAttempt.update({
      where: { id },
      data: { score: parseFloat(score) },
    });
    return res.json(updated);
  } catch (error: any) {
    console.error("Error adjusting student score:", error);
    return res.status(500).json({ error: "Error adjusting student score." });
  }
});

// -------------------------------------------------------------
// EXAM API — doc upload, student submission, AI grading
// -------------------------------------------------------------

function getNvidiaClient() {
  return new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
}

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === "text/plain") {
    return file.buffer.toString("utf-8");
  }
  // .docx and .doc → mammoth
  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return result.value.trim();
}

async function gradeSubmission(
  questionsText: string,
  answerKeyText: string,
  studentAnswers: string,
  studentName: string
): Promise<{ score: number; feedback: string }> {
  const nvidia = getNvidiaClient();

  const prompt = `You are a fair and thorough academic exam grader.

EXAM QUESTIONS:
${questionsText}

MODEL ANSWER KEY:
${answerKeyText}

STUDENT NAME: ${studentName}
STUDENT'S ANSWERS:
${studentAnswers}

Grade this student's answers against the model answer key. Evaluate semantic similarity, not just exact wording.

SCORING CRITERIA:
- 90–100: Correct or essentially correct (minor wording differences allowed)
- 70–89: Shows clear understanding, mostly correct or logically equivalent
- 50–69: Genuine attempt, answer is relevant and shows partial understanding
- 0–49: No meaningful attempt, completely wrong, irrelevant, or left blank

IMPORTANT: If a student's answer shows genuine effort and captures at least 50% of the correct meaning, they pass. Award partial credit generously for effort and relevant content. Only fail a student if they clearly did not try or gave a completely irrelevant answer.

Respond with ONLY a valid JSON object, no other text:
{"score": <0-100>, "feedback": "<2-4 sentences of specific, constructive feedback mentioning what they got right and what needs improvement>"}`;

  const response = await nvidia.chat.completions.create({
    model: "meta/llama-3.1-70b-instruct",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content ?? '{"score":0,"feedback":"Grading failed."}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? raw);
  return { score: Math.max(0, Math.min(100, Number(parsed.score))), feedback: String(parsed.feedback) };
}

// Create exam (lecturer uploads questions doc)
app.post("/api/exams", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { title, courseId } = req.body;
  if (!title || !courseId) return res.status(400).json({ error: "Title and courseId are required" });
  if (!req.file && !req.body.questionsText) return res.status(400).json({ error: "Questions file or text is required" });

  try {
    const questionsText = req.file ? await extractTextFromFile(req.file) : req.body.questionsText;
    const exam = await prisma.exam.create({ data: { title, courseId, questionsText } });
    return res.status(201).json(exam);
  } catch (err) {
    console.error("Error creating exam:", err);
    return res.status(500).json({ error: "Failed to create exam" });
  }
});

// List exams for a course
app.get("/api/exams", authenticateToken, async (req: any, res) => {
  const { courseId } = req.query;
  try {
    const exams = await prisma.exam.findMany({
      where: courseId ? { courseId: String(courseId) } : undefined,
      include: { course: { select: { code: true, title: true } }, _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(exams);
  } catch (err) {
    console.error("Error fetching exams:", err);
    return res.status(500).json({ error: "Failed to fetch exams" });
  }
});

// Get single exam (questions visible to all enrolled; answer key only to lecturer)
app.get("/api/exams/:id", authenticateToken, async (req: any, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { code: true, title: true, lecturerId: true } } },
    });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    // Hide answer key from students
    if (req.user.role === "student") {
      const { answerKeyText: _omit, ...safe } = exam as any;
      return res.json(safe);
    }
    return res.json(exam);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch exam" });
  }
});

// Upload answer key (lecturer only)
app.post("/api/exams/:id/answer-key", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const answerKeyText = req.file ? await extractTextFromFile(req.file) : req.body.answerKeyText;
    if (!answerKeyText) return res.status(400).json({ error: "Answer key file or text required" });
    const exam = await prisma.exam.update({ where: { id: req.params.id }, data: { answerKeyText } });
    return res.json(exam);
  } catch (err) {
    console.error("Error uploading answer key:", err);
    return res.status(500).json({ error: "Failed to upload answer key" });
  }
});

// Close / reopen exam
app.post("/api/exams/:id/toggle", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    const updated = await prisma.exam.update({ where: { id: req.params.id }, data: { isOpen: !exam.isOpen } });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle exam" });
  }
});

// Student submits answers
app.post("/api/exams/:id/submit", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  const { answersText } = req.body;
  if (!answersText?.trim()) return res.status(400).json({ error: "Answers cannot be empty" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (!exam.isOpen) return res.status(400).json({ error: "This exam is closed for submissions" });

    const existing = await prisma.examSubmission.findFirst({
      where: { examId: req.params.id, studentId: req.user.id },
    });
    if (existing) return res.status(400).json({ error: "You have already submitted this exam" });

    const submission = await prisma.examSubmission.create({
      data: { examId: req.params.id, studentId: req.user.id, answersText },
    });
    return res.status(201).json(submission);
  } catch (err) {
    console.error("Error submitting exam:", err);
    return res.status(500).json({ error: "Failed to submit exam" });
  }
});

// Lecturer: view all submissions for an exam
app.get("/api/exams/:id/submissions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const submissions = await prisma.examSubmission.findMany({
      where: { examId: req.params.id },
      include: { student: { select: { fullName: true, regNumber: true, department: true } } },
      orderBy: { submittedAt: "asc" },
    });
    return res.json(submissions);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// Student: view own submission result
app.get("/api/exams/:id/my-submission", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  try {
    const submission = await prisma.examSubmission.findFirst({
      where: { examId: req.params.id, studentId: req.user.id },
    });
    return res.json(submission ?? null);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch submission" });
  }
});

// Lecturer: grade all ungraded submissions with AI
app.post("/api/exams/:id/grade", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { submissions: { include: { student: { select: { fullName: true } } } } },
    });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (!exam.answerKeyText) return res.status(400).json({ error: "Upload an answer key before grading" });
    if (!process.env.NVIDIA_API_KEY) return res.status(400).json({ error: "NVIDIA_API_KEY not configured" });

    const ungraded = exam.submissions.filter((s) => !s.isGraded);
    if (ungraded.length === 0) return res.json({ graded: 0, message: "All submissions already graded" });

    const results = [];
    for (const submission of ungraded) {
      try {
        const { score, feedback } = await gradeSubmission(
          exam.questionsText,
          exam.answerKeyText,
          submission.answersText,
          (submission as any).student.fullName
        );
        await prisma.examSubmission.update({
          where: { id: submission.id },
          data: { score, feedback, isGraded: true },
        });
        results.push({ studentId: submission.studentId, score });
      } catch (err) {
        console.error(`Failed to grade submission ${submission.id}:`, err);
        results.push({ studentId: submission.studentId, error: "Grading failed" });
      }
    }
    return res.json({ graded: results.filter((r) => !r.error).length, results });
  } catch (err) {
    console.error("Error grading exam:", err);
    return res.status(500).json({ error: "Failed to grade exam" });
  }
});

// Delete exam
app.delete("/api/exams/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    await prisma.exam.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete exam" });
  }
});

// -------------------------------------------------------------
// USER AVATAR / PROFILE PHOTO API
// -------------------------------------------------------------
// AVATAR — stored in DB (Turso), not filesystem (read-only on Vercel)
// -------------------------------------------------------------

// Save Avatar Base64
app.post("/api/user/avatar", authenticateToken, async (req: any, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: "Avatar base64 data is required." });

  try {
    const { role, id } = req.user;
    if (role === "lecturer") {
      await prisma.lecturer.update({ where: { id }, data: { avatarData: avatar } });
    } else {
      await prisma.student.update({ where: { id }, data: { avatarData: avatar } });
    }
    return res.json({ success: true, avatar });
  } catch (err: any) {
    console.error("Error saving avatar:", err);
    return res.status(500).json({ error: "Failed to save avatar" });
  }
});

// Fetch Avatar Base64
app.get("/api/user/avatar/:role/:id", async (req, res) => {
  const { role, id } = req.params;
  try {
    let avatar = "";
    if (role === "lecturer") {
      const row = await prisma.lecturer.findUnique({ where: { id }, select: { avatarData: true } });
      avatar = row?.avatarData ?? "";
    } else {
      const row = await prisma.student.findUnique({ where: { id }, select: { avatarData: true } });
      avatar = row?.avatarData ?? "";
    }
    return res.json({ avatar });
  } catch (err) {
    console.error("Error fetching avatar:", err);
    return res.status(500).json({ error: "Failed to fetch avatar" });
  }
});

// -------------------------------------------------------------
// SERVER AND VITE DEV SETUP
// -------------------------------------------------------------
async function startServer() {
  // Pre-seed Database
  await seedDatabase();

  // Vite development middleware vs Static Production bundle
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

// Global JSON error handler — 4-param signature required for Express error middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
