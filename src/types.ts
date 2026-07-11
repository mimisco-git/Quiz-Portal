export interface User {
  id: string;
  fullName?: string; // For student
  name?: string;     // For lecturer
  email?: string;    // For lecturer
  regNumber?: string; // For student
  department?: string; // For student
  year?: string;       // For student
  role: "student" | "lecturer";
  mustChangePassword?: boolean; // For student: true if they must set a new password
}

export interface Lecturer {
  id: string;
  name: string;
  email: string;
}

export interface Student {
  id: string;
  fullName: string;
  regNumber: string;
  department: string;
  year: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  lecturerId: string;
  lecturer?: Lecturer;
  notes?: LectureNote[];
  quizzes?: Quiz[];
  _count?: {
    notes: number;
    quizzes: number;
  };
}

export interface LectureNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  courseId: string;
}

export interface Quiz {
  id: string;
  title: string;
  durationMinutes: number;
  availableFrom?: string;
  availableUntil?: string;
  courseId: string;
  course?: Course;
  questions?: Question[];
  _count?: {
    questions: number;
  };
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  optionsJson: string; // Serialized string array
  correctOption?: string; // Undefined for active students
}

export interface StudentAttempt {
  id: string;
  studentId: string;
  student?: Student;
  quizId: string;
  quiz?: Quiz;
  startedAt: string;
  submittedAt?: string;
  isCompleted: boolean;
  score?: number;
  answersJson?: string;
}
