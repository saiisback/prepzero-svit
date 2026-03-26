import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  // ── College ──────────────────────────────────────────────
  const college = await prisma.college.upsert({
    where: { code: "DEMO2026" },
    update: {},
    create: {
      name: "Demo Engineering College",
      code: "DEMO2026",
      address: "123 Education Street",
      website: "https://demo-college.edu",
      contactEmail: "admin@demo-college.edu",
      contactPhone: "+1234567890",
      isActive: true,
    },
  });
  console.log("College:", college.name, `(${college.code})`);

  // ── Users ────────────────────────────────────────────────
  async function createUser(
    name: string,
    email: string,
    password: string,
    role: "SUPER_ADMIN" | "COLLEGE_ADMIN" | "STUDENT",
    collegeId?: string
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`  ✓ ${role}: ${email} (already exists)`);
      return existing;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: true,
        role,
        collegeId: collegeId || null,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    console.log(`  + ${role}: ${email} / ${password}`);
    return user;
  }

  const admin = await createUser("Super Admin", "admin@prepzero.com", "admin123456", "SUPER_ADMIN");
  const collegeAdmin = await createUser("College Admin", "college@demo.com", "college123456", "COLLEGE_ADMIN", college.id);
  const student = await createUser("Test Student", "student@demo.com", "student123456", "STUDENT", college.id);

  // ── Placement Drive ──────────────────────────────────────
  let drive = await prisma.placementDrive.findFirst({
    where: { collegeId: college.id, title: "TechCorp Campus Drive 2026" },
  });

  if (!drive) {
    drive = await prisma.placementDrive.create({
      data: {
        collegeId: college.id,
        title: "TechCorp Campus Drive 2026",
        description: "Campus recruitment drive by TechCorp for SDE roles.",
        companyName: "TechCorp",
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("\n  + Drive:", drive.title);
  } else {
    console.log("\n  ✓ Drive:", drive.title, "(already exists)");
  }

  // ── Test ─────────────────────────────────────────────────
  let test = await prisma.test.findFirst({
    where: { driveId: drive.id, title: "Aptitude Round 1" },
  });

  if (!test) {
    test = await prisma.test.create({
      data: {
        driveId: drive.id,
        title: "Aptitude Round 1",
        description: "Basic aptitude and logical reasoning test.",
        instructions: "Answer all questions. No negative marking. Proctoring is enabled — do not switch tabs or exit fullscreen.",
        durationMinutes: 30,
        totalMarks: 5,
        passingMarks: 3,
        status: "PUBLISHED",
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("  + Test:", test.title);

    // ── Questions ────────────────────────────────────────────
    const questions = [
      {
        questionText: "What is the next number in the series: 2, 6, 12, 20, 30, ?",
        questionType: "SINGLE_SELECT" as const,
        options: [
          { id: "q1a", text: "40" },
          { id: "q1b", text: "42" },
          { id: "q1c", text: "38" },
          { id: "q1d", text: "44" },
        ],
        correctOptionIds: ["q1b"],
        marks: 1,
        explanation: "The differences are 4, 6, 8, 10, 12. So next is 30+12=42.",
      },
      {
        questionText: "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies?",
        questionType: "SINGLE_SELECT" as const,
        options: [
          { id: "q2a", text: "True" },
          { id: "q2b", text: "False" },
          { id: "q2c", text: "Cannot be determined" },
          { id: "q2d", text: "Partially true" },
        ],
        correctOptionIds: ["q2a"],
        marks: 1,
        explanation: "This is a classic syllogism — if A⊂B and B⊂C, then A⊂C.",
      },
      {
        questionText: "A train 150m long passes a pole in 15 seconds. What is its speed in km/h?",
        questionType: "SINGLE_SELECT" as const,
        options: [
          { id: "q3a", text: "36 km/h" },
          { id: "q3b", text: "40 km/h" },
          { id: "q3c", text: "30 km/h" },
          { id: "q3d", text: "45 km/h" },
        ],
        correctOptionIds: ["q3a"],
        marks: 1,
        explanation: "Speed = 150/15 = 10 m/s = 10 × 3.6 = 36 km/h.",
      },
      {
        questionText: "Which of the following are prime numbers? (Select all that apply)",
        questionType: "MULTI_SELECT" as const,
        options: [
          { id: "q4a", text: "2" },
          { id: "q4b", text: "15" },
          { id: "q4c", text: "23" },
          { id: "q4d", text: "9" },
        ],
        correctOptionIds: ["q4a", "q4c"],
        marks: 1,
        explanation: "2 and 23 are prime. 15=3×5 and 9=3×3 are not.",
      },
      {
        questionText: "What is 25% of 80?",
        questionType: "SINGLE_SELECT" as const,
        options: [
          { id: "q5a", text: "15" },
          { id: "q5b", text: "20" },
          { id: "q5c", text: "25" },
          { id: "q5d", text: "30" },
        ],
        correctOptionIds: ["q5b"],
        marks: 1,
        explanation: "25% of 80 = 0.25 × 80 = 20.",
      },
    ];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await prisma.question.create({
        data: {
          testId: test.id,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctOptionIds: q.correctOptionIds,
          marks: q.marks,
          negativeMarks: 0,
          explanation: q.explanation,
          order: i + 1,
        },
      });
    }
    console.log(`  + ${questions.length} questions created`);
  } else {
    console.log("  ✓ Test:", test.title, "(already exists)");
  }

  // ── Clean up any old attempts so student can retake ──────
  await prisma.testAttempt.deleteMany({
    where: { studentId: student.id, testId: test.id },
  });
  console.log("  ~ Cleared previous attempts for student");

  // ── Done ─────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("  Seed complete! Test accounts:");
  console.log("========================================");
  console.log("  Super Admin:   admin@prepzero.com    / admin123456");
  console.log("  College Admin: college@demo.com      / college123456");
  console.log("  Student:       student@demo.com      / student123456");
  console.log("  College Code:  DEMO2026");
  console.log("========================================");
  console.log("\nTo test proctoring:");
  console.log("  1. Login as student@demo.com");
  console.log("  2. Open 'Aptitude Round 1' test");
  console.log("  3. Try switching tabs, Ctrl+C, exiting fullscreen");
  console.log("  4. Login as college@demo.com to see violations in results");
  console.log("========================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
