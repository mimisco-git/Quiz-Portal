import express from "express";
import Ably from "ably";
import cors from "cors";
import path from "path";
import fs from "fs";
// vite is imported dynamically inside startServer() so it's excluded from the Vercel Lambda bundle
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import mammoth from "mammoth";
import JSZip from "jszip";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import webpush from "web-push";
import { prisma } from "./src/lib/db.js";
import { seedDatabase } from "./src/lib/seed.js";

// ── Web Push (VAPID) setup — graceful no-op if keys not configured ──
const PUSH_ENABLED = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@quizportal.app"}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

async function sendPushToAll(role: "student" | "lecturer" | "all", title: string, body: string, url = "/") {
  if (!PUSH_ENABLED) return;
  const where = role === "all" ? {} : { userRole: role };
  const subs = await prisma.pushSubscription.findMany({ where });
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}

// In-memory grading job tracker — keyed by "exam_<id>" or "assignment_<id>"
const gradingJobs = new Map<string, { total: number; done: number; errors: number; inProgress: boolean }>();

// Returns all department names a student has access to (primary + additional)
async function getStudentDepts(studentId: string): Promise<string[]> {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { department: true, additionalDepartments: true } });
  if (!s) return [];
  try { return [s.department, ...JSON.parse(s.additionalDepartments || "[]")]; }
  catch { return [s.department]; }
}

// Returns dept list + year for building combined course/exam/assignment filters
async function getStudentFilter(studentId: string): Promise<{ depts: string[]; year: string }> {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { department: true, additionalDepartments: true, year: true } });
  if (!s) return { depts: [], year: "" };
  try { return { depts: [s.department, ...JSON.parse(s.additionalDepartments || "[]")], year: s.year }; }
  catch { return { depts: [s.department], year: s.year }; }
}

const app = express();
const PORT = 3000;
const ablyRest = process.env.ABLY_API_KEY ? new Ably.Rest(process.env.ABLY_API_KEY) : null;

// Explicit CORS policy — restricts cross-origin requests to the configured frontend origin
app.use(cors({ origin: process.env.FRONTEND_URL ?? true, credentials: true }));

if (!process.env.JWT_SECRET) {
  console.warn("[WARN] JWT_SECRET env var is not set. Set it in Vercel → Settings → Environment Variables for production security.");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-fallback-never-use-in-production";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Catch body-parser parse errors (malformed JSON) before they reach the global handler
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  next(err);
});

// ── Rate limiters ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please wait 15 minutes before trying again." },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait 1 hour before trying again." },
});

// ── Per-reg-number failed-login tracker (5 failures per 10 min) ──
const failedLogins = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED = 5;
const FAILED_WINDOW_MS = 10 * 60 * 1000;

function isLoginBlocked(reg: string): boolean {
  const entry = failedLogins.get(reg);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= MAX_FAILED;
}
function recordFailedLogin(reg: string): void {
  const now = Date.now();
  const entry = failedLogins.get(reg);
  if (!entry || now > entry.resetAt) {
    failedLogins.set(reg, { count: 1, resetAt: now + FAILED_WINDOW_MS });
  } else {
    entry.count++;
  }
}
function clearFailedLogin(reg: string): void {
  failedLogins.delete(reg);
}

// ── Input length constants ─────────────────────────────────────
const MAX_NAME   = 120;
const MAX_EMAIL  = 254;
const MAX_REG    = 30;
const MAX_DEPT   = 100;
const MAX_YEAR   = 30;
const MAX_STR    = 500;
const MAX_ANSWER = 10_000;  // exam text answers
const MAX_AVATAR = 1_500_000; // ~1 MB base64 (~750 KB actual image)

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
    // Block all endpoints for accounts that must change their password,
    // except the change-password endpoint itself (flagged via req._allowMustChange).
    if (user.mustChangePassword && !req._allowMustChange) {
      return res.status(403).json({
        error: "Password change required. Please set a new password to continue.",
        mustChangePassword: true,
      });
    }
    req.user = user;
    next();
  });
}

// Like authenticateToken but never blocks — sets req.user if token valid, otherwise continues as unauthenticated
function optionalAuth(req: any, _res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* ignore */ }
  }
  next();
}

// -------------------------------------------------------------
// AUTHENTICATION API
// -------------------------------------------------------------

// Student Registration Route
app.post("/api/auth/student-register", authLimiter, async (req, res) => {
  const { fullName, email, regNumber, department, year, password, securityQuestion, securityAnswer } = req.body;

  if (!fullName || !email || !regNumber || !department || !year || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: "All registration fields are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: "Password is too long." });
  }
  if (fullName.length > MAX_NAME || email.length > MAX_EMAIL || regNumber.length > MAX_REG ||
      department.length > MAX_DEPT || year.length > MAX_YEAR ||
      securityQuestion.length > MAX_STR || securityAnswer.length > MAX_STR) {
    return res.status(400).json({ error: "One or more fields exceed the maximum allowed length." });
  }

  try {
    const normalizedReg = regNumber.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingReg = await prisma.student.findUnique({ where: { regNumber: normalizedReg } });
    if (existingReg) {
      return res.status(400).json({ error: "This Registration Number is already registered." });
    }
    const existingEmail = await prisma.student.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
      return res.status(400).json({ error: "This email address is already in use." });
    }

    const [passwordHash, hashedAnswer] = await Promise.all([
      bcrypt.hash(password, 12),
      bcrypt.hash(securityAnswer.trim().toLowerCase(), 10),
    ]);

    const student = await prisma.student.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        regNumber: normalizedReg,
        passwordHash,
        department: department.trim(),
        year: year.trim(),
        securityQuestion: securityQuestion.trim(),
        securityAnswer: hashedAnswer,
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
        mustChangePassword: false,
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
        mustChangePassword: false,
      },
    });
  } catch (error: any) {
    console.error("Student registration error:", error);
    return res.status(500).json({ error: "Failed to register student. Please try again." });
  }
});

