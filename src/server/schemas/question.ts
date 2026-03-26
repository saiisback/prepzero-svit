import { z } from "zod";

export const optionSchema = z.object({
  id: z.string().min(1, "Option ID is required"),
  text: z.string().min(1, "Option text is required"),
});

export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string().min(1, "Expected output is required"),
  isSample: z.boolean().default(false),
  order: z.number().int().default(0),
});

const baseQuestionFields = {
  questionText: z.string().min(1, "Question text is required"),
  imageUrl: z.string().optional(),
  marks: z.number().int().positive().optional(),
  negativeMarks: z.number().min(0).optional(),
  explanation: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  codeBlock: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
};

export const mcqQuestionSchema = z.object({
  ...baseQuestionFields,
  questionType: z.enum(["SINGLE_SELECT", "MULTI_SELECT"]),
  options: z.array(optionSchema).min(2, "At least 2 options required"),
  correctOptionIds: z.array(z.string()).min(1, "At least 1 correct option required"),
});

export const codingQuestionSchema = z.object({
  ...baseQuestionFields,
  questionType: z.literal("CODING"),
  testCases: z.array(testCaseSchema).min(1, "At least 1 test case required"),
  defaultCode: z.string().optional(),
  allowedLanguages: z.array(z.enum(["PYTHON", "JAVA", "C", "CPP"])).optional(),
});

export const questionSchema = z.discriminatedUnion("questionType", [
  mcqQuestionSchema.extend({ questionType: z.literal("SINGLE_SELECT") }),
  mcqQuestionSchema.extend({ questionType: z.literal("MULTI_SELECT") }),
  codingQuestionSchema,
]);

export const bulkQuestionSchema = z.object({
  testId: z.string().min(1),
  questions: z.array(questionSchema).min(1).max(100),
});
