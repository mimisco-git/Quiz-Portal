/**
 * Demo Deployment Seed Script
 *
 * Run this against a SEPARATE database used only for the public demo instance.
 * Do NOT run against the production FUTO database.
 *
 * Usage:
 *   TURSO_DATABASE_URL="libsql://your-demo-db.turso.io" \
 *   TURSO_AUTH_TOKEN="your-demo-token" \
 *   JWT_SECRET="any-secret" \
 *   npx tsx src/lib/seed-demo.ts
 */

import { prisma } from "./db.js";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "demo1234";
const DEMO_LECTURER_PW = "Demo@Lecturer2026";

async function main() {
  const existingStudents = await prisma.student.count();
  const existingLecturers = await prisma.lecturer.count();
  if (existingStudents > 0 || existingLecturers > 0) {
    console.log("Database already seeded — delete all rows first if you want to re-seed.");
    return;
  }

  console.log("Seeding demo database...\n");

  // ── Departments ────────────────────────────────────────────────────
  const deptNames = [
    "Computer Science",
    "Information Technology",
    "Software Engineering",
    "Cybersecurity",
    "Electrical & Electronic Engineering",
    "Mechanical Engineering",
  ];
  for (const name of deptNames) {
    await prisma.department.create({ data: { name } });
  }
  console.log(`Created ${deptNames.length} departments.`);

  // ── Lecturers ──────────────────────────────────────────────────────
  const [lecturerPwHash, lecturerPwHash2] = await Promise.all([
    bcrypt.hash(DEMO_LECTURER_PW, 10),
    bcrypt.hash("Demo@Lecturer2026", 10),
  ]);

  const ada = await prisma.lecturer.create({
    data: {
      name: "Dr. Ada Okonkwo",
      email: "ada.okonkwo@demo.edu.ng",
      password: lecturerPwHash,
      departments: JSON.stringify(["Computer Science", "Software Engineering"]),
    },
  });

  const emeka = await prisma.lecturer.create({
    data: {
      name: "Prof. Emeka Nwosu",
      email: "emeka.nwosu@demo.edu.ng",
      password: lecturerPwHash2,
      departments: JSON.stringify(["Electrical & Electronic Engineering", "Information Technology"]),
    },
  });

  console.log(`Created 2 lecturers: ${ada.name}, ${emeka.name}`);

  // ── Students ───────────────────────────────────────────────────────
  const secAnswerHash = await bcrypt.hash("futo", 10);
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const studentData = [
    { fullName: "Chisom Eze",          email: "chisom.eze@demo.edu.ng",        regNumber: "DEMO/2023/00101", department: "Computer Science",                year: "Year 2" },
    { fullName: "Tunde Adeyemi",        email: "tunde.adeyemi@demo.edu.ng",     regNumber: "DEMO/2023/00102", department: "Computer Science",                year: "Year 2" },
    { fullName: "Ngozi Okafor",         email: "ngozi.okafor@demo.edu.ng",      regNumber: "DEMO/2023/00103", department: "Software Engineering",            year: "Year 3" },
    { fullName: "Ifeanyi Madu",         email: "ifeanyi.madu@demo.edu.ng",      regNumber: "DEMO/2023/00104", department: "Information Technology",          year: "Year 1" },
    { fullName: "Amaka Obiora",         email: "amaka.obiora@demo.edu.ng",      regNumber: "DEMO/2023/00105", department: "Cybersecurity",                   year: "Year 4" },
    { fullName: "Seun Falola",          email: "seun.falola@demo.edu.ng",       regNumber: "DEMO/2023/00106", department: "Computer Science",                year: "Year 1" },
    { fullName: "Blessing Nwachukwu",   email: "blessing.nwachukwu@demo.edu.ng",regNumber: "DEMO/2023/00107", department: "Electrical & Electronic Engineering", year: "Year 2" },
    { fullName: "Kelechi Udo",          email: "kelechi.udo@demo.edu.ng",       regNumber: "DEMO/2023/00108", department: "Software Engineering",            year: "Year 2" },
    { fullName: "Favour Obi",           email: "favour.obi@demo.edu.ng",        regNumber: "DEMO/2023/00109", department: "Mechanical Engineering",          year: "Year 3" },
    { fullName: "Chinonso Chukwu",      email: "chinonso.chukwu@demo.edu.ng",   regNumber: "DEMO/2023/00110", department: "Computer Science",                year: "Year 4" },
  ];

  const students = [];
  for (const s of studentData) {
    const student = await prisma.student.create({
      data: {
        ...s,
        passwordHash: pwHash,
        mustChangePassword: false,
        securityQuestion: "What is your university name?",
        securityAnswer: secAnswerHash,
      },
    });
    students.push(student);
  }
  console.log(`Created ${students.length} students. All login with password: ${DEMO_PASSWORD}`);

  // ── Courses ────────────────────────────────────────────────────────
  const csc201 = await prisma.course.create({
    data: { code: "CSC201", title: "Introduction to Computer Programming", lecturerId: ada.id, targetYear: "Year 2" },
  });
  const csc301 = await prisma.course.create({
    data: { code: "CSC301", title: "Data Structures and Algorithms", lecturerId: ada.id, targetYear: "Year 3" },
  });
  const eet101 = await prisma.course.create({
    data: { code: "EET101", title: "Circuit Theory and Electronics", lecturerId: emeka.id, targetYear: "Year 1" },
  });
  const it201 = await prisma.course.create({
    data: { code: "IT201", title: "Database Management Systems", lecturerId: emeka.id, targetYear: "Year 2" },
  });
  console.log("Created 4 courses.");

  // ── Lecture Notes ──────────────────────────────────────────────────
  await prisma.lectureNote.create({
    data: {
      title: "Lecture 1: Variables and Data Types",
      courseId: csc201.id,
      content: `## Variables and Data Types

A **variable** is a named storage location in memory. Every variable has a name (identifier), a type, and a value.

### Primitive Data Types

| Type | Description | Example |
|------|-------------|---------|
| \`int\` | Whole numbers | \`42\`, \`-7\` |
| \`float\` | Decimal numbers | \`3.14\`, \`-0.5\` |
| \`bool\` | True or False | \`True\`, \`False\` |
| \`str\` | Text sequences | \`"Hello FUTO"\` |

### Declaring Variables in Python

\`\`\`python
student_name = "Chisom Eze"
registration_number = "DEMO/2023/00101"
gpa = 4.2
is_enrolled = True
\`\`\`

### Naming Conventions

- **snake_case**: \`student_name\`, \`course_code\` — Python standard
- **camelCase**: \`studentName\`, \`courseCode\` — JavaScript/Java standard
- **PascalCase**: \`StudentRecord\`, \`CourseManager\` — class names

> **Rule**: Use descriptive names. \`student_registration_number\` is better than \`srn\`.
`,
    },
  });

  await prisma.lectureNote.create({
    data: {
      title: "Lecture 2: Control Flow - if/else and Loops",
      courseId: csc201.id,
      content: `## Control Flow

Control flow determines the order in which a program's statements are executed.

### Conditional Statements

\`\`\`python
score = 75

if score >= 70:
    print("You passed!")
elif score >= 50:
    print("Borderline — please study harder.")
else:
    print("You did not pass. See your lecturer.")
\`\`\`

### For Loops

\`\`\`python
students = ["Chisom", "Tunde", "Ngozi", "Ifeanyi"]

for name in students:
    print(f"Welcome, {name}!")
\`\`\`

### While Loops

\`\`\`python
attempts = 0

while attempts < 3:
    password = input("Enter password: ")
    if password == "correct":
        print("Access granted")
        break
    attempts += 1
else:
    print("Account locked after 3 failed attempts.")
\`\`\`
`,
    },
  });

  await prisma.lectureNote.create({
    data: {
      title: "Lecture 1: Arrays and Linked Lists",
      courseId: csc301.id,
      content: `## Linear Data Structures

### Arrays

An **array** is a contiguous block of memory storing elements of the same type.

- **Access**: O(1) — direct index lookup
- **Search**: O(n) — must scan each element
- **Insert/Delete (end)**: O(1)
- **Insert/Delete (middle)**: O(n) — requires shifting

\`\`\`python
scores = [78, 92, 65, 88, 74]
print(scores[2])   # 65 — O(1) access
scores.append(91)  # O(1) insert at end
scores.insert(2, 70)  # O(n) insert in middle
\`\`\`

### Singly Linked Lists

Each node stores data and a pointer to the next node.

\`\`\`python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def prepend(self, data):       # O(1)
        node = Node(data)
        node.next = self.head
        self.head = node

    def append(self, data):        # O(n) — must traverse to tail
        node = Node(data)
        if not self.head:
            self.head = node; return
        cur = self.head
        while cur.next:
            cur = cur.next
        cur.next = node
\`\`\`

### Comparison

| Operation | Array | Linked List |
|-----------|-------|-------------|
| Access by index | O(1) | O(n) |
| Insert at head | O(n) | O(1) |
| Insert at tail | O(1) amortized | O(n) |
| Memory overhead | Low | High (pointers) |
`,
    },
  });

  await prisma.lectureNote.create({
    data: {
      title: "Lecture 1: Introduction to Databases and SQL",
      courseId: it201.id,
      content: `## Database Management Systems

A **DBMS** is software that manages structured collections of data. It provides mechanisms for storage, retrieval, and modification of data.

### Relational Model

Data is organised into **tables** (relations) with rows (tuples) and columns (attributes).

\`\`\`sql
CREATE TABLE students (
    id          TEXT PRIMARY KEY,
    full_name   TEXT NOT NULL,
    reg_number  TEXT UNIQUE NOT NULL,
    department  TEXT NOT NULL,
    year        TEXT NOT NULL
);
\`\`\`

### Basic SQL Operations

\`\`\`sql
-- Insert a student
INSERT INTO students (id, full_name, reg_number, department, year)
VALUES ('uuid-1', 'Chisom Eze', 'DEMO/2023/00101', 'Computer Science', 'Year 2');

-- Query all CS Year 2 students
SELECT full_name, reg_number
FROM students
WHERE department = 'Computer Science' AND year = 'Year 2'
ORDER BY full_name;

-- Update a record
UPDATE students SET year = 'Year 3' WHERE reg_number = 'DEMO/2023/00101';

-- Delete a record
DELETE FROM students WHERE reg_number = 'DEMO/2023/00101';
\`\`\`

### Keys and Constraints

- **Primary Key**: Uniquely identifies each row. Cannot be NULL.
- **Foreign Key**: References the primary key of another table — enforces referential integrity.
- **UNIQUE**: Guarantees no two rows share the same value in that column.
- **NOT NULL**: Prevents missing values in a required column.
`,
    },
  });

  console.log("Created 4 lecture notes.");

  // ── Quizzes ────────────────────────────────────────────────────────
  const quiz1 = await prisma.quiz.create({
    data: { title: "CSC201 Quiz 1: Fundamentals", durationMinutes: 15, courseId: csc201.id },
  });

  const q1 = [
    {
      text: "Which of the following is NOT a primitive data type in most mainstream programming languages?",
      options: ["Integer", "Boolean", "Dictionary / HashMap", "Float"],
      correct: "Dictionary / HashMap",
    },
    {
      text: "What does the following Python expression evaluate to?  bool(0)",
      options: ["True", "False", "0", "None"],
      correct: "False",
    },
    {
      text: "Which variable naming convention uses underscores between lowercase words?",
      options: ["camelCase", "PascalCase", "snake_case", "kebab-case"],
      correct: "snake_case",
    },
    {
      text: "What is the output of:  print(type(3.14))",
      options: ["<class 'int'>", "<class 'float'>", "<class 'double'>", "<class 'str'>"],
      correct: "<class 'float'>",
    },
    {
      text: "In Python, which keyword is used to define a function?",
      options: ["function", "fn", "def", "fun"],
      correct: "def",
    },
    {
      text: "What is the result of:  10 % 3",
      options: ["3", "1", "0", "3.33"],
      correct: "1",
    },
  ];

  for (const q of q1) {
    await prisma.question.create({
      data: { quizId: quiz1.id, text: q.text, optionsJson: JSON.stringify(q.options), correctOption: q.correct },
    });
  }

  const quiz2 = await prisma.quiz.create({
    data: { title: "CSC201 Quiz 2: Control Flow", durationMinutes: 12, courseId: csc201.id },
  });

  const q2 = [
    {
      text: "Which loop is best suited when the number of iterations is known in advance?",
      options: ["while loop", "do-while loop", "for loop", "recursive call"],
      correct: "for loop",
    },
    {
      text: "What does the `break` statement do inside a loop?",
      options: [
        "Skips the current iteration and continues to the next",
        "Exits the loop immediately",
        "Restarts the loop from the beginning",
        "Pauses execution for one second",
      ],
      correct: "Exits the loop immediately",
    },
    {
      text: "What is the output of this code?\n\nfor i in range(3):\n    print(i)",
      options: ["1 2 3", "0 1 2", "0 1 2 3", "1 2"],
      correct: "0 1 2",
    },
    {
      text: "Which operator checks equality in Python?",
      options: ["=", ":=", "==", "==="],
      correct: "==",
    },
  ];

  for (const q of q2) {
    await prisma.question.create({
      data: { quizId: quiz2.id, text: q.text, optionsJson: JSON.stringify(q.options), correctOption: q.correct },
    });
  }

  const quiz3 = await prisma.quiz.create({
    data: { title: "CSC301 Quiz: Data Structures Basics", durationMinutes: 20, courseId: csc301.id },
  });

  const q3 = [
    {
      text: "What is the time complexity of accessing an element in an array by index?",
      options: ["O(n)", "O(log n)", "O(1)", "O(n²)"],
      correct: "O(1)",
    },
    {
      text: "In a singly linked list, which operation runs in O(1) time?",
      options: ["Access by index", "Insert at tail", "Insert at head", "Search for a value"],
      correct: "Insert at head",
    },
    {
      text: "Which data structure follows the LIFO (Last-In First-Out) principle?",
      options: ["Queue", "Stack", "Array", "Linked List"],
      correct: "Stack",
    },
    {
      text: "What is the worst-case time complexity of binary search?",
      options: ["O(n)", "O(n log n)", "O(1)", "O(log n)"],
      correct: "O(log n)",
    },
    {
      text: "Which of the following is true about a doubly linked list compared to a singly linked list?",
      options: [
        "It uses less memory",
        "Each node has pointers to both previous and next nodes",
        "It only allows traversal in one direction",
        "Insertion is always O(1)",
      ],
      correct: "Each node has pointers to both previous and next nodes",
    },
  ];

  for (const q of q3) {
    await prisma.question.create({
      data: { quizId: quiz3.id, text: q.text, optionsJson: JSON.stringify(q.options), correctOption: q.correct },
    });
  }

  const quiz4 = await prisma.quiz.create({
    data: { title: "IT201 Quiz: SQL and Relational Model", durationMinutes: 15, courseId: it201.id },
  });

  const q4 = [
    {
      text: "Which SQL clause is used to filter rows returned by a SELECT statement?",
      options: ["HAVING", "ORDER BY", "WHERE", "GROUP BY"],
      correct: "WHERE",
    },
    {
      text: "What does the PRIMARY KEY constraint enforce?",
      options: [
        "All values must be positive numbers",
        "Each row is uniquely identified and values cannot be NULL",
        "Values must match a value in a related table",
        "The column can only contain text values",
      ],
      correct: "Each row is uniquely identified and values cannot be NULL",
    },
    {
      text: "Which SQL statement is used to add a new row to a table?",
      options: ["UPDATE", "ADD", "INSERT INTO", "CREATE ROW"],
      correct: "INSERT INTO",
    },
    {
      text: "What does a FOREIGN KEY enforce?",
      options: [
        "Uniqueness within a column",
        "Referential integrity between two tables",
        "Alphabetical ordering of data",
        "That all values are non-null",
      ],
      correct: "Referential integrity between two tables",
    },
  ];

  for (const q of q4) {
    await prisma.question.create({
      data: { quizId: quiz4.id, text: q.text, optionsJson: JSON.stringify(q.options), correctOption: q.correct },
    });
  }

  console.log("Created 4 quizzes with questions.");

  // ── Sample Quiz Attempts (history for demo students) ───────────────
  const allQuizzes = [quiz1, quiz2, quiz3, quiz4];
  const sampleAttempts = [
    { studentIdx: 0, quizIdx: 0, score: 83.3  },
    { studentIdx: 0, quizIdx: 1, score: 75.0  },
    { studentIdx: 1, quizIdx: 0, score: 66.7  },
    { studentIdx: 2, quizIdx: 2, score: 80.0  },
    { studentIdx: 3, quizIdx: 3, score: 100.0 },
    { studentIdx: 4, quizIdx: 0, score: 50.0  },
    { studentIdx: 5, quizIdx: 1, score: 100.0 },
    { studentIdx: 7, quizIdx: 2, score: 60.0  },
    { studentIdx: 9, quizIdx: 0, score: 90.0  },
  ];

  for (const a of sampleAttempts) {
    const st = students[a.studentIdx];
    const qz = allQuizzes[a.quizIdx];
    await prisma.studentAttempt.create({
      data: {
        studentId:   st.id,
        quizId:      qz.id,
        isCompleted: true,
        score:       a.score,
        startedAt:   new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(),
        answersJson: JSON.stringify({}),
      },
    });
  }
  console.log(`Created ${sampleAttempts.length} sample quiz attempts.`);

  // ── Assignments ────────────────────────────────────────────────────
  await prisma.assignment.create({
    data: {
      title: "Programming Assignment 1",
      courseId: csc201.id,
      description: "Write a Python program that reads student scores and computes the average, highest, and lowest scores.",
      questionsText: "Q1. Define the problem.\nQ2. Write pseudocode.\nQ3. Write the Python code.\nQ4. Test with sample data.",
      isOpen: true,
    },
  });

  await prisma.assignment.create({
    data: {
      title: "Database Design Exercise",
      courseId: it201.id,
      description: "Design a database schema for a university library management system.",
      questionsText: "Q1. List the entities and their attributes.\nQ2. Draw the ER diagram.\nQ3. Write CREATE TABLE statements for all entities.\nQ4. Write 3 useful SELECT queries.",
      isOpen: true,
    },
  });

  console.log("Created 2 assignments.");

  // ── Discussion Threads ─────────────────────────────────────────────
  const thread1 = await prisma.discussionThread.create({
    data: {
      courseId:   csc201.id,
      authorId:   students[0].id,
      authorRole: "student",
      authorName: students[0].fullName,
      title: "Difference between `==` and `is` in Python?",
      body: "I keep getting confused about when to use `==` vs `is`. Can someone explain with an example?",
    },
  });

  await prisma.discussionReply.create({
    data: {
      threadId:   thread1.id,
      authorId:   ada.id,
      authorRole: "lecturer",
      authorName: ada.name,
      body: "`==` checks value equality (do two objects have the same value?), while `is` checks identity (are they the exact same object in memory?). Example: `[1,2] == [1,2]` is `True`, but `[1,2] is [1,2]` is `False` because they are two different list objects.",
    },
  });

  await prisma.discussionReply.create({
    data: {
      threadId:   thread1.id,
      authorId:   students[1].id,
      authorRole: "student",
      authorName: students[1].fullName,
      body: "Thanks! So we should always use `==` when comparing values and only use `is` for checking against `None` like `if x is None:`?",
    },
  });

  const thread2 = await prisma.discussionThread.create({
    data: {
      courseId:   csc301.id,
      authorId:   students[2].id,
      authorRole: "student",
      authorName: students[2].fullName,
      title: "When should I choose a linked list over an array?",
      body: "Both seem to do the same thing. What is the practical use case for preferring a linked list?",
      isPinned: true,
    },
  });

  await prisma.discussionReply.create({
    data: {
      threadId:   thread2.id,
      authorId:   ada.id,
      authorRole: "lecturer",
      authorName: ada.name,
      body: "Great question! Choose a linked list when: (1) you frequently insert or delete from the beginning or middle — it's O(1) at the head vs O(n) for an array. (2) You don't know the size in advance and want to avoid resizing cost. Choose an array when: you need random access by index (O(1) vs O(n) for lists), or memory locality matters for performance.",
    },
  });

  console.log("Created 2 discussion threads with replies.");

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`
Demo seed complete!

Lecturers:
  email: ada.okonkwo@demo.edu.ng   password: ${DEMO_LECTURER_PW}
  email: emeka.nwosu@demo.edu.ng   password: ${DEMO_LECTURER_PW}

Students (all use password: ${DEMO_PASSWORD}):
${studentData.map(s => `  reg: ${s.regNumber}  name: ${s.fullName}`).join("\n")}
`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
