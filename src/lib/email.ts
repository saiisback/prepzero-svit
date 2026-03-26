import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env");
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments,
  });
}
