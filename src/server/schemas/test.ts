import { z } from "zod";

export const createTestSchema = z.object({
  driveId: z.string().min(1, "Drive ID is required"),
  title: z.string().min(1, "Test title is required"),
  description: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingMarks: z.number().int().min(0).optional(),
  shuffleQuestions: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  allowedDepartmentIds: z.array(z.string()).nullable().optional(),
  allowedSemesters: z.array(z.number().int().min(1).max(8)).nullable().optional(),
  allowedStudentIds: z.array(z.string()).nullable().optional(),
  resultVisibility: z.enum(["AFTER_SUBMISSION", "MANUAL_RELEASE"]).optional(),
  maxViolations: z.number().int().min(0).optional(),
  enableTabSwitchDetection: z.boolean().optional(),
  enableFullscreenDetection: z.boolean().optional(),
  enableCopyPasteDetection: z.boolean().optional(),
  enableRefreshDetection: z.boolean().optional(),
});

export const updateTestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingMarks: z.number().int().min(0).optional(),
  shuffleQuestions: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  allowedDepartmentIds: z.array(z.string()).nullable().optional(),
  allowedSemesters: z.array(z.number().int().min(1).max(8)).nullable().optional(),
  allowedStudentIds: z.array(z.string()).nullable().optional(),
  resultVisibility: z.enum(["AFTER_SUBMISSION", "MANUAL_RELEASE"]).optional(),
  showResults: z.boolean().optional(),
  maxViolations: z.number().int().min(0).optional(),
  enableTabSwitchDetection: z.boolean().optional(),
  enableFullscreenDetection: z.boolean().optional(),
  enableCopyPasteDetection: z.boolean().optional(),
  enableRefreshDetection: z.boolean().optional(),
});

export const startTestSchema = z.object({
  testId: z.string().min(1),
});

export const submitTestSchema = z.object({
  attemptId: z.string().min(1),
  autoSubmitted: z.boolean().optional(),
});
