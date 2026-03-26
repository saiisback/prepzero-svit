import { z } from "zod";

export const saveAnswerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1, "Question ID is required"),
  selectedOptionIds: z.array(z.string()).default([]),
  code: z.string().max(50000).optional(),
  language: z.enum(["PYTHON", "JAVA", "C", "CPP"]).optional(),
});

export const runCodeSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1, "Question ID is required"),
  code: z.string().min(1).max(50000, "Code is too long"),
  language: z.enum(["PYTHON", "JAVA", "C", "CPP"]),
});

export const reportViolationSchema = z.object({
  attemptId: z.string().min(1),
  type: z.enum(["TAB_SWITCH", "FULLSCREEN_EXIT", "COPY_PASTE", "REFRESH"]),
});
