import { z } from "zod";
import { optionSchema, testCaseSchema } from "./question";

const baseLibraryFields = {
  questionText: z.string().min(1, "Question text is required"),
  marks: z.number().int().positive().default(1),
  negativeMarks: z.number().min(0).default(0),
  explanation: z.string().optional().nullable(),
  categories: z.array(z.string().min(1)).min(1, "At least 1 category required"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  scope: z.enum(["global", "private"]).default("global"),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
};

export const libraryMcqSchema = z.object({
  ...baseLibraryFields,
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT"]),
  options: z.array(optionSchema).min(2, "At least 2 options required"),
  correctOptionIds: z.array(z.string()).min(1, "At least 1 correct option required"),
});

export const libraryCodingSchema = z.object({
  ...baseLibraryFields,
  questionType: z.literal("CODING"),
  testCases: z.array(testCaseSchema).min(1, "At least 1 test case required"),
});

export const libraryQuestionSchema = z.discriminatedUnion("questionType", [
  libraryMcqSchema.extend({ questionType: z.literal("SINGLE_SELECT") }),
  libraryMcqSchema.extend({ questionType: z.literal("MULTI_SELECT") }),
  libraryCodingSchema,
]);

export const bulkLibraryQuestionSchema = z.object({
  questions: z.array(libraryMcqSchema).min(1).max(100),
  scope: z.enum(["global", "private"]).default("global"),
});

export const importToTestSchema = z.object({
  testId: z.string().min(1, "Test ID is required"),
  questionIds: z.array(z.string()).min(1, "At least 1 question required"),
});

export const saveFromTestSchema = z.object({
  testId: z.string().min(1, "Test ID is required"),
  questionIds: z.array(z.string()).min(1, "At least 1 question required"),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Category name is required").max(100),
});

export const libraryFilterSchema = z.object({
  scope: z.enum(["global", "college"]).optional(),
  category: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT", "CODING"]).optional(),
  search: z.string().optional(),
});