// Student Login — registration number + password only
app.post("/api/auth/student-login", authLimiter, async (req, res) => {
  const { regNumber, password } = req.body;

  if (!regNumber) return res.status(400).json({ error: "Registration Number is required." });
  if (!password)  return res.status(400).json({ error: "Password is required." });

  try {
    const normalizedReg = regNumber.trim().toUpperCase();

    // Per-registration-number rate limit: 5 failures per 10 minutes
    if (isLoginBlocked(normalizedReg)) {
      return res.status(429).json({ error: "Too many failed attempts. Please wait 10 minutes before trying again." });
    }

    const student = await prisma.student.findUnique({ where: { regNumber: normalizedReg } });

    if (!student) {
      recordFailedLogin(normalizedReg);
      return res.status(401).json({ error: "Invalid registration number or password." });
    }

    if (!student.passwordHash) {
      // Account exists but was never given a password — treat as invalid credentials
      recordFailedLogin(normalizedReg);
      return res.status(401).json({ error: "Invalid registration number or password." });
    }

    const valid = await bcrypt.compare(password, student.passwordHash);
    if (!valid) {
      recordFailedLogin(normalizedReg);
      return res.status(401).json({ error: "Invalid registration number or password." });
    }

    clearFailedLogin(normalizedReg);

    const token = jwt.sign(
      {
        id: student.id,
        fullName: student.fullName,
        regNumber: student.regNumber,
        department: student.department,
        year: student.year,
        role: "student",
        mustChangePassword: student.mustChangePassword,
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
        mustChangePassword: student.mustChangePassword,
      },
    });
  } catch (error: any) {
    console.error("Student login error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// First-time password setup for unmigrated (legacy) student accounts
// Identity is verified with their old year credential before allowing password to be set
app.post("/api/auth/student-migrate", authLimiter, async (req, res) => {
  const { regNumber, year, password } = req.body;

  if (!regNumber || !year || !password) {
    return res.status(400).json({ error: "Registration Number, Year of Study, and new Password are all required." });
  }
  if (password.length < 8)   return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (password.length > 128) return res.status(400).json({ error: "Password is too long." });

  try {
    const normalizedReg = regNumber.trim().toUpperCase();

    const student = await prisma.student.findUnique({ where: { regNumber: normalizedReg } });
    if (!student) return res.status(404).json({ error: "Registration Number not found." });

    if (student.passwordHash !== null) {
      return res.status(400).json({ error: "This account already has a password. Please sign in normally." });
    }

    // Use their old year credential as identity verification
    if (student.year.toLowerCase().trim() !== year.toLowerCase().trim()) {
      return res.status(401).json({ error: "Year of Study does not match our records. Please check and try again." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await prisma.student.update({ where: { id: student.id }, data: { passwordHash } });

    const token = jwt.sign(
      { id: updated.id, fullName: updated.fullName, regNumber: updated.regNumber, department: updated.department, year: updated.year, role: "student" },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.json({
      token,
      user: { id: updated.id, fullName: updated.fullName, regNumber: updated.regNumber, department: updated.department, year: updated.year, role: "student" },
    });
  } catch (error: any) {
    console.error("Student migrate error:", error);
    return res.status(500).json({ error: "Password setup failed. Please try again." });
  }
});

// Forced password change — requires a valid token (even mustChangePassword=true).
// The _allowMustChange flag on the request bypasses the authenticateToken guard.
app.post(
  "/api/auth/student-change-password",
  authLimiter,
  (req: any, _res: any, next: any) => { req._allowMustChange = true; next(); },
  authenticateToken,
  async (req: any, res: any) => {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: "New password and confirmation are required." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ error: "Password is too long." });
    }

    try {
      const student = await prisma.student.findUnique({ where: { id: req.user.id } });
      if (!student) return res.status(404).json({ error: "Student account not found." });

      // Disallow using the registration number as a password
      if (newPassword.toUpperCase() === student.regNumber.toUpperCase()) {
        return res.status(400).json({ error: "Your password cannot be the same as your registration number." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      const updated = await prisma.student.update({
        where: { id: student.id },
        data:  { passwordHash, mustChangePassword: false },
      });

      clearFailedLogin(updated.regNumber);

      const token = jwt.sign(
        {
          id: updated.id,
          fullName: updated.fullName,
          regNumber: updated.regNumber,
          department: updated.department,
          year: updated.year,
          role: "student",
          mustChangePassword: false,
        },
        JWT_SECRET,
        { expiresIn: "4h" }
      );

      return res.json({
        token,
        user: {
          id: updated.id,
          fullName: updated.fullName,
          regNumber: updated.regNumber,
          department: updated.department,
          year: updated.year,
          role: "student",
          mustChangePassword: false,
        },
      });
    } catch (error: any) {
      console.error("Student change-password error:", error);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// Get student's security question
app.post("/api/auth/student-get-security-question", strictLimiter, async (req, res) => {
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

// Forgot password — verify security answer and set a new password
app.post("/api/auth/student-forgot-password", strictLimiter, async (req, res) => {
  const { regNumber, securityAnswer, newPassword, confirmPassword } = req.body;
  if (!regNumber || !securityAnswer || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  if (newPassword.length < 8)   return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (newPassword.length > 128) return res.status(400).json({ error: "Password is too long." });

  try {
    const normalizedReg = regNumber.trim().toUpperCase();
    if (newPassword.toUpperCase() === normalizedReg) {
      return res.status(400).json({ error: "Your password cannot be the same as your registration number." });
    }

    const student = await prisma.student.findUnique({ where: { regNumber: normalizedReg } });
    if (!student) {
      return res.status(400).json({ error: "Incorrect registration number or security answer." });
    }

    const normalizedInput = securityAnswer.trim().toLowerCase();
    let answerMatches = false;
    if (student.securityAnswer.startsWith("$2")) {
      answerMatches = await bcrypt.compare(normalizedInput, student.securityAnswer);
    } else {
      answerMatches = student.securityAnswer.toLowerCase().trim() === normalizedInput;
      if (answerMatches) {
        const hashed = await bcrypt.hash(normalizedInput, 10);
        await prisma.student.update({ where: { id: student.id }, data: { securityAnswer: hashed } });
      }
    }

    if (!answerMatches) {
      return res.status(400).json({ error: "Incorrect registration number or security answer." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash, mustChangePassword: false },
    });
    clearFailedLogin(updated.regNumber);

    const token = jwt.sign(
      { id: updated.id, fullName: updated.fullName, regNumber: updated.regNumber, department: updated.department, year: updated.year, role: "student", mustChangePassword: false },
      JWT_SECRET,
      { expiresIn: "4h" }
    );
    return res.json({
      token,
      user: { id: updated.id, fullName: updated.fullName, regNumber: updated.regNumber, department: updated.department, year: updated.year, role: "student", mustChangePassword: false },
    });
  } catch (error: any) {
    console.error("Student forgot-password error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Answer security question and fix/update year
app.post("/api/auth/student-fix-year", strictLimiter, async (req, res) => {
  const { regNumber, securityAnswer, newYear } = req.body;

  if (!regNumber || !securityAnswer || !newYear) {
    return res.status(400).json({ error: "Registration Number, security answer, and target Year of Study are required." });
  }
  if (regNumber.length > MAX_REG || securityAnswer.length > MAX_STR || newYear.length > MAX_YEAR) {
    return res.status(400).json({ error: "One or more fields exceed the maximum allowed length." });
  }

  try {
    const normalizedReg = regNumber.trim().toUpperCase();
    const student = await prisma.student.findUnique({
      where: { regNumber: normalizedReg },
    });

    if (!student) {
      // Return a generic message to prevent account enumeration
      return res.status(400).json({ error: "Incorrect registration number or security answer." });
    }

    // Compare security answers — support both bcrypt hashes and legacy plaintext (auto-upgrade)
    const normalizedInput = securityAnswer.trim().toLowerCase();
    let answerMatches = false;
    if (student.securityAnswer.startsWith("$2")) {
      answerMatches = await bcrypt.compare(normalizedInput, student.securityAnswer);
    } else {
      // Legacy plaintext — compare and upgrade on success
      answerMatches = student.securityAnswer.toLowerCase().trim() === normalizedInput;
      if (answerMatches) {
        const hashed = await bcrypt.hash(normalizedInput, 10);
        await prisma.student.update({ where: { id: student.id }, data: { securityAnswer: hashed } });
      }
    }

    if (!answerMatches) {
      return res.status(400).json({ error: "Incorrect registration number or security answer." });
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
app.post("/api/auth/lecturer-register", authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (name.length > MAX_NAME || email.length > MAX_EMAIL || password.length > 128) {
    return res.status(400).json({ error: "One or more fields exceed the maximum allowed length." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const existingLecturer = await prisma.lecturer.findUnique({ where: { email: normalizedEmail } });
    if (existingLecturer) {
      return res.status(400).json({ error: "This email address is already registered as a lecturer." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const lecturer = await prisma.lecturer.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
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
app.post("/api/auth/lecturer-login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password are required." });
  }

  try {
    const lecturer = await prisma.lecturer.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Support both bcrypt hashes and legacy plaintext (auto-upgrade on login)
    let passwordMatches = false;
    if (lecturer) {
      if (lecturer.password.startsWith("$2")) {
        passwordMatches = await bcrypt.compare(password, lecturer.password);
      } else {
        passwordMatches = lecturer.password === password;
        if (passwordMatches) {
          const hashed = await bcrypt.hash(password, 10);
          await prisma.lecturer.update({ where: { id: lecturer.id }, data: { password: hashed } });
        }
      }
    }

    if (!lecturer || !passwordMatches) {
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
// PUBLIC METADATA (no auth — safe preview data only)
// -------------------------------------------------------------

app.get("/api/public/quiz/:id", async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      select: { title: true, durationMinutes: true, availableFrom: true, availableUntil: true, course: { select: { code: true, title: true } }, _count: { select: { questions: true } } },
    });
    if (!quiz) return res.status(404).json({ error: "Not found" });
    return res.json({ title: quiz.title, durationMinutes: quiz.durationMinutes, availableFrom: quiz.availableFrom, availableUntil: quiz.availableUntil, course: quiz.course, questionCount: quiz._count.questions });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/api/public/note/:id", async (req, res) => {
  try {
    const note = await prisma.lectureNote.findUnique({
      where: { id: req.params.id },
      select: { title: true, createdAt: true, course: { select: { code: true, title: true } } },
    });
    if (!note) return res.status(404).json({ error: "Not found" });
    return res.json({ title: note.title, createdAt: note.createdAt, course: note.course });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/api/public/exam/:id", async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      select: { title: true, isOpen: true, availableFrom: true, availableUntil: true, course: { select: { code: true, title: true } } },
    });
    if (!exam) return res.status(404).json({ error: "Not found" });
    return res.json({ title: exam.title, isOpen: exam.isOpen, availableFrom: exam.availableFrom, availableUntil: exam.availableUntil, course: exam.course });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/api/public/assignment/:id", async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      select: { title: true, dueDate: true, isOpen: true, course: { select: { code: true, title: true } } },
    });
    if (!assignment) return res.status(404).json({ error: "Not found" });
    return res.json({ title: assignment.title, dueDate: assignment.dueDate, isOpen: assignment.isOpen, course: assignment.course });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/api/public/live/:id", async (req, res) => {
  try {
    const session = await prisma.lectureSession.findUnique({
      where: { id: req.params.id },
      select: { topic: true, isActive: true, courseId: true, course: { select: { code: true, title: true } } },
    });
    if (!session) return res.status(404).json({ error: "Not found" });
    return res.json({ topic: session.topic, isActive: session.isActive, courseId: session.courseId, course: session.course });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

// -------------------------------------------------------------
// COURSE & NOTE PLATFORM API
// -------------------------------------------------------------

// Fetch all courses with basic info
app.get("/api/courses", optionalAuth, async (req: any, res) => {
  try {
    // Students only see courses matching their department(s) AND year level (or null = all)
    let where: any = {};
    if (req.user?.role === "student") {
      const { depts, year } = await getStudentFilter(req.user.id);
      where = {
        AND: [
          { OR: [{ departmentId: null }, { department: { name: { in: depts } } }] },
          { OR: [{ targetYear: null }, { targetYear: year }] },
        ],
      };
    }
    const courses = await prisma.course.findMany({
      where,
      include: {
        lecturer: { select: { name: true, email: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { notes: true, quizzes: true } },
      },
    });
    return res.json(courses);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({ error: "Error fetching courses" });
  }
});

// Fetch detailed course view with its notes and quizzes
app.get("/api/courses/:id", authenticateToken, async (req: any, res) => {
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
app.get("/api/notes", authenticateToken, async (req: any, res) => {
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

  const { code, title, departmentId, targetYear } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Course code and title are required" });
  }

  try {
    const newCourse = await prisma.course.create({
      data: {
        code: code.toUpperCase().replace(/\s+/g, ""),
        title,
        lecturerId: req.user.id,
        ...(departmentId ? { departmentId } : {}),
        ...(targetYear ? { targetYear } : {}),
      },
      include: { department: { select: { id: true, name: true } } },
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

// Parse DOCX → HTML (lecturer only) — client converts HTML→Markdown with turndown
app.post("/api/notes/parse-docx", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const docxMimes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
  if (!docxMimes.includes(req.file.mimetype)) return res.status(400).json({ error: "Only .docx / .doc files are accepted." });
  try {
    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    return res.json({ html: result.value });
  } catch {
    return res.status(500).json({ error: "Failed to parse document" });
  }
});

// Create Quiz (Lecturer Only)
app.post("/api/quizzes", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") {
    return res.status(403).json({ error: "Only Lecturers can perform this action" });
  }

  const { title, durationMinutes, courseId, questions, availableFrom, availableUntil } = req.body;
  if (!title || !durationMinutes || !courseId || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing required fields or invalid format." });
  }

  try {
    const quiz = await prisma.quiz.create({
      data: {
        title,
        durationMinutes: parseInt(durationMinutes, 10),
        courseId,
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        availableUntil: availableUntil ? new Date(availableUntil) : undefined,
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

    sendPushToAll("student", "New Quiz Available", `A new quiz "${quiz.title}" has been posted. Open the app to take it.`, "/").catch(() => {});
    return res.status(201).json(quiz);
  } catch (error: any) {
    console.error("Error creating quiz:", error);
    return res.status(500).json({ error: "Error creating quiz" });
  }
});

// Parse MCQ questions from an uploaded Word document using AI
app.post("/api/quizzes/parse-questions", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const text = await extractTextFromFile(req.file);
    if (!text.trim()) return res.status(400).json({ error: "Could not extract text from document" });

    const nvidia = getNvidiaClient();
    const prompt = `You are an expert MCQ question parser. Extract ALL multiple-choice questions from the text and return a JSON array.

OPTION PREFIX STRIPPING — remove ANY of these label styles from the start of each option, then store only the content:
  Uppercase:  A.  B.  C.  D.   |  A)  B)  C)  D)   |  (A)  (B)  (C)  (D)   |  A:  B:  C:  D:   |  [A]  [B]  [C]  [D]
  Lowercase:  a.  b.  c.  d.   |  a)  b)  c)  d)   |  (a)  (b)  (c)  (d)   |  a:  b:  c:  d:   |  [a]  [b]  [c]  [d]
  Roman:      i.  ii.  iii.  iv.  (treat as options 1-4 in order)
  Numeric:    1.  2.  3.  4.   |  1)  2)  3)  4)    (when used as option labels, not question numbers)

CORRECT ANSWER DETECTION — detect the answer from ANY of these patterns (case-insensitive):
  - "Answer: A"  /  "Answer: a"  /  "Ans: B"  /  "ANS: C"  /  "Correct: d"  /  "Key: A"
  - "The answer is A"  /  "The correct answer is b"  /  "Answer = C"
  - A lone letter (A/B/C/D or a/b/c/d) on its own line immediately after the options
  - An asterisk (*) before or after an option label, e.g. "*A." or "A*" — that option is correct
  - The word "ANSWER" or "ANS" followed by any separator then a letter

RULES:
- Each question needs exactly 4 options. If a question has more or fewer, do your best.
- "correctOption" must EXACTLY match one of the cleaned strings in the "options" array.
- If no answer can be detected, choose the most plausible option.
- Ignore page headers, footers, course codes, and instructor names.
- Return ONLY a valid JSON array — no markdown, no explanation, no extra text.

FORMAT:
[{"text":"...","options":["...","...","...","..."],"correctOption":"..."}]

EXAMPLES:

Input style 1 (lowercase dot):
1. What is H2O?
a. Carbon dioxide  b. Water  c. Oxygen  d. Hydrogen
Answer: b

Input style 2 (uppercase paren, asterisk):
2. The CPU stands for?
*A) Central Processing Unit
B) Computer Power Unit
C) Core Processing Unit
D) Central Power Utility
(no answer line — asterisk marks correct)

Both produce the same JSON shape with cleaned option text and matching correctOption.

TEXT TO PARSE:
${text.slice(0, 12000)}`;

    const response = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(422).json({ error: "AI could not parse questions from this document. Check the format and try again." });

    const parsed: { text: string; options: string[]; correctOption: string }[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(422).json({ error: "No questions found in document." });
    }

    return res.json({ questions: parsed, count: parsed.length });
  } catch (err: any) {
    console.error("Error parsing quiz questions:", err);
    return res.status(500).json({ error: "Failed to parse questions from file." });
  }
});

// List quizzes for the authenticated lecturer's courses
app.get("/api/quizzes", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { course: { lecturerId: req.user.id } },
      include: {
        course: { select: { code: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: [{ course: { code: "asc" } }, { title: "asc" }],
    });
    return res.json(quizzes);
  } catch (err) {
    console.error("Error fetching quizzes:", err);
    return res.status(500).json({ error: "Failed to fetch quizzes" });
  }
});

// Delete a quiz (must own the course it belongs to)
app.delete("/api/quizzes/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    await prisma.quiz.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting quiz:", err);
    return res.status(500).json({ error: "Failed to delete quiz" });
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

    const now = new Date();
    if (quiz.availableFrom && now < quiz.availableFrom) {
      return res.status(400).json({ error: `This quiz is not yet open. It opens on ${quiz.availableFrom.toLocaleString()}.` });
    }
    if (quiz.availableUntil && now > quiz.availableUntil) {
      return res.status(400).json({ error: "This quiz has expired and is no longer available." });
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

    if (!attempt || attempt.studentId !== req.user.id) {
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

    // Ownership check — prevent IDOR
    if (attempt && attempt.studentId !== req.user.id) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

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

    // Update attempt — include violation count from client if provided
    const violationsFromClient = typeof req.body.violations === "number" ? Math.max(0, Math.min(req.body.violations, 100)) : undefined;
    const updatedAttempt = await prisma.studentAttempt.update({
      where: { id: attemptId },
      data: {
        isCompleted: true,
        submittedAt: now,
        score: timedOut ? Math.max(0, finalScore - 10) : finalScore, // minor penalty or lock score
        answersJson: JSON.stringify(submissionAnswers),
        ...(violationsFromClient !== undefined ? { violations: violationsFromClient } : {}),
      },
    });

    if (timedOut) {
      return res.status(408).json({
        error: "Exam duration limit exceeded. Session invalidated and score locked.",
        attempt: updatedAttempt,
        timedOut: true,
      });
    }

    const correctAnswers: Record<string, string> = {};
    questions.forEach((q) => {
      if (submissionAnswers[q.id]) { correctAnswers[q.id] = q.correctOption; }
    });

    return res.json({
      message: "Quiz submitted successfully",
      attempt: updatedAttempt,
      score: finalScore,
      correctAnswers,
      timedOut: false,
    });
  } catch (error: any) {
    console.error("Error submitting quiz:", error);
    return res.status(500).json({ error: "An error occurred during submission" });
  }
});

// -------------------------------------------------------------
// LECTURER PROFILE API
// -------------------------------------------------------------
app.get("/api/lecturer/profile", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Unauthorized" });
  try {
    const lecturer = await prisma.lecturer.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, departments: true } });
    if (!lecturer) return res.status(404).json({ error: "Not found" });
    let depts: string[] = [];
    try { depts = JSON.parse(lecturer.departments || "[]"); } catch { depts = []; }
    return res.json({ ...lecturer, departments: depts });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch lecturer profile" });
  }
});

app.patch("/api/lecturer/departments", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Unauthorized" });
  const { departments } = req.body;
  if (!Array.isArray(departments)) return res.status(400).json({ error: "departments must be an array" });
  try {
    await prisma.lecturer.update({ where: { id: req.user.id }, data: { departments: JSON.stringify(departments) } });
    return res.json({ departments });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update departments" });
  }
});

// -------------------------------------------------------------
// LECTURER GRADEBOOK / MONITORING API
// -------------------------------------------------------------
app.get("/api/lecturer/gradebook", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Unauthorized access" });
  try {
    const lecturerId = req.user.id;
    const [quizAttempts, examSubmissions, assignmentSubmissions, allExams, allAssignments] = await Promise.all([
      prisma.studentAttempt.findMany({
        where: { quiz: { course: { lecturerId } } },
        include: {
          student: { select: { id: true, fullName: true, regNumber: true, department: true, year: true } },
          quiz: { select: { id: true, title: true, courseId: true, course: { select: { code: true, title: true } } } },
        },
      }),
      prisma.examSubmission.findMany({
        where: { exam: { course: { lecturerId } } },
        include: {
          student: { select: { id: true, fullName: true, regNumber: true, department: true, year: true } },
          exam: { select: { id: true, title: true, courseId: true, course: { select: { code: true, title: true } } } },
        },
      }),
      prisma.assignmentSubmission.findMany({
        where: { assignment: { course: { lecturerId } } },
        include: {
          student: { select: { id: true, fullName: true, regNumber: true, department: true, year: true } },
          assignment: { select: { id: true, title: true, courseId: true, course: { select: { code: true, title: true } } } },
        },
      }),
      prisma.exam.findMany({
        where: { course: { lecturerId } },
        select: { id: true, title: true, courseId: true, course: { select: { code: true, title: true } } },
      }),
      prisma.assignment.findMany({
        where: { course: { lecturerId } },
        select: { id: true, title: true, courseId: true, course: { select: { code: true, title: true } } },
      }),
    ]);

    // Build per-course student roster from all submissions
    const courseRoster = new Map<string, Map<string, any>>();
    const addToRoster = (courseId: string, student: any) => {
      if (!courseRoster.has(courseId)) courseRoster.set(courseId, new Map());
      courseRoster.get(courseId)!.set(student.id, student);
    };
    for (const a of quizAttempts) addToRoster(a.quiz.courseId, a.student);
    for (const s of examSubmissions) addToRoster(s.exam.courseId, s.student);
    for (const s of assignmentSubmissions) addToRoster(s.assignment.courseId, s.student);

    const rows: any[] = [];

    // Quiz rows
    const quizMap = new Map<string, any>();
    for (const a of quizAttempts) {
      quizMap.set(a.quiz.id, a.quiz);
      rows.push({
        id: a.id, type: "quiz", studentId: a.student.id,
        studentName: a.student.fullName, regNumber: a.student.regNumber,
        department: a.student.department, year: a.student.year,
        courseId: a.quiz.courseId, courseCode: a.quiz.course.code, courseTitle: a.quiz.course.title,
        assessmentId: a.quiz.id, assessmentTitle: a.quiz.title,
        status: a.isCompleted ? "submitted" : "in_progress",
        score: a.score, totalMarks: null, isGraded: a.isCompleted && a.score !== null,
        submittedAt: a.submittedAt,
      });
    }
    // Not-submitted rows for quizzes
    for (const [quizId, quiz] of quizMap) {
      const submittedIds = new Set(quizAttempts.filter(a => a.quiz.id === quizId).map(a => a.student.id));
      for (const [studentId, student] of (courseRoster.get(quiz.courseId) || new Map())) {
        if (!submittedIds.has(studentId)) {
          rows.push({
            id: `ns_quiz_${quizId}_${studentId}`, type: "quiz", studentId,
            studentName: student.fullName, regNumber: student.regNumber,
            department: student.department, year: student.year,
            courseId: quiz.courseId, courseCode: quiz.course.code, courseTitle: quiz.course.title,
            assessmentId: quizId, assessmentTitle: quiz.title,
            status: "not_submitted", score: null, totalMarks: null, isGraded: false, submittedAt: null,
          });
        }
      }
    }

    // Exam rows
    for (const exam of allExams) {
      const submitted = examSubmissions.filter(s => s.exam.id === exam.id);
      const submittedIds = new Set(submitted.map(s => s.student.id));
      for (const s of submitted) {
        rows.push({
          id: s.id, type: "exam", studentId: s.student.id,
          studentName: s.student.fullName, regNumber: s.student.regNumber,
          department: s.student.department, year: s.student.year,
          courseId: exam.courseId, courseCode: exam.course.code, courseTitle: exam.course.title,
          assessmentId: exam.id, assessmentTitle: exam.title,
          status: "submitted", score: s.score, totalMarks: s.totalMarks,
          isGraded: s.isGraded, submittedAt: s.submittedAt,
        });
      }
      for (const [studentId, student] of (courseRoster.get(exam.courseId) || new Map())) {
        if (!submittedIds.has(studentId)) {
          rows.push({
            id: `ns_exam_${exam.id}_${studentId}`, type: "exam", studentId,
            studentName: student.fullName, regNumber: student.regNumber,
            department: student.department, year: student.year,
            courseId: exam.courseId, courseCode: exam.course.code, courseTitle: exam.course.title,
            assessmentId: exam.id, assessmentTitle: exam.title,
            status: "not_submitted", score: null, totalMarks: null, isGraded: false, submittedAt: null,
          });
        }
      }
    }

    // Assignment rows
    for (const assignment of allAssignments) {
      const submitted = assignmentSubmissions.filter(s => s.assignment.id === assignment.id);
      const submittedIds = new Set(submitted.map(s => s.student.id));
      for (const s of submitted) {
        rows.push({
          id: s.id, type: "assignment", studentId: s.student.id,
          studentName: s.student.fullName, regNumber: s.student.regNumber,
          department: s.student.department, year: s.student.year,
          courseId: assignment.courseId, courseCode: assignment.course.code, courseTitle: assignment.course.title,
          assessmentId: assignment.id, assessmentTitle: assignment.title,
          status: "submitted", score: s.score, totalMarks: s.totalMarks,
          isGraded: s.isGraded, submittedAt: s.submittedAt,
        });
      }
      for (const [studentId, student] of (courseRoster.get(assignment.courseId) || new Map())) {
        if (!submittedIds.has(studentId)) {
          rows.push({
            id: `ns_assignment_${assignment.id}_${studentId}`, type: "assignment", studentId,
            studentName: student.fullName, regNumber: student.regNumber,
            department: student.department, year: student.year,
            courseId: assignment.courseId, courseCode: assignment.course.code, courseTitle: assignment.course.title,
            assessmentId: assignment.id, assessmentTitle: assignment.title,
            status: "not_submitted", score: null, totalMarks: null, isGraded: false, submittedAt: null,
          });
        }
      }
    }

    rows.sort((a, b) => {
      const cc = a.courseCode.localeCompare(b.courseCode);
      if (cc !== 0) return cc;
      const at = a.assessmentTitle.localeCompare(b.assessmentTitle);
      if (at !== 0) return at;
      return a.studentName.localeCompare(b.studentName);
    });

    return res.json(rows);
  } catch (error: any) {
    console.error("Error fetching gradebook:", error);
    return res.status(500).json({ error: "Error fetching gradebook" });
  }
});

app.patch("/api/exam-submissions/:id/score", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { score } = req.body;
  if (score === undefined || score === null) return res.status(400).json({ error: "Score required" });
  try {
    const sub = await prisma.examSubmission.findUnique({
      where: { id: req.params.id },
      include: { exam: { select: { course: { select: { lecturerId: true } } } } },
    });
    if (!sub) return res.status(404).json({ error: "Submission not found" });
    if (sub.exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });
    await prisma.examSubmission.update({ where: { id: req.params.id }, data: { score: parseFloat(score), isGraded: true } });
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: "Failed to update score" }); }
});

app.patch("/api/assignment-submissions/:id/score", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { score } = req.body;
  if (score === undefined || score === null) return res.status(400).json({ error: "Score required" });
  try {
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { id: req.params.id },
      include: { assignment: { select: { course: { select: { lecturerId: true } } } } },
    });
    if (!sub) return res.status(404).json({ error: "Submission not found" });
    if (sub.assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });
    await prisma.assignmentSubmission.update({ where: { id: req.params.id }, data: { score: parseFloat(score), isGraded: true } });
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: "Failed to update score" }); }
});


// -------------------------------------------------------------
// DEPARTMENT MANAGEMENT API
// -------------------------------------------------------------
app.get("/api/departments/stats", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { courses: { select: { id: true } } },
    });

    const stats = await Promise.all(
      departments.map(async (dept) => {
        const studentCount = await prisma.student.count({ where: { department: dept.name } });

        const gradedExamSubs = await prisma.examSubmission.findMany({
          where: { isGraded: true, student: { department: dept.name } },
          select: { score: true, totalMarks: true },
        });
        const gradedAsgSubs = await prisma.assignmentSubmission.findMany({
          where: { isGraded: true, student: { department: dept.name } },
          select: { score: true, totalMarks: true },
        });

        const toPercent = (s: { score: number | null; totalMarks: number | null }) =>
          s.totalMarks ? ((s.score ?? 0) / s.totalMarks) * 100 : (s.score ?? 0);

        const allSubs = [...gradedExamSubs, ...gradedAsgSubs];
        const avgScore =
          allSubs.length > 0
            ? allSubs.reduce((sum, s) => sum + toPercent(s), 0) / allSubs.length
            : null;

        return {
          id: dept.id,
          name: dept.name,
          createdAt: dept.createdAt,
          courseCount: dept.courses.length,
          studentCount,
          avgScore,
          gradedCount: allSubs.length,
        };
      })
    );

    return res.json(stats);
  } catch (err) {
    console.error("Error fetching department stats:", err);
    return res.status(500).json({ error: "Failed to fetch department stats" });
  }
});

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
  if (req.user.role !== "student") return res.status(403).json({ error: "Only students can update their profile." });
  const { newYear } = req.body;
  if (!newYear) return res.status(400).json({ error: "New Year of Study is required." });
  try {
    const updated = await prisma.student.update({ where: { id: req.user.id }, data: { year: newYear.trim() } });
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: "Error updating Year of Study." });
  }
});

app.get("/api/student/profile", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only." });
  try {
    const s = await prisma.student.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, regNumber: true, department: true, additionalDepartments: true, year: true, email: true },
    });
    if (!s) return res.status(404).json({ error: "Student not found." });
    return res.json({ ...s, additionalDepartments: JSON.parse(s.additionalDepartments || "[]") });
  } catch { return res.status(500).json({ error: "Failed to fetch profile." }); }
});

