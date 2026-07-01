import { prisma } from "./db.js";
import bcrypt from "bcryptjs";

async function migrateColumns() {
  const stmts = [
    'ALTER TABLE "Lecturer" ADD COLUMN "avatarData" TEXT',
    'ALTER TABLE "Student"  ADD COLUMN "avatarData" TEXT',
  ];
  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}

export async function seedDatabase() {
  await migrateColumns();

  try {
    // Check if there's already any student or lecturer
    const studentCount = await prisma.student.count();
    const lecturerCount = await prisma.lecturer.count();

    if (studentCount > 0 || lecturerCount > 0) {
      console.log("Database already initialized, skipping seeding.");
      return;
    }

    console.log("Seeding initial database content...");

    // Create default Departments
    const depts = [
      "Computer Science",
      "Information Technology",
      "Software Engineering",
      "Cybersecurity",
      "Electrical & Electronic Engineering",
      "Mechanical Engineering",
    ];
    for (const name of depts) {
      await prisma.department.create({
        data: { name },
      });
    }
    console.log(`Created ${depts.length} departments.`);

    // Create default Lecturer — password hashed at seed time
    const defaultLecturerPassword = process.env.SEED_LECTURER_PASSWORD || "ChangeMe@2026!";
    const lecturer = await prisma.lecturer.create({
      data: {
        name: "Dr. Charles Xavier",
        email: "xavier@futo.edu.ng",
        password: await bcrypt.hash(defaultLecturerPassword, 10),
      },
    });

    console.log(`Created Lecturer: ${lecturer.name}`);

    // Create default Students — security answers hashed at seed time
    const rawStudents = [
      {
        fullName: "John Doe",
        email: "john.doe@futo.edu.ng",
        regNumber: "FUTO/2026/10423",
        department: "Computer Science",
        year: "Year 3",
        securityQuestion: "What is your favorite academic course?",
        securityAnswer: "computer science",
      },
      {
        fullName: "Jane Smith",
        email: "jane.smith@futo.edu.ng",
        regNumber: "FUTO/2026/20512",
        department: "Information Technology",
        year: "Year 2",
        securityQuestion: "What is your favorite academic course?",
        securityAnswer: "it",
      },
      {
        fullName: "Amina Yusuf",
        email: "amina.yusuf@futo.edu.ng",
        regNumber: "FUTO/2026/30114",
        department: "Software Engineering",
        year: "Year 4",
        securityQuestion: "What is your high school name?",
        securityAnswer: "federal gc",
      },
      {
        fullName: "Chidi Okafor",
        email: "chidi.okafor@futo.edu.ng",
        regNumber: "FUTO/2026/40991",
        department: "Cybersecurity",
        year: "Year 1",
        securityQuestion: "What was your childhood nickname?",
        securityAnswer: "chidi",
      },
    ];

    for (const s of rawStudents) {
      await prisma.student.create({
        data: {
          ...s,
          securityAnswer: await bcrypt.hash(s.securityAnswer, 10),
        },
      });
    }
    console.log(`Created ${rawStudents.length} pre-registered Students.`);

    // Create Course 1: MTH 101
    const mth101 = await prisma.course.create({
      data: {
        code: "MTH101",
        title: "Elementary Mathematics I",
        lecturerId: lecturer.id,
      },
    });

    // Create Course 2: CSC 201
    const csc201 = await prisma.course.create({
      data: {
        code: "CSC201",
        title: "Introduction to Computer Programming",
        lecturerId: lecturer.id,
      },
    });

    console.log("Created default Courses.");

    // Create Lecture Note for CSC 201
    await prisma.lectureNote.create({
      data: {
        title: "Lecture 1: Introduction to Variables & Data Types",
        content: `## Introduction to Programming Concepts

Programming is the process of writing instructions that a computer can execute. In this lecture, we will cover the fundamentals of memory allocation through variables and data types.

### 1. What is a Variable?
A variable is a named storage location in memory. It has a **name** (identifier), a **type**, and a **value**.

\`\`\`python
# Declaring a variable in Python
student_name = "John Doe"
age = 21
gpa = 3.8
is_active = True
\`\`\`

### 2. Primitive Data Types
Most programming languages support the following fundamental primitive types:
- **Integer (int):** Whole numbers (e.g., -5, 0, 42)
- **Float/Double (float):** Floating point decimal numbers (e.g., 3.14, -0.001)
- **Character (char) / String (str):** Single text characters or text sequences (e.g., 'A', "Hello FUTO")
- **Boolean (bool):** True or False values

### 3. Best Practices for Naming Variables
- Use descriptive names (e.g., \`studentRegistrationNumber\` instead of \`srn\`)
- Use consistent casing rules like camelCase or snake_case
- Do not start variables with digits or special characters.
`,
        courseId: csc201.id,
      },
    });

    // Create Lecture Note for MTH 101
    await prisma.lectureNote.create({
      data: {
        title: "Lecture 1: Sets, Relations & Functions",
        content: `## Introductory Set Theory

Set theory is the branch of mathematical logic that studies sets, which are informal collections of objects.

### 1. What is a Set?
A set is a well-defined collection of distinct objects. The objects are called elements or members of the set.
- Example: $A = \\{1, 2, 3, 4, 5\\}$
- Set of even natural numbers: $E = \\{2, 4, 6, \\dots\\}$

### 2. Basic Set Operations
- **Union ($A \\cup B$):** The set containing all elements of $A$ or $B$ or both.
- **Intersection ($A \\cap B$):** The set containing all elements that belong to both $A$ and $B$.
- **Difference ($A \\setminus B$ or $A - B$):** The set containing elements of $A$ that are not in $B$.
- **Complement ($A'$ or $A^c$):** Elements in the universal set $U$ that are not in $A$.

### 3. Functions and Mappings
A relation $f$ from set $X$ to set $Y$ is a function if every element $x \\in X$ is mapped to exactly one element $y \\in Y$.
`,
        courseId: mth101.id,
      },
    });

    console.log("Created Lecture Notes.");

    // Create Quiz for CSC 201
    const quiz1 = await prisma.quiz.create({
      data: {
        title: "CSC 201 Midterm Assessment",
        durationMinutes: 10, // 10 minutes duration for easy testing
        courseId: csc201.id,
      },
    });

    // Create Questions for CSC 201 Quiz
    const questions1 = [
      {
        quizId: quiz1.id,
        text: "Which of the following is NOT a primitive data type in most mainstream programming languages?",
        optionsJson: JSON.stringify([
          "Integer",
          "Boolean",
          "Hashmap / Dictionary",
          "Float",
        ]),
        correctOption: "Hashmap / Dictionary",
      },
      {
        quizId: quiz1.id,
        text: "Which variable naming convention joins lowercase words with underscores?",
        optionsJson: JSON.stringify([
          "camelCase",
          "snake_case",
          "PascalCase",
          "kebab-case",
        ]),
        correctOption: "snake_case",
      },
      {
        quizId: quiz1.id,
        text: "What is the primary role of a compiler in programming?",
        optionsJson: JSON.stringify([
          "To design a high-fidelity user interface",
          "To translate high-level source code into machine code",
          "To secure database tables",
          "To check network bandwidth",
        ]),
        correctOption: "To translate high-level source code into machine code",
      },
      {
        quizId: quiz1.id,
        text: "Which of the following values is representing a boolean data type?",
        optionsJson: JSON.stringify([
          "\"True\"",
          "42.5",
          "True",
          "null",
        ]),
        correctOption: "True",
      }
    ];

    for (const q of questions1) {
      await prisma.question.create({
        data: q,
      });
    }

    // Create Quiz for MTH 101
    const quiz2 = await prisma.quiz.create({
      data: {
        title: "MTH 101 Pop Quiz on Set Theory",
        durationMinutes: 5, // 5 minutes duration
        courseId: mth101.id,
      },
    });

    // Questions for MTH 101 Quiz
    const questions2 = [
      {
        quizId: quiz2.id,
        text: "If Set A = {1, 2, 3} and Set B = {3, 4, 5}, what is the Intersection of A and B?",
        optionsJson: JSON.stringify([
          "{1, 2, 3, 4, 5}",
          "{3}",
          "Empty Set",
          "{1, 2, 4, 5}",
        ]),
        correctOption: "{3}",
      },
      {
        quizId: quiz2.id,
        text: "A set that contains no elements is referred to as a:",
        optionsJson: JSON.stringify([
          "Universal Set",
          "Infinite Set",
          "Null / Empty Set",
          "Subset",
        ]),
        correctOption: "Null / Empty Set",
      },
    ];

    for (const q of questions2) {
      await prisma.question.create({
        data: q,
      });
    }

    console.log("Created default Quizzes and Questions successfully!");
  } catch (err) {
    console.error("Error during database seeding:", err);
  }
}
