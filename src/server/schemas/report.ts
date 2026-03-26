import { z } from "zod";

export const downloadReportSchema = z.object({
  testId: z.string().min(1, "Test ID is required"),
});

export const emailReportSchema = z.object({
  testId: z.string().min(1, "Test ID is required"),
});
