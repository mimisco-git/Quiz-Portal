/**
 * One-time migration: for every student with a null passwordHash,
 * set their password to their registration number (bcrypt cost 10)
 * and flag mustChangePassword = true so they are forced to set a
 * real password on their first login.
 *
 * Run once:  npx tsx src/lib/migrate-student-passwords.ts
 */
import { prisma } from "./db.js";
import bcrypt from "bcryptjs";

async function main() {
  const students = await prisma.student.findMany({
    where: { passwordHash: null },
    select: { id: true, regNumber: true, fullName: true },
  });

  if (students.length === 0) {
    console.log("No unmigrated students found — nothing to do.");
    return;
  }

  console.log(`Migrating ${students.length} student(s)…`);

  let success = 0;
  let failed  = 0;

  for (const student of students) {
    try {
      const passwordHash = await bcrypt.hash(student.regNumber, 10);
      await prisma.student.update({
        where: { id: student.id },
        data:  { passwordHash, mustChangePassword: true },
      });
      console.log(`  ✓ ${student.regNumber} — ${student.fullName}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${student.regNumber}: ${err}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} migrated, ${failed} failed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
