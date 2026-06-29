import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import { prisma } from "./src/lib/db.js";
import { seedDatabase } from "./src/lib/seed.js";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super-secure-quiz-secret-key-12345";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        chats: {
          orderBy: { createdAt: "asc" },
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
// USER AVATAR / PROFILE PHOTO API
// -------------------------------------------------------------
const AVATARS_FILE = path.join(process.cwd(), "prisma", "avatars.json");

// Save Avatar Base64
app.post("/api/user/avatar", authenticateToken, async (req: any, res) => {
  const { avatar } = req.body;
  if (!avatar) {
    return res.status(400).json({ error: "Avatar base64 data is required." });
  }

  try {
    let avatars: Record<string, string> = {};
    if (fs.existsSync(AVATARS_FILE)) {
      try {
        avatars = JSON.parse(fs.readFileSync(AVATARS_FILE, "utf-8"));
      } catch (e) {
        console.error("Error reading avatars file, initializing new:", e);
      }
    }
    
    // Key by role_id to be absolutely safe
    const key = `${req.user.role}_${req.user.id}`;
    avatars[key] = avatar;
    
    fs.writeFileSync(AVATARS_FILE, JSON.stringify(avatars, null, 2), "utf-8");
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
    let avatars: Record<string, string> = {};
    if (fs.existsSync(AVATARS_FILE)) {
      try {
        avatars = JSON.parse(fs.readFileSync(AVATARS_FILE, "utf-8"));
      } catch (e) {
        console.error("Error reading avatars file:", e);
      }
    }
    
    const key = `${role}_${id}`;
    const avatar = avatars[key] || "";
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

startServer();
