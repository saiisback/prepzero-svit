import { router, collegeAdminProcedure } from "../trpc";
import { downloadReportSchema, emailReportSchema } from "../schemas";
import { generateTestReportCsv } from "@/lib/report-csv";
import { sendEmail } from "@/lib/email";

export const reportRouter = router({
  download: collegeAdminProcedure
    .input(downloadReportSchema)
    .query(async ({ ctx, input }) => {
      const report = await generateTestReportCsv(input.testId, ctx.user.collegeId!);
      return {
        csv: report.csv,
        filename: report.filename,
      };
    }),

  sendEmail: collegeAdminProcedure
    .input(emailReportSchema)
    .mutation(async ({ ctx, input }) => {
      const report = await generateTestReportCsv(input.testId, ctx.user.collegeId!);

      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #1a1a1a;">Test Report: ${report.testTitle}</h2>
          <p style="color: #555;">Drive: ${report.driveTitle}</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Total Eligible</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalEligible}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Present</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalPresent}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Submitted</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalSubmitted}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Absent</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalAbsent}</td>
            </tr>
            ${report.summary.totalPassed !== null ? `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Passed</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalPassed}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Failed</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.totalFailed}</td>
            </tr>` : ""}
            ${report.summary.highestScore !== null ? `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Highest Score</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.highestScore}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Lowest Score</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${report.summary.lowestScore}</td>
            </tr>` : ""}
            ${report.summary.totalViolations > 0 ? `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><strong>Students with Violations</strong></td>
              <td style="padding: 8px 12px; border: 1px solid #e5e5e5; color: #dc2626;">${report.summary.totalViolations}</td>
            </tr>` : ""}
          </table>
          <p style="color: #777; font-size: 13px;">The detailed report is attached as a CSV file.</p>
        </div>
      `;

      await sendEmail({
        to: ctx.user.email,
        subject: `Test Report: ${report.testTitle} - ${report.driveTitle}`,
        html: htmlBody,
        attachments: [
          {
            filename: report.filename,
            content: report.csv,
            contentType: "text/csv",
          },
        ],
      });

      return { success: true };
    }),
});