app.patch("/api/student/department", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only." });
  const { department } = req.body;
  if (!department?.trim()) return res.status(400).json({ error: "Department name is required." });
  try {
    const dept = await prisma.department.findFirst({ where: { name: department.trim() } });
    if (!dept) return res.status(400).json({ error: "Department not found." });
    await prisma.student.update({ where: { id: req.user.id }, data: { department: department.trim() } });
    return res.json({ success: true, department: department.trim() });
  } catch {
    return res.status(500).json({ error: "Failed to update department." });
  }
});

app.patch("/api/student/additional-departments", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only." });
  const { departments } = req.body;
  if (!Array.isArray(departments)) return res.status(400).json({ error: "departments must be an array." });
  try {
    // Validate all names exist
    const names: string[] = departments.map((d: any) => String(d).trim()).filter(Boolean);
    if (names.length > 0) {
      const found = await prisma.department.findMany({ where: { name: { in: names } }, select: { name: true } });
      const foundNames = new Set(found.map(d => d.name));
      const invalid = names.filter(n => !foundNames.has(n));
      if (invalid.length > 0) return res.status(400).json({ error: `Unknown departments: ${invalid.join(", ")}` });
    }
    await prisma.student.update({ where: { id: req.user.id }, data: { additionalDepartments: JSON.stringify(names) } });
    return res.json({ success: true, additionalDepartments: names });
  } catch { return res.status(500).json({ error: "Failed to update additional departments." }); }
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

// All exam submissions for the authenticated student
app.get("/api/student/exam-submissions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  try {
    const submissions = await prisma.examSubmission.findMany({
      where: { studentId: req.user.id },
      include: {
        exam: { select: { title: true, course: { select: { code: true, title: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return res.json(submissions);
  } catch (err) {
    console.error("Error fetching student exam submissions:", err);
    return res.status(500).json({ error: "Failed to fetch submissions" });
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

app.get("/api/lectures/active-all", authenticateToken, async (req: any, res) => {
  try {
    const sessions = await prisma.lectureSession.findMany({
      where: { isActive: true },
      include: {
        course: { select: { id: true, code: true, title: true, lecturer: { select: { name: true } } } },
        attendance: { select: { studentId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(sessions);
  } catch (error: any) {
    console.error("Error fetching all active sessions:", error);
    return res.status(500).json({ error: "Error fetching active sessions" });
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
    if (!session) return res.json(null);
    // Tell the student if they've been granted mic permission
    const myRaise = req.user.role === "student"
      ? session.handRaises.find((h) => h.studentId === req.user.id)
      : null;
    return res.json({ ...session, myAllowedToSpeak: myRaise?.allowedToSpeak ?? false });
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
    const session = await prisma.lectureSession.findUnique({ where: { id }, include: { course: { select: { lecturerId: true } } } });
    if (!session) return res.status(404).json({ error: "Session not found." });
    if (req.user.role === "lecturer" && session.course.lecturerId !== req.user.id)
      return res.status(403).json({ error: "Access denied." });
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
    const session = await prisma.lectureSession.findUnique({ where: { id }, include: { course: { select: { lecturerId: true } } } });
    if (!session) return res.status(404).json({ error: "Session not found." });
    if (req.user.role === "lecturer" && session.course.lecturerId !== req.user.id)
      return res.status(403).json({ error: "Access denied." });
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
    const session = await prisma.lectureSession.findUnique({ where: { id }, include: { course: { select: { lecturerId: true } } } });
    if (!session) return res.status(404).json({ error: "Lecture not found" });
    if (session.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
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
    const session = await prisma.lectureSession.findUnique({ where: { id }, include: { course: { select: { lecturerId: true } } } });
    if (!session) return res.status(404).json({ error: "Lecture not found" });
    if (session.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
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
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const session = await prisma.lectureSession.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!session || session.course.lecturerId !== req.user.id)
      return res.status(403).json({ error: "Access denied." });
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
  const ownerCheck = await requireLectureOwner(req.params.id, req.user.id);
  if (ownerCheck !== "ok") return res.status(ownerCheck === "not_found" ? 404 : 403).json({ error: "Access denied." });
  try {
    await prisma.handRaise.update({ where: { id: req.params.raiseId }, data: { isResolved: true, allowedToSpeak: false } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to dismiss hand raise" });
  }
});

// Lecturer grants mic permission to a student
app.post("/api/lectures/:id/hand-raises/:raiseId/allow", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownerCheck = await requireLectureOwner(req.params.id, req.user.id);
  if (ownerCheck !== "ok") return res.status(ownerCheck === "not_found" ? 404 : 403).json({ error: "Access denied." });
  try {
    const raise = await prisma.handRaise.update({
      where: { id: req.params.raiseId },
      data: { allowedToSpeak: true },
    });
    return res.json(raise);
  } catch (e) {
    return res.status(500).json({ error: "Failed to grant speaking permission" });
  }
});

// Lecturer revokes mic permission (mutes student)
app.post("/api/lectures/:id/hand-raises/:raiseId/mute", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownerCheck = await requireLectureOwner(req.params.id, req.user.id);
  if (ownerCheck !== "ok") return res.status(ownerCheck === "not_found" ? 404 : 403).json({ error: "Access denied." });
  try {
    const raise = await prisma.handRaise.update({
      where: { id: req.params.raiseId },
      data: { allowedToSpeak: false },
    });
    return res.json(raise);
  } catch (e) {
    return res.status(500).json({ error: "Failed to mute student" });
  }
});

// Helper — verify caller owns the lecture session
async function requireLectureOwner(sessionId: string, lecturerId: string) {
  const session = await prisma.lectureSession.findUnique({ where: { id: sessionId }, include: { course: { select: { lecturerId: true } } } });
  if (!session) return "not_found";
  if (session.course.lecturerId !== lecturerId) return "forbidden";
  return "ok";
}

// Lecturer creates a poll
app.post("/api/lectures/:id/poll", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownership = await requireLectureOwner(req.params.id, req.user.id).catch(() => "error");
  if (ownership === "not_found") return res.status(404).json({ error: "Lecture not found" });
  if (ownership !== "ok") return res.status(403).json({ error: "Access denied." });
  const { question, options } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: "Question and at least 2 options required" });
  }
  try {
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
  const ownership = await requireLectureOwner(req.params.id, req.user.id).catch(() => "error");
  if (ownership !== "ok") return res.status(ownership === "not_found" ? 404 : 403).json({ error: ownership === "not_found" ? "Lecture not found" : "Access denied." });
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

// Advance slide (lecturer — must own session)
app.post("/api/lectures/:id/slide", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownership = await requireLectureOwner(req.params.id, req.user.id).catch(() => "error");
  if (ownership !== "ok") return res.status(ownership === "not_found" ? 404 : 403).json({ error: ownership === "not_found" ? "Lecture not found" : "Access denied." });
  const { slide } = req.body;
  if (slide === undefined) return res.status(400).json({ error: "Slide index required" });
  try {
    const updated = await prisma.lectureSession.update({ where: { id: req.params.id }, data: { currentSlide: Number(slide) } });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: "Failed to update slide" });
  }
});

// Upload file attachment (must own session)
app.post("/api/lectures/:id/attachment", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownership = await requireLectureOwner(req.params.id, req.user.id).catch(() => "error");
  if (ownership !== "ok") return res.status(ownership === "not_found" ? 404 : 403).json({ error: ownership === "not_found" ? "Lecture not found" : "Access denied." });
  if (!req.file) return res.status(400).json({ error: "File required" });
  // Only allow safe document/image types for attachments
  const allowed = ["application/pdf","image/jpeg","image/png","image/webp","text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Unsupported file type." });
  }
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

app.post("/api/lectures/parse-pptx", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  if (!req.file) return res.status(400).json({ error: "File required" });
  const pptxMimes = ["application/vnd.openxmlformats-officedocument.presentationml.presentation"];
  if (!pptxMimes.includes(req.file.mimetype)) return res.status(400).json({ error: "Only .pptx files are accepted." });
  try {
    const slides = await extractPptxSlides(req.file.buffer);
    if (slides.length === 0) return res.status(400).json({ error: "No slide content found in file" });
    return res.json({ ok: true, slideCount: slides.length, content: slides.join("\n\n---\n\n") });
  } catch (e: any) {
    console.error("PPTX parse error:", e);
    return res.status(500).json({ error: "Failed to parse PPTX file" });
  }
});

app.post("/api/lectures/:id/pptx", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const ownership = await requireLectureOwner(req.params.id, req.user.id).catch(() => "error");
  if (ownership !== "ok") return res.status(ownership === "not_found" ? 404 : 403).json({ error: ownership === "not_found" ? "Lecture not found" : "Access denied." });
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
      include: { chats: { orderBy: { createdAt: "asc" } }, course: { select: { lecturerId: true } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });

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
  const numScore = parseFloat(score);
  if (!Number.isFinite(numScore) || numScore < 0 || numScore > 100) {
    return res.status(400).json({ error: "Score must be a finite number between 0 and 100." });
  }

  try {
    const attempt = await prisma.studentAttempt.findUnique({
      where: { id },
      include: { quiz: { include: { course: { select: { lecturerId: true } } } } },
    });
    if (!attempt) return res.status(404).json({ error: "Attempt not found." });
    if (attempt.quiz?.course?.lecturerId !== req.user.id)
      return res.status(403).json({ error: "You do not own this quiz." });
    const updated = await prisma.studentAttempt.update({
      where: { id },
      data: { score: numScore },
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

type AnswerKeyItem = { qLabel: string; answer: string; marks: number };

function applyMarkingFormula(similarity: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0;
  const raw = similarity < 50 ? 0.5 : ((similarity - 50) / 50) * maxMarks;
  return Math.round(raw * 2) / 2; // nearest 0.5
}

async function gradeSubmission(
  questionsText: string,
  answerKeyText: string | null | undefined,
  studentAnswers: string,
  studentName: string,
  marksText?: string | null,
  answerKeyJson?: string | null
): Promise<{ score: number; totalMarks: number | null; feedback: string }> {
  const nvidia = getNvidiaClient();

  // ── Priority 1: Structured per-question answer key ──────────────────
  if (answerKeyJson) {
    let parsedKey: AnswerKeyItem[];
    try {
      parsedKey = JSON.parse(answerKeyJson);
    } catch {
      parsedKey = [];
    }
    const keyItems: AnswerKeyItem[] = parsedKey.filter(
      (q: AnswerKeyItem) => q.answer?.trim() && q.marks > 0
    );

    if (keyItems.length > 0) {
      const totalMarks = keyItems.reduce((s, q) => s + q.marks, 0);

      const prompt = `You are grading a student's written exam answers.

STUDENT: ${studentName}

STUDENT'S ANSWERS:
${studentAnswers}

For each question below, find the student's answer (by question label) and estimate how much of the model answer they captured as a similarity percentage (0–100). Be fair — assess meaning, not exact wording.

${keyItems.map((q) => `${q.qLabel} (${q.marks} mark${q.marks !== 1 ? "s" : ""})\nModel answer: ${q.answer}`).join("\n\n")}

Return ONLY valid JSON, no other text:
{
  "questions": [
    {"qLabel": "<label>", "similarity": <0-100>, "comment": "<one sentence>"}
  ],
  "overall_feedback": "<2-3 sentences for ${studentName}>"
}`;

      const response = await nvidia.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      try { parsed = JSON.parse(jsonMatch?.[0] ?? raw); } catch { /* fall through to 0 score */ }

      if (Array.isArray(parsed.questions)) {
        const breakdown = (parsed.questions as any[]).map((q) => {
          const key = keyItems.find((k) => k.qLabel === q.qLabel);
          const maxM = key?.marks ?? 0;
          const sim = Math.max(0, Math.min(100, Number(q.similarity)));
          const awarded = applyMarkingFormula(sim, maxM);
          return { qLabel: q.qLabel, sim, awarded, max: maxM, comment: String(q.comment ?? "") };
        });
        const score = breakdown.reduce((s, b) => s + b.awarded, 0);
        const breakdownText = breakdown
          .map((b) => `${b.qLabel}: ${b.awarded}/${b.max} marks (${b.sim}% match) — ${b.comment}`)
          .join("\n");
        const feedback = `${String(parsed.overall_feedback ?? "")}\n\nBreakdown:\n${breakdownText}`;
        return { score, totalMarks, feedback };
      }

      // AI gave unexpected format — return 0 with correct totalMarks so display stays marks-based
      return { score: 0, totalMarks, feedback: "Auto-grading response was in an unexpected format. Please try grading again." };
    }
  }

  // ── Priority 2: Legacy marksText + answerKeyText ─────────────────────
  if (answerKeyText) {
    const marksArray = marksText
      ? marksText.split(",").map((m) => parseFloat(m.trim())).filter((m) => !isNaN(m) && m > 0)
      : [];
    const usesMarks = marksArray.length > 0;
    const totalMarks = usesMarks ? marksArray.reduce((a, b) => a + b, 0) : 100;

    let prompt: string;
    if (usesMarks) {
      const marksDesc = marksArray.map((m, i) => `Q${i + 1}: ${m} mark${m !== 1 ? "s" : ""}`).join(", ");
      prompt = `You are a fair and thorough academic exam grader.

EXAM QUESTIONS:
${questionsText}

MODEL ANSWER KEY:
${answerKeyText}

STUDENT NAME: ${studentName}
STUDENT'S ANSWERS:
${studentAnswers}

MARKS ALLOCATION: ${marksDesc} (total: ${totalMarks} marks)

For each question, estimate similarity (0–100) of student answer to model answer.

Respond with ONLY valid JSON:
{
  "questions": [
    {"q": 1, "similarity": <0-100>, "comment": "<one sentence>"}
  ],
  "overall_feedback": "<2-3 sentences>"
}`;
    } else {
      prompt = `You are a fair and thorough academic exam grader.

EXAM QUESTIONS:
${questionsText}

MODEL ANSWER KEY:
${answerKeyText}

STUDENT NAME: ${studentName}
STUDENT'S ANSWERS:
${studentAnswers}

Grade this student's answers against the model answer key. Evaluate semantic similarity, not just exact wording.

SCORING: 90–100 essentially correct; 70–89 mostly correct; 50–69 partial; 0–49 insufficient.

Respond with ONLY valid JSON:
{"score": <0-100>, "feedback": "<2-4 sentences>"}`;
    }

    const response = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw);

    if (usesMarks && Array.isArray(parsed.questions)) {
      const breakdown = (parsed.questions as any[]).map((q, i) => {
        const maxM = marksArray[i] ?? 0;
        const sim = Math.max(0, Math.min(100, Number(q.similarity)));
        const awarded = applyMarkingFormula(sim, maxM);
        return { q: q.q ?? i + 1, sim, awarded, max: maxM, comment: String(q.comment ?? "") };
      });
      const score = breakdown.reduce((s, b) => s + b.awarded, 0);
      const breakdownText = breakdown
        .map((b) => `Q${b.q}: ${b.awarded}/${b.max} marks (${b.sim}% match) — ${b.comment}`)
        .join("\n");
      const feedback = `${String(parsed.overall_feedback ?? "")}\n\nBreakdown:\n${breakdownText}`;
      return { score, totalMarks, feedback };
    }

    // No per-question marks: treat 0–100 AI score as marks out of 100
    const score = Math.max(0, Math.min(100, Number(parsed.score)));
    return { score, totalMarks: 100, feedback: String(parsed.feedback ?? "Grading complete.") };
  }

  return { score: 0, totalMarks: 100, feedback: "No answer key available for grading." };
}

// Parse question structure from uploaded doc
app.post("/api/parse-questions", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const questionsText = req.file ? await extractTextFromFile(req.file) : req.body.questionsText;
    if (!questionsText?.trim()) return res.status(400).json({ error: "Questions text or file required" });

    const nvidia = getNvidiaClient();
    const prompt = `Parse this exam/assignment question paper and extract the question structure.

QUESTION PAPER:
${questionsText}

Identify all questions and sub-questions. Common patterns:
- Main questions: "1." "2." "Q1" "Question 1" "(1)"
- Sub-questions under a main question: "a." "b." "(a)" "(b)" "(i)" "(ii)"
- Already combined: "1a" "1(a)" "Q1a"

Return ONLY a JSON array, no other text:
[
  {
    "label": "1",
    "text": "<brief question text, max 120 chars>",
    "subqs": [
      {"label": "a", "text": "<sub-question text, max 120 chars>"},
      {"label": "b", "text": "<sub-question text, max 120 chars>"}
    ]
  },
  {
    "label": "2",
    "text": "<question text>",
    "subqs": []
  }
]

Use empty array for subqs if the question has no sub-parts.`;

    const response = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const structure = JSON.parse(jsonMatch?.[0] ?? "[]");
    return res.json({ questionsText, structure });
  } catch (err) {
    console.error("Error parsing questions:", err);
    return res.status(500).json({ error: "Failed to parse questions" });
  }
});

// Create exam
app.post("/api/exams", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { title, courseId } = req.body;
  if (!title || !courseId) return res.status(400).json({ error: "Title and courseId are required" });
  if (!req.file && !req.body.questionsText) return res.status(400).json({ error: "Questions file or text is required" });

  try {
    const questionsText = req.file ? await extractTextFromFile(req.file) : req.body.questionsText;
    const { availableFrom, availableUntil, answerKeyJson, questionsStructureJson } = req.body;
    const exam = await prisma.exam.create({
      data: {
        title,
        courseId,
        questionsText,
        questionsStructureJson: questionsStructureJson || null,
        answerKeyJson: answerKeyJson || null,
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      },
    });
    sendPushToAll("student", "New Exam Posted", `A new written exam "${title}" is now available. Open the app to check it.`, "/").catch(() => {});
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
    let courseFilter: any = {};
    if (req.user.role === "student") {
      const { depts, year } = await getStudentFilter(req.user.id);
      courseFilter = {
        AND: [
          { OR: [{ departmentId: null }, { department: { name: { in: depts } } }] },
          { OR: [{ targetYear: null }, { targetYear: year }] },
        ],
      };
    }
    const exams = await prisma.exam.findMany({
      where: {
        ...(courseId ? { courseId: String(courseId) } : {}),
        course: courseFilter,
      },
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
    if (req.user.role === "student") {
      const { answerKeyText: _a, answerKeyJson: _b, ...safe } = exam as any;
      return res.json(safe);
    }
    return res.json(exam);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch exam" });
  }
});

// Upload answer key (lecturer only — must own the exam)
app.post("/api/exams/:id/answer-key", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const answerKeyText = req.file ? await extractTextFromFile(req.file) : req.body.answerKeyText;
    if (!answerKeyText) return res.status(400).json({ error: "Answer key file or text required" });
    const marksText = req.body.marksText?.trim() || null;
    const updated = await prisma.exam.update({ where: { id: req.params.id }, data: { answerKeyText, marksText } });
    return res.json(updated);
  } catch (err) {
    console.error("Error uploading answer key:", err);
    return res.status(500).json({ error: "Failed to upload answer key" });
  }
});

// Close / reopen exam (must own the exam)
app.post("/api/exams/:id/toggle", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
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
  if (answersText.length > MAX_ANSWER) {
    return res.status(400).json({ error: "Answer text exceeds the maximum allowed length (10,000 characters)." });
  }
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (!exam.isOpen) return res.status(400).json({ error: "This exam is closed for submissions" });
    const nowExam = new Date();
    if (exam.availableFrom && nowExam < exam.availableFrom) {
      return res.status(400).json({ error: `This exam is not yet open. It opens on ${exam.availableFrom.toLocaleString()}.` });
    }
    if (exam.availableUntil && nowExam > exam.availableUntil) {
      return res.status(400).json({ error: "The submission period for this exam has ended." });
    }

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

// Lecturer: view all submissions for an exam (must own the exam)
app.get("/api/exams/:id/submissions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
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

// Lecturer: add bonus marks on top of AI score for a single exam submission
app.post("/api/exams/:examId/submissions/:subId/grade", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const added = parseFloat(req.body.added);
  if (isNaN(added) || added < 0) return res.status(400).json({ error: "Invalid marks value" });
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.examId },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const existing = await prisma.examSubmission.findUnique({ where: { id: req.params.subId } });
    if (!existing) return res.status(404).json({ error: "Submission not found" });
    if (existing.examId !== req.params.examId) return res.status(403).json({ error: "Submission does not belong to this exam" });
    const newScore = (existing.score ?? 0) + added;
    const finalScore = existing.totalMarks ? Math.min(newScore, existing.totalMarks) : Math.min(newScore, 100);
    const updated = await prisma.examSubmission.update({
      where: { id: req.params.subId },
      data: { score: finalScore },
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add marks" });
  }
});

// Lecturer: AI grade all exam submissions
app.get("/api/exams/:id/grading-status", authenticateToken, (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const job = gradingJobs.get(`exam_${req.params.id}`);
  if (!job) return res.json({ inProgress: false, total: 0, done: 0, errors: 0 });
  return res.json(job);
});

app.post("/api/exams/:id/grade", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: { submissions: { include: { student: { select: { fullName: true } } } }, course: { select: { lecturerId: true } } },
    });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    if (!exam.answerKeyJson && !exam.answerKeyText) return res.status(400).json({ error: "Upload an answer key before grading" });
    if (!process.env.NVIDIA_API_KEY) return res.status(400).json({ error: "NVIDIA_API_KEY not configured" });
    const ungraded = exam.submissions.filter((s) => !s.isGraded);
    if (ungraded.length === 0) return res.json({ started: false, message: "No submissions to grade" });

    const jobKey = `exam_${exam.id}`;
    if (gradingJobs.get(jobKey)?.inProgress) return res.json({ started: false, message: "Grading already in progress" });

    gradingJobs.set(jobKey, { total: ungraded.length, done: 0, errors: 0, inProgress: true });
    res.status(202).json({ started: true, total: ungraded.length });

    // Run in background — do not await
    (async () => {
      const job = gradingJobs.get(jobKey)!;
      for (const submission of ungraded) {
        try {
          const { score, totalMarks, feedback } = await gradeSubmission(
            exam.questionsText, exam.answerKeyText, submission.answersText,
            (submission as any).student.fullName, exam.marksText, (exam as any).answerKeyJson
          );
          await prisma.examSubmission.update({ where: { id: submission.id }, data: { score, totalMarks, feedback, isGraded: true } });
          job.done++;
        } catch (err) {
          console.error(`Failed to grade exam submission ${submission.id}:`, err);
          job.errors++;
          job.done++;
        }
      }
      job.inProgress = false;
    })();
  } catch (err) {
    return res.status(500).json({ error: "Failed to start grading" });
  }
});

// Delete exam (must own the exam)
app.delete("/api/exams/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    await prisma.exam.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete exam" });
  }
});

// -------------------------------------------------------------
// ASSIGNMENTS API
// -------------------------------------------------------------

app.post("/api/assignments", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { title, courseId, description, dueDate } = req.body;
  if (!title || !courseId) return res.status(400).json({ error: "Title and courseId are required" });
  if (!req.file && !req.body.questionsText) return res.status(400).json({ error: "Questions file or text is required" });
  try {
    const questionsText = req.file ? await extractTextFromFile(req.file) : req.body.questionsText;
    const { answerKeyJson, questionsStructureJson } = req.body;
    const assignment = await prisma.assignment.create({
      data: {
        title,
        courseId,
        description: description || null,
        questionsText,
        questionsStructureJson: questionsStructureJson || null,
        answerKeyJson: answerKeyJson || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
    sendPushToAll("student", "New Assignment", `A new assignment "${title}" has been posted. Open the app to view it.`, "/").catch(() => {});
    return res.status(201).json(assignment);
  } catch (err: any) {
    console.error("Error creating assignment:", err);
    return res.status(500).json({ error: "Failed to create assignment" });
  }
});

app.get("/api/assignments", authenticateToken, async (req: any, res) => {
  const { courseId } = req.query;
  try {
    let courseFilter: any = {};
    if (req.user.role === "student") {
      const { depts, year } = await getStudentFilter(req.user.id);
      courseFilter = {
        AND: [
          { OR: [{ departmentId: null }, { department: { name: { in: depts } } }] },
          { OR: [{ targetYear: null }, { targetYear: year }] },
        ],
      };
    }
    const assignments = await prisma.assignment.findMany({
      where: {
        ...(courseId ? { courseId: String(courseId) } : {}),
        course: courseFilter,
      },
      include: { course: { select: { code: true, title: true } }, _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(assignments);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

app.get("/api/assignments/:id", authenticateToken, async (req: any, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { code: true, title: true, lecturerId: true } } },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (req.user.role === "student") {
      const { answerKeyText: _a, answerKeyJson: _b, ...safe } = assignment as any;
      return res.json(safe);
    }
    return res.json(assignment);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch assignment" });
  }
});

app.post("/api/assignments/:id/answer-key", authenticateToken, upload.single("file"), async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const answerKeyText = req.file ? await extractTextFromFile(req.file) : req.body.answerKeyText;
    if (!answerKeyText) return res.status(400).json({ error: "Answer key file or text is required" });
    const marksText = req.body.marksText?.trim() || null;
    const updated = await prisma.assignment.update({ where: { id: req.params.id }, data: { answerKeyText, marksText } });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to upload answer key" });
  }
});

app.post("/api/assignments/:id/toggle", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const updated = await prisma.assignment.update({ where: { id: req.params.id }, data: { isOpen: !assignment.isOpen } });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to toggle assignment" });
  }
});

app.delete("/api/assignments/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    await prisma.assignment.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete assignment" });
  }
});

