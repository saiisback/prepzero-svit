import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildEligibleStudentsWhere } from "@/lib/test-eligibility";

interface NotificationResult {
  testId: string;
  title: string;
  emailsSent: number;
}

/**
 * Find all published tests starting within the next 15 minutes
 * that haven't been notified yet, and send email reminders to eligible students.
 */
export async function sendTestNotifications() {
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  const tests = await prisma.test.findMany({
    where: {
      status: "PUBLISHED",
      notificationSent: { equals: false },
      startTime: {
        not: { equals: null },
        lte: fifteenMinutesFromNow,
        gt: now,
      },
    },
    include: {
      drive: {
        select: {
          title: true,
          companyName: true,
          collegeId: true,
          college: { select: { name: true } },
        },
      },
    },
  });

  if (tests.length === 0) {
    return { message: "No tests to notify", notified: 0, totalEmailsSent: 0, details: [] };
  }

  let totalEmailsSent = 0;
  const results: NotificationResult[] = [];

  for (const test of tests) {
    const emailsSent = await notifyStudentsForTest(test, now);

    await prisma.test.update({
      where: { id: test.id },
      data: { notificationSent: true },
    });

    totalEmailsSent += emailsSent;
    results.push({ testId: test.id, title: test.title, emailsSent });
  }

  return {
    message: `Notified ${results.length} test(s)`,
    notified: results.length,
    totalEmailsSent,
    details: results,
  };
}

/**
 * Send notification for a single specific test (by ID).
 * Used when a test is published or its startTime is set/changed.
 */
export async function sendNotificationForTest(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      drive: {
        select: {
          title: true,
          companyName: true,
          collegeId: true,
          college: { select: { name: true } },
        },
      },
    },
  });

  if (!test) return;
  if (test.status !== "PUBLISHED") return;
  if (!test.startTime) return;
  if (test.notificationSent) return;

  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  // Only send if test starts within the next 15 minutes
  if (test.startTime <= now || test.startTime > fifteenMinutesFromNow) return;

  const emailsSent = await notifyStudentsForTest(test, now);

  await prisma.test.update({
    where: { id: testId },
    data: { notificationSent: true },
  });

  console.log(`Notification sent for test "${test.title}": ${emailsSent} emails`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyStudentsForTest(test: any, now: Date): Promise<number> {
  const where = buildEligibleStudentsWhere(test, test.drive.collegeId);
  const students = await prisma.user.findMany({
    where,
    select: { email: true, name: true },
  });

  if (students.length === 0) return 0;

  const startTimeFormatted = test.startTime!.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const minutesUntilStart = Math.round(
    (test.startTime!.getTime() - now.getTime()) / (60 * 1000)
  );

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #fff; margin: 0;">Test Reminder</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #1a1a1a;">
          Your test <strong>${test.title}</strong> is starting in <strong>${minutesUntilStart} minutes</strong>!
        </p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5; background: #f9fafb;"><strong>Test</strong></td>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${test.title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5; background: #f9fafb;"><strong>Drive</strong></td>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${test.drive.title}${test.drive.companyName ? ` (${test.drive.companyName})` : ""}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5; background: #f9fafb;"><strong>Start Time</strong></td>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${startTimeFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5; background: #f9fafb;"><strong>Duration</strong></td>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${test.durationMinutes} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5; background: #f9fafb;"><strong>College</strong></td>
            <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${test.drive.college.name}</td>
          </tr>
        </table>
        <p style="color: #555; font-size: 14px;">Please log in to your dashboard and be ready before the test starts. Make sure you have a stable internet connection and your browser is up to date.</p>
        <div style="margin-top: 20px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student"
             style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
          This is an automated notification from PrepZero. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  const BATCH_SIZE = 10;
  let emailsSent = 0;

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    const emailPromises = batch.map((student) =>
      sendEmail({
        to: student.email,
        subject: `Reminder: "${test.title}" starts in ${minutesUntilStart} minutes`,
        html: htmlBody,
      }).catch((err) => {
        console.error(`Failed to send notification to ${student.email}:`, err);
        return null;
      })
    );

    const settled = await Promise.allSettled(emailPromises);
    emailsSent += settled.filter((r) => r.status === "fulfilled" && r.value !== null).length;
  }

  return emailsSent;
}