app.post("/api/assignments/:id/submit", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  const { answersText, attachmentName, attachmentData } = req.body;
  if (!answersText?.trim() && !attachmentData) return res.status(400).json({ error: "Please provide answers or a file attachment." });
  const MAX_ATTACH = 8 * 1024 * 1024; // 8 MB base64 limit
  if (attachmentData && attachmentData.length > MAX_ATTACH) return res.status(413).json({ error: "Attachment exceeds 8 MB limit." });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (!assignment.isOpen) return res.status(403).json({ error: "This assignment is closed for submissions." });
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      return res.status(403).json({ error: "The due date for this assignment has passed." });
    }
    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
    });
    if (existing) return res.status(409).json({ error: "You have already submitted this assignment." });
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: req.params.id,
        studentId: req.user.id,
        answersText: answersText || "",
        ...(attachmentName ? { attachmentName } : {}),
        ...(attachmentData ? { attachmentData } : {}),
      },
    });
    return res.status(201).json(submission);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to submit assignment" });
  }
});

app.get("/api/assignments/:id/my-submission", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  try {
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
    });
    return res.json(sub ?? null);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch submission" });
  }
});

app.get("/api/assignments/:id/submissions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!assignment || assignment.course.lecturerId !== req.user.id)
      return res.status(403).json({ error: "Access denied." });
    const subs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: req.params.id },
      include: { student: { select: { fullName: true, regNumber: true } } },
      orderBy: { submittedAt: "desc" },
    });
    return res.json(subs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// Lecturer: add bonus marks on top of AI score for a single assignment submission
app.post("/api/assignments/:assignmentId/submissions/:subId/grade", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const added = parseFloat(req.body.added);
  if (isNaN(added) || added < 0) return res.status(400).json({ error: "Invalid marks value" });
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const existing = await prisma.assignmentSubmission.findUnique({ where: { id: req.params.subId } });
    if (!existing) return res.status(404).json({ error: "Submission not found" });
    if (existing.assignmentId !== req.params.assignmentId) return res.status(403).json({ error: "Submission does not belong to this assignment" });
    const newScore = (existing.score ?? 0) + added;
    const finalScore = existing.totalMarks ? Math.min(newScore, existing.totalMarks) : Math.min(newScore, 100);
    const updated = await prisma.assignmentSubmission.update({
      where: { id: req.params.subId },
      data: { score: finalScore },
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to add marks" });
  }
});

// Lecturer: AI grade all assignment submissions
app.get("/api/assignments/:id/grading-status", authenticateToken, (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const job = gradingJobs.get(`assignment_${req.params.id}`);
  if (!job) return res.json({ inProgress: false, total: 0, done: 0, errors: 0 });
  return res.json(job);
});

app.post("/api/assignments/:id/grade", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { submissions: { include: { student: { select: { fullName: true } } } }, course: { select: { lecturerId: true } } },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    if (!(assignment as any).answerKeyJson && !assignment.answerKeyText) return res.status(400).json({ error: "Upload an answer key before grading" });
    if (!process.env.NVIDIA_API_KEY) return res.status(400).json({ error: "NVIDIA_API_KEY not configured" });
    const ungraded = assignment.submissions.filter((s) => !s.isGraded);
    if (ungraded.length === 0) return res.json({ started: false, message: "No submissions to grade" });

    const jobKey = `assignment_${assignment.id}`;
    if (gradingJobs.get(jobKey)?.inProgress) return res.json({ started: false, message: "Grading already in progress" });

    gradingJobs.set(jobKey, { total: ungraded.length, done: 0, errors: 0, inProgress: true });
    res.status(202).json({ started: true, total: ungraded.length });

    // Run in background — do not await
    (async () => {
      const job = gradingJobs.get(jobKey)!;
      for (const submission of ungraded) {
        try {
          const { score, totalMarks, feedback } = await gradeSubmission(
            assignment.questionsText, assignment.answerKeyText, submission.answersText,
            (submission as any).student.fullName, assignment.marksText, (assignment as any).answerKeyJson
          );
          await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { score, totalMarks, feedback, isGraded: true } });
          job.done++;
        } catch (err) {
          console.error(`Failed to grade assignment submission ${submission.id}:`, err);
          job.errors++;
          job.done++;
        }
      }
      job.inProgress = false;
    })();
  } catch (err) {
    return res.status(500).json({ error: "Failed to start grading" });
  }
});

app.get("/api/student/assignment-submissions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Students only" });
  try {
    const subs = await prisma.assignmentSubmission.findMany({
      where: { studentId: req.user.id },
      include: { assignment: { include: { course: { select: { code: true } } } } },
      orderBy: { submittedAt: "desc" },
    });
    return res.json(subs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch submissions" });
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
  if (typeof avatar !== "string" || avatar.length > MAX_AVATAR) {
    return res.status(413).json({ error: "Avatar image is too large. Maximum size is 1 MB." });
  }
  // Only allow base64-encoded images (jpeg, png, webp, gif)
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(avatar)) {
    return res.status(400).json({ error: "Invalid image format. Only JPEG, PNG, WebP, and GIF are accepted." });
  }

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

// Fetch Avatar Base64 — authenticated; users can only fetch their own avatar
app.get("/api/user/avatar/:role/:id", authenticateToken, async (req: any, res) => {
  const { role, id } = req.params;
  if (role !== "lecturer" && role !== "student") {
    return res.status(400).json({ error: "Invalid role." });
  }
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
// PUSH NOTIFICATION SUBSCRIPTION
// -------------------------------------------------------------

app.get("/api/vapid-public-key", (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/push/subscribe", authenticateToken, async (req: any, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Invalid subscription" });
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: req.user.id, userRole: req.user.role },
      create: { userId: req.user.id, userRole: req.user.role, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save subscription" });
  }
});

app.delete("/api/push/unsubscribe", authenticateToken, async (req: any, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
  return res.json({ success: true });
});

// -------------------------------------------------------------
// ANNOUNCEMENTS
// -------------------------------------------------------------

app.get("/api/announcements", authenticateToken, async (_req, res) => {
  try {
    const items = await prisma.announcement.findMany({
      include: {
        lecturer: { select: { name: true } },
        course:   { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

app.post("/api/announcements", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { title, body, courseId } = req.body;
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: "Title and body required" });
  try {
    const ann = await prisma.announcement.create({
      data: { title: title.trim(), body: body.trim(), lecturerId: req.user.id, courseId: courseId || null },
      include: { lecturer: { select: { name: true } }, course: { select: { code: true } } },
    });
    sendPushToAll("student", `📢 ${title}`, body, "/").catch(() => {});
    return res.status(201).json(ann);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

app.delete("/api/announcements/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!ann) return res.status(404).json({ error: "Not found" });
    if (ann.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });
    await prisma.announcement.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});

// -------------------------------------------------------------
// QUIZ — EDIT / DUPLICATE / ANALYTICS / LEADERBOARD
// -------------------------------------------------------------

app.put("/api/quizzes/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { title, durationMinutes, availableFrom, availableUntil, questions } = req.body;
  if (!title || !durationMinutes || !Array.isArray(questions) || questions.length === 0)
    return res.status(400).json({ error: "title, durationMinutes, and questions are required" });
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { lecturerId: true } } },
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { quizId: req.params.id } });
      return tx.quiz.update({
        where: { id: req.params.id },
        data: {
          title,
          durationMinutes: parseInt(durationMinutes),
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          availableUntil: availableUntil ? new Date(availableUntil) : null,
          questions: {
            create: questions.map((q: any) => ({
              text: q.text,
              optionsJson: JSON.stringify(q.options),
              correctOption: q.correctOption,
            })),
          },
        },
        include: {
          course: { select: { code: true, title: true } },
          _count: { select: { questions: true, attempts: true } },
        },
      });
    });
    return res.json(updated);
  } catch (err) {
    console.error("Error updating quiz:", err);
    return res.status(500).json({ error: "Failed to update quiz" });
  }
});

app.post("/api/quizzes/:id/duplicate", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: true, course: { select: { lecturerId: true } } },
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    const copy = await prisma.quiz.create({
      data: {
        title: `${quiz.title} (Copy)`,
        durationMinutes: quiz.durationMinutes,
        courseId: quiz.courseId,
        questions: {
          create: quiz.questions.map((q) => ({
            text: q.text,
            optionsJson: q.optionsJson,
            correctOption: q.correctOption,
          })),
        },
      },
      include: {
        course: { select: { code: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    return res.status(201).json(copy);
  } catch (err) {
    return res.status(500).json({ error: "Failed to duplicate quiz" });
  }
});

app.get("/api/quizzes/:id/analytics", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        questions: true,
        course: { select: { lecturerId: true, code: true } },
        attempts: { where: { isCompleted: true }, select: { score: true, answersJson: true } },
      },
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    const total = quiz.attempts.length;
    const scores = quiz.attempts.map((a) => a.score ?? 0);
    const avg = total > 0 ? scores.reduce((s, x) => s + x, 0) / total : 0;
    const passCount = scores.filter((s) => s >= 50).length;

    const questionStats = quiz.questions.map((q) => {
      let correct = 0, attempted = 0;
      const options: string[] = JSON.parse(q.optionsJson ?? "[]");
      const optionCounts: Record<string, number> = {};
      options.forEach(o => { optionCounts[o] = 0; });
      for (const att of quiz.attempts) {
        try {
          const ans = JSON.parse(att.answersJson ?? "{}");
          if (ans[q.id] !== undefined) {
            attempted++;
            if (ans[q.id] === q.correctOption) correct++;
            optionCounts[ans[q.id]] = (optionCounts[ans[q.id]] ?? 0) + 1;
          }
        } catch { /* skip */ }
      }
      return {
        id: q.id,
        text: q.text.slice(0, 100),
        correct,
        attempted,
        correctRate: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
        options,
        optionCounts,
        correctOption: q.correctOption,
      };
    });

    return res.json({
      quizTitle: quiz.title,
      courseCode: quiz.course.code,
      total,
      avgScore: Math.round(avg * 10) / 10,
      passRate: total > 0 ? Math.round((passCount / total) * 100) : 0,
      passCount,
      failCount: total - passCount,
      scores,
      questionStats,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.get("/api/quizzes/:id/leaderboard", authenticateToken, async (req: any, res) => {
  try {
    const attempts = await prisma.studentAttempt.findMany({
      where: { quizId: req.params.id, isCompleted: true },
      include: { student: { select: { id: true, department: true } } },
      orderBy: { score: "desc" },
      take: 20,
    });
    const viewerId = req.user.role === "student" ? req.user.id : null;
    const board = attempts.map((a, i) => ({
      rank: i + 1,
      displayName: `Scholar #${i + 1}`,
      isCurrentUser: a.student.id === viewerId,
      department: a.student.department,
      score: a.score ?? 0,
      submittedAt: a.submittedAt,
    }));
    return res.json(board);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// -------------------------------------------------------------
// CALENDAR API
// -------------------------------------------------------------
app.get("/api/calendar", authenticateToken, async (req: any, res) => {
  const { role, id } = req.user;
  try {
    const events: Array<{ id: string; type: string; title: string; courseCode: string; date: string; label: string }> = [];

    if (role === "student") {
      const { depts, year } = await getStudentFilter(id);
      const courseFilter = {
        AND: [
          { OR: [{ departmentId: null }, { department: { name: { in: depts } } }] },
          { OR: [{ targetYear: null }, { targetYear: year }] },
        ],
      };
      const [quizzes, exams, assignments] = await Promise.all([
        prisma.quiz.findMany({
          where: { course: courseFilter },
          include: { course: { select: { code: true } } },
        }),
        prisma.exam.findMany({
          where: { isOpen: true, course: courseFilter },
          include: { course: { select: { code: true } } },
        }),
        prisma.assignment.findMany({
          where: { isOpen: true, dueDate: { not: null }, course: courseFilter },
          include: { course: { select: { code: true } } },
        }),
      ]);
      quizzes.forEach(q => {
        if (q.availableFrom) events.push({ id: `qo_${q.id}`, type: "quiz", title: q.title, courseCode: q.course.code, date: q.availableFrom.toISOString(), label: "Opens" });
        if (q.availableUntil) events.push({ id: `qc_${q.id}`, type: "quiz", title: q.title, courseCode: q.course.code, date: q.availableUntil.toISOString(), label: "Closes" });
      });
      exams.forEach(e => {
        if (e.availableFrom) events.push({ id: `eo_${e.id}`, type: "exam", title: e.title, courseCode: e.course.code, date: e.availableFrom.toISOString(), label: "Opens" });
        if (e.availableUntil) events.push({ id: `ec_${e.id}`, type: "exam", title: e.title, courseCode: e.course.code, date: e.availableUntil.toISOString(), label: "Closes" });
      });
      assignments.forEach(a => {
        if (a.dueDate) events.push({ id: `ad_${a.id}`, type: "assignment", title: a.title, courseCode: a.course.code, date: a.dueDate.toISOString(), label: "Due" });
      });
    } else if (role === "lecturer") {
      const [quizzes, exams, assignments] = await Promise.all([
        prisma.quiz.findMany({
          where: { course: { lecturerId: id } },
          include: { course: { select: { code: true } } },
        }),
        prisma.exam.findMany({
          where: { course: { lecturerId: id } },
          include: { course: { select: { code: true } } },
        }),
        prisma.assignment.findMany({
          where: { dueDate: { not: null }, course: { lecturerId: id } },
          include: { course: { select: { code: true } } },
        }),
      ]);
      quizzes.forEach(q => {
        if (q.availableFrom) events.push({ id: `qo_${q.id}`, type: "quiz", title: q.title, courseCode: q.course.code, date: q.availableFrom.toISOString(), label: "Quiz Opens" });
        if (q.availableUntil) events.push({ id: `qc_${q.id}`, type: "quiz", title: q.title, courseCode: q.course.code, date: q.availableUntil.toISOString(), label: "Quiz Closes" });
      });
      exams.forEach(e => {
        if (e.availableFrom) events.push({ id: `eo_${e.id}`, type: "exam", title: e.title, courseCode: e.course.code, date: e.availableFrom.toISOString(), label: "Exam Opens" });
        if (e.availableUntil) events.push({ id: `ec_${e.id}`, type: "exam", title: e.title, courseCode: e.course.code, date: e.availableUntil.toISOString(), label: "Exam Closes" });
      });
      assignments.forEach(a => {
        if (a.dueDate) events.push({ id: `ad_${a.id}`, type: "assignment", title: a.title, courseCode: a.course.code, date: a.dueDate.toISOString(), label: "Assignment Due" });
      });
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return res.json(events);
  } catch (err) {
    console.error("Calendar error:", err);
    return res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

// -------------------------------------------------------------
// AI QUESTION GENERATION
// -------------------------------------------------------------
app.post("/api/ai/generate-questions", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { topic, count = 5, courseContext } = req.body;
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({ error: "A topic of at least 3 characters is required" });
  }
  const n = Math.min(Math.max(parseInt(String(count)) || 5, 1), 20);
  try {
    const nvidia = getNvidiaClient();
    const prompt = `You are an academic question setter. Generate exactly ${n} multiple-choice questions about: "${topic.trim()}"${courseContext ? ` in the context of ${courseContext}` : ""}.

Return ONLY a JSON array — no markdown, no commentary. Each element must have:
- "text": the question text (string)
- "options": array of exactly 4 answer strings labeled like "A. ...", "B. ...", "C. ...", "D. ..."
- "correctOption": the full text of the correct option (must match one of the 4 options exactly)

Example format:
[{"text":"What is ...?","options":["A. Yes","B. No","C. Maybe","D. Always"],"correctOption":"A. Yes"}]`;

    const response = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 3000,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    // Strip potential markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    let questions: any[];
    try {
      questions = JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON array
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (!match) return res.status(502).json({ error: "AI returned invalid JSON — please try again" });
      questions = JSON.parse(match[0]);
    }
    if (!Array.isArray(questions)) return res.status(502).json({ error: "AI response was not a list" });
    // Validate and clean each question
    const cleaned = questions.slice(0, n).map((q: any, i: number) => ({
      text: String(q.text || `Question ${i + 1}`),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ["A. ", "B. ", "C. ", "D. "],
      correctOption: String(q.correctOption || ""),
    }));
    return res.json(cleaned);
  } catch (err: any) {
    console.error("AI question generation error:", err);
    return res.status(500).json({ error: "AI generation failed — check NVIDIA_API_KEY" });
  }
});

// -------------------------------------------------------------
// LECTURER ANALYTICS API
// -------------------------------------------------------------
app.get("/api/lecturer/analytics", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Unauthorized" });
  const lecturerId = req.user.id;
  try {
    const courses = await prisma.course.findMany({
      where: { lecturerId },
      include: {
        department: { select: { name: true } },
        quizzes: {
          include: {
            attempts: { where: { isCompleted: true }, select: { score: true, submittedAt: true } },
          },
        },
        exams: {
          include: {
            submissions: { where: { isGraded: true }, select: { score: true, totalMarks: true, submittedAt: true } },
          },
        },
        assignments: {
          include: {
            submissions: { where: { isGraded: true }, select: { score: true, totalMarks: true, submittedAt: true } },
          },
        },
      },
    });

    // Build per-course stats
    const courseStats = courses.map(c => {
      const quizScores = c.quizzes.flatMap(q => q.attempts.map(a => a.score ?? 0));
      const examScores = c.exams.flatMap(e => e.submissions.map(s => s.totalMarks ? (s.score! / s.totalMarks) * 100 : (s.score ?? 0)));
      const assignScores = c.assignments.flatMap(a => a.submissions.map(s => s.totalMarks ? (s.score! / s.totalMarks) * 100 : (s.score ?? 0)));
      const allScores = [...quizScores, ...examScores, ...assignScores];
      const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
      return {
        id: c.id, code: c.code, title: c.title,
        department: c.department?.name ?? null,
        quizCount: c.quizzes.length,
        examCount: c.exams.length,
        assignmentCount: c.assignments.length,
        quizSubmissions: quizScores.length,
        examSubmissions: examScores.length,
        assignmentSubmissions: assignScores.length,
        quizAvg: quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null,
        examAvg: examScores.length ? examScores.reduce((a, b) => a + b, 0) / examScores.length : null,
        assignmentAvg: assignScores.length ? assignScores.reduce((a, b) => a + b, 0) / assignScores.length : null,
        overallAvg: avg,
        totalSubmissions: allScores.length,
      };
    });

    // Global score distribution (all graded items) in 10-point buckets
    const allGradedScores = courseStats.flatMap(c => {
      const all: number[] = [];
      const course = courses.find(x => x.id === c.id)!;
      course.quizzes.forEach(q => q.attempts.forEach(a => all.push(a.score ?? 0)));
      course.exams.forEach(e => e.submissions.forEach(s => all.push(s.totalMarks ? (s.score! / s.totalMarks) * 100 : (s.score ?? 0))));
      course.assignments.forEach(a => a.submissions.forEach(s => all.push(s.totalMarks ? (s.score! / s.totalMarks) * 100 : (s.score ?? 0))));
      return all;
    });

    const distribution: Record<string, number> = { "0–49": 0, "50–59": 0, "60–69": 0, "70–79": 0, "80–89": 0, "90–100": 0 };
    allGradedScores.forEach(s => {
      if (s < 50) distribution["0–49"]++;
      else if (s < 60) distribution["50–59"]++;
      else if (s < 70) distribution["60–69"]++;
      else if (s < 80) distribution["70–79"]++;
      else if (s < 90) distribution["80–89"]++;
      else distribution["90–100"]++;
    });

    const overallAvg = allGradedScores.length ? allGradedScores.reduce((a, b) => a + b, 0) / allGradedScores.length : null;
    const passCount = allGradedScores.filter(s => s >= 50).length;

    return res.json({
      overview: {
        totalCourses: courses.length,
        totalSubmissions: allGradedScores.length,
        overallAvg,
        passRate: allGradedScores.length ? (passCount / allGradedScores.length) * 100 : null,
      },
      distribution,
      courses: courseStats,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// -------------------------------------------------------------
// IN-APP NOTIFICATIONS API
// -------------------------------------------------------------
app.get("/api/notifications", authenticateToken, async (req: any, res) => {
  const { role, id } = req.user;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const notifications: Array<{ id: string; type: string; title: string; body: string; time: string; icon: string }> = [];

    if (role === "student") {
      // Recently graded exam submissions
      const gradedExams = await prisma.examSubmission.findMany({
        where: { studentId: id, isGraded: true, submittedAt: { gte: sevenDaysAgo } },
        include: { exam: { select: { title: true, course: { select: { code: true } } } } },
        orderBy: { submittedAt: "desc" }, take: 5,
      });
      gradedExams.forEach(s => {
        const pct = s.totalMarks ? ((s.score ?? 0) / s.totalMarks * 100) : (s.score ?? 0);
        notifications.push({ id: `ge_${s.id}`, type: "grade", icon: "exam",
          title: `Exam graded: ${s.exam.title}`,
          body: `${s.exam.course.code} · Score: ${pct.toFixed(1)}%`,
          time: s.submittedAt.toISOString() });
      });

      // Recently graded assignment submissions
      const gradedAssignments = await prisma.assignmentSubmission.findMany({
        where: { studentId: id, isGraded: true, submittedAt: { gte: sevenDaysAgo } },
        include: { assignment: { select: { title: true, course: { select: { code: true } } } } },
        orderBy: { submittedAt: "desc" }, take: 5,
      });
      gradedAssignments.forEach(s => {
        const pct = s.totalMarks ? ((s.score ?? 0) / s.totalMarks * 100) : (s.score ?? 0);
        notifications.push({ id: `ga_${s.id}`, type: "grade", icon: "assignment",
          title: `Assignment graded: ${s.assignment.title}`,
          body: `${s.assignment.course.code} · Score: ${pct.toFixed(1)}%`,
          time: s.submittedAt.toISOString() });
      });

      // New quizzes, exams, assignments posted recently
      const [newQuizzes, newExams, newAssignments] = await Promise.all([
        prisma.quiz.findMany({
          where: { availableFrom: { gte: sevenDaysAgo } },
          include: { course: { select: { code: true, title: true } } },
          orderBy: { availableFrom: "desc" }, take: 3,
        }),
        prisma.exam.findMany({
          where: { isOpen: true, createdAt: { gte: sevenDaysAgo } },
          include: { course: { select: { code: true } } },
          orderBy: { createdAt: "desc" }, take: 3,
        }),
        prisma.assignment.findMany({
          where: { isOpen: true, createdAt: { gte: sevenDaysAgo } },
          include: { course: { select: { code: true } } },
          orderBy: { createdAt: "desc" }, take: 3,
        }),
      ]);
      newQuizzes.forEach(q => notifications.push({ id: `nq_${q.id}`, type: "new", icon: "quiz",
        title: `New quiz: ${q.title}`, body: `${q.course.code} · ${q.course.title}`,
        time: (q.availableFrom ?? new Date()).toISOString() }));
      newExams.forEach(e => notifications.push({ id: `ne_${e.id}`, type: "new", icon: "exam",
        title: `New exam available: ${e.title}`, body: e.course.code,
        time: e.createdAt.toISOString() }));
      newAssignments.forEach(a => notifications.push({ id: `na_${a.id}`, type: "new", icon: "assignment",
        title: `New assignment: ${a.title}`, body: a.course.code,
        time: a.createdAt.toISOString() }));

    } else if (role === "lecturer") {
      // Recent exam submissions to their courses
      const recentExamSubs = await prisma.examSubmission.findMany({
        where: { exam: { course: { lecturerId: id } }, submittedAt: { gte: oneDayAgo } },
        include: { student: { select: { fullName: true } }, exam: { select: { title: true, course: { select: { code: true } } } } },
        orderBy: { submittedAt: "desc" }, take: 8,
      });
      recentExamSubs.forEach(s => notifications.push({ id: `les_${s.id}`, type: "submission", icon: "exam",
        title: `${s.student.fullName} submitted an exam`,
        body: `${s.exam.course.code} · ${s.exam.title}`,
        time: s.submittedAt.toISOString() }));

      // Recent assignment submissions
      const recentAssignSubs = await prisma.assignmentSubmission.findMany({
        where: { assignment: { course: { lecturerId: id } }, submittedAt: { gte: oneDayAgo } },
        include: { student: { select: { fullName: true } }, assignment: { select: { title: true, course: { select: { code: true } } } } },
        orderBy: { submittedAt: "desc" }, take: 8,
      });
      recentAssignSubs.forEach(s => notifications.push({ id: `las_${s.id}`, type: "submission", icon: "assignment",
        title: `${s.student.fullName} submitted an assignment`,
        body: `${s.assignment.course.code} · ${s.assignment.title}`,
        time: s.submittedAt.toISOString() }));

      // Completed grading jobs
      const gradedToday = await prisma.examSubmission.count({
        where: { exam: { course: { lecturerId: id } }, isGraded: true, submittedAt: { gte: oneDayAgo } },
      });
      if (gradedToday > 0) {
        notifications.push({ id: "grading_done", type: "grade", icon: "grade",
          title: `${gradedToday} submission${gradedToday > 1 ? "s" : ""} graded today`,
          body: "AI grading complete — check gradebook",
          time: new Date().toISOString() });
      }
    }

    // Sort by time descending
    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return res.json(notifications.slice(0, 20));
  } catch (err) {
    console.error("Notifications error:", err);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// -------------------------------------------------------------
// SERVER AND VITE DEV SETUP
// -------------------------------------------------------------
// WEBRTC SIGNALING — Socket.io
// -------------------------------------------------------------
// Ably token endpoint — lets the browser connect to Ably without exposing the API key
app.get("/api/ably-token", authenticateToken, async (req: any, res) => {
  if (!ablyRest) return res.status(503).json({ error: "Ably not configured. Add ABLY_API_KEY to environment variables." });
  try {
    const tokenRequest = await ablyRest.auth.createTokenRequest({
      clientId: req.user.id,
      capability: { "*": ["subscribe", "publish", "presence", "history"] },
      ttl: 4 * 60 * 60 * 1000,
    });
    res.json(tokenRequest);
  } catch {
    res.status(500).json({ error: "Failed to generate Ably token" });
  }
});

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

// -------------------------------------------------------------
// DISCUSSION BOARD
// -------------------------------------------------------------

// List threads for a course (student filtered by dept+year, lecturer by ownership)
app.get("/api/courses/:id/threads", authenticateToken, async (req: any, res) => {
  try {
    const threads = await prisma.discussionThread.findMany({
      where: { courseId: req.params.id },
      include: { _count: { select: { replies: true } } },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
    return res.json(threads);
  } catch { return res.status(500).json({ error: "Failed to fetch threads" }); }
});

// Create thread
app.post("/api/courses/:id/threads", authenticateToken, async (req: any, res) => {
  const { title, body } = req.body;
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: "Title and body are required" });
  try {
    const authorName = req.user.role === "lecturer"
      ? (await prisma.lecturer.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name ?? "Lecturer"
      : (await prisma.student.findUnique({ where: { id: req.user.id }, select: { fullName: true } }))?.fullName ?? "Student";
    const thread = await prisma.discussionThread.create({
      data: { courseId: req.params.id, authorId: req.user.id, authorRole: req.user.role, authorName, title: title.trim(), body: body.trim() },
    });
    return res.status(201).json(thread);
  } catch { return res.status(500).json({ error: "Failed to create thread" }); }
});

// Get single thread with replies
app.get("/api/threads/:id", authenticateToken, async (req: any, res) => {
  try {
    const thread = await prisma.discussionThread.findUnique({
      where: { id: req.params.id },
      include: { replies: { orderBy: { createdAt: "asc" } } },
    });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    return res.json(thread);
  } catch { return res.status(500).json({ error: "Failed to fetch thread" }); }
});

// Post reply
app.post("/api/threads/:id/replies", authenticateToken, async (req: any, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Reply body is required" });
  try {
    const thread = await prisma.discussionThread.findUnique({ where: { id: req.params.id } });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const authorName = req.user.role === "lecturer"
      ? (await prisma.lecturer.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name ?? "Lecturer"
      : (await prisma.student.findUnique({ where: { id: req.user.id }, select: { fullName: true } }))?.fullName ?? "Student";
    const reply = await prisma.discussionReply.create({
      data: { threadId: req.params.id, authorId: req.user.id, authorRole: req.user.role, authorName, body: body.trim() },
    });
    return res.status(201).json(reply);
  } catch { return res.status(500).json({ error: "Failed to post reply" }); }
});

// Pin/unpin thread (lecturer only)
app.patch("/api/threads/:id/pin", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const thread = await prisma.discussionThread.findUnique({ where: { id: req.params.id }, include: { course: { select: { lecturerId: true } } } });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    if (thread.course.lecturerId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    const updated = await prisma.discussionThread.update({ where: { id: req.params.id }, data: { isPinned: !thread.isPinned } });
    return res.json(updated);
  } catch { return res.status(500).json({ error: "Failed to update thread" }); }
});

// Delete thread or reply (own posts, or lecturer for any)
app.delete("/api/threads/:id", authenticateToken, async (req: any, res) => {
  try {
    const thread = await prisma.discussionThread.findUnique({ where: { id: req.params.id } });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    if (thread.authorId !== req.user.id && req.user.role !== "lecturer") return res.status(403).json({ error: "Access denied" });
    await prisma.discussionThread.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Failed to delete thread" }); }
});

// List all threads across courses the user can access (for dashboard discussions tab)
app.get("/api/discussions", authenticateToken, async (req: any, res) => {
  try {
    let courseIds: string[] = [];
    if (req.user.role === "student") {
      const { depts, year } = await getStudentFilter(req.user.id);
      const courses = await prisma.course.findMany({
        where: {
          AND: [
            { OR: [{ departmentId: null }, { department: { name: { in: depts } } }] },
            { OR: [{ targetYear: null }, { targetYear: year }] },
          ],
        },
        select: { id: true },
      });
      courseIds = courses.map(c => c.id);
    } else {
      const courses = await prisma.course.findMany({ where: { lecturerId: req.user.id }, select: { id: true } });
      courseIds = courses.map(c => c.id);
    }
    const threads = await prisma.discussionThread.findMany({
      where: { courseId: { in: courseIds } },
      include: { course: { select: { code: true, title: true } }, _count: { select: { replies: true } } },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return res.json(threads);
  } catch { return res.status(500).json({ error: "Failed to fetch discussions" }); }
});

// -------------------------------------------------------------
// QUESTION BANK
// -------------------------------------------------------------

app.get("/api/question-bank", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { topic } = req.query;
  try {
    const questions = await prisma.bankQuestion.findMany({
      where: { lecturerId: req.user.id, ...(topic ? { topic: { contains: String(topic) } } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return res.json(questions);
  } catch { return res.status(500).json({ error: "Failed to fetch question bank" }); }
});

app.post("/api/question-bank", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  const { questions, topic } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: "questions array required" });
  try {
    const created = await prisma.bankQuestion.createMany({
      data: questions.map((q: any) => ({
        lecturerId: req.user.id,
        text: String(q.text || ""),
        optionsJson: typeof q.optionsJson === "string" ? q.optionsJson : JSON.stringify(q.options ?? []),
        correctOption: String(q.correctOption || ""),
        topic: topic ? String(topic).trim() : null,
      })),
    });
    return res.status(201).json({ saved: created.count });
  } catch { return res.status(500).json({ error: "Failed to save to question bank" }); }
});

app.delete("/api/question-bank/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Lecturers only" });
  try {
    const q = await prisma.bankQuestion.findUnique({ where: { id: req.params.id } });
    if (!q || q.lecturerId !== req.user.id) return res.status(404).json({ error: "Not found" });
    await prisma.bankQuestion.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Failed to delete" }); }
});

// Global JSON error handler — 4-param signature required for Express error middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  // Never expose internal error messages (stack traces, DB schema, file paths) to clients
  res.status(500).json({ error: "An unexpected server error occurred. Please try again." });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
