import { parseCSV, type CSVParseError } from "./csv-parser";

export interface LibraryCSVQuestion {
  questionText: string;
  codeBlock?: string;
  codeLanguage?: string;
  imageUrls?: string[];
  questionType: "SINGLE_SELECT" | "MULTI_SELECT";
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  marks: number;
  negativeMarks: number;
  explanation?: string;
  categories: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

const EXPECTED_HEADERS = [
  "question_text",
  "option_1",
  "option_2",
  "option_3",
  "option_4",
  "correct_answers",
  "question_type",
  "marks",
  "negative_marks",
  "explanation",
  "categories",
  "difficulty",
];

/**
 * Parse and validate a CSV string into library MCQ questions with category/difficulty.
 */
export function parseLibraryQuestionsCSV(text: string): {
  questions: LibraryCSVQuestion[];
  errors: CSVParseError[];
} {
  const rows = parseCSV(text);
  const questions: LibraryCSVQuestion[] = [];
  const errors: CSVParseError[] = [];

  if (rows.length === 0) {
    errors.push({ row: 0, message: "CSV file is empty" });
    return { questions, errors };
  }

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    errors.push({
      row: 1,
      message: `Missing headers: ${missingHeaders.join(", ")}`,
    });
    return { questions, errors };
  }

  const colIndex = (name: string) => header.indexOf(name);
  const idBase = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    while (row.length < header.length) {
      row.push("");
    }

    const questionText = row[colIndex("question_text")];
    if (!questionText) {
      errors.push({ row: rowNum, message: "Question text is empty" });
      continue;
    }

    // New optional columns
    const codeBlockIdx = header.indexOf("code_block");
    const codeBlock = codeBlockIdx !== -1 ? row[codeBlockIdx]?.trim() || undefined : undefined;
    const codeLangIdx = header.indexOf("code_language");
    const codeLanguage = codeLangIdx !== -1 ? row[codeLangIdx]?.trim().toLowerCase() || undefined : undefined;
    const imageUrlsIdx = header.indexOf("image_urls");
    const imageUrlsRaw = imageUrlsIdx !== -1 ? row[imageUrlsIdx]?.trim() : "";
    const imageUrls = imageUrlsRaw ? imageUrlsRaw.split(";").map((u) => u.trim()).filter(Boolean) : undefined;

    // Categories are required (pipe-separated for multiple, e.g. "Math|DSA")
    const categoriesRaw = row[colIndex("categories")]?.trim();
    if (!categoriesRaw) {
      errors.push({ row: rowNum, message: "At least one category is required" });
      continue;
    }
    const categories = categoriesRaw.split("|").map((c) => c.trim()).filter(Boolean);
    if (categories.length === 0) {
      errors.push({ row: rowNum, message: "At least one category is required" });
      continue;
    }

    // Difficulty is required
    const rawDifficulty = row[colIndex("difficulty")]?.toUpperCase().trim();
    if (!rawDifficulty) {
      errors.push({ row: rowNum, message: "Difficulty is required (EASY, MEDIUM, or HARD)" });
      continue;
    }
    if (rawDifficulty !== "EASY" && rawDifficulty !== "MEDIUM" && rawDifficulty !== "HARD") {
      errors.push({
        row: rowNum,
        message: `Invalid difficulty "${rawDifficulty}". Use EASY, MEDIUM, or HARD`,
      });
      continue;
    }
    const difficulty: "EASY" | "MEDIUM" | "HARD" = rawDifficulty;

    // Collect non-empty options
    const optionTexts: { index: number; text: string }[] = [];
    for (let j = 1; j <= 4; j++) {
      const text = row[colIndex(`option_${j}`)];
      if (text) {
        optionTexts.push({ index: j, text });
      }
    }

    if (optionTexts.length < 2) {
      errors.push({
        row: rowNum,
        message: `At least 2 options required, found ${optionTexts.length}`,
      });
      continue;
    }

    const rawType = row[colIndex("question_type")]?.toUpperCase().trim();
    const questionType: "SINGLE_SELECT" | "MULTI_SELECT" =
      rawType === "MULTI_SELECT" ? "MULTI_SELECT" : "SINGLE_SELECT";

    const correctAnswersRaw = row[colIndex("correct_answers")];
    if (!correctAnswersRaw) {
      errors.push({ row: rowNum, message: "Correct answers field is empty" });
      continue;
    }

    const correctIndices = correctAnswersRaw
      .split(";")
      .map((s) => parseInt(s.trim(), 10));

    if (correctIndices.some((n) => isNaN(n))) {
      errors.push({
        row: rowNum,
        message: `Invalid correct_answers format: "${correctAnswersRaw}"`,
      });
      continue;
    }

    const validOptionIndices = optionTexts.map((o) => o.index);
    const invalidIndices = correctIndices.filter(
      (idx) => !validOptionIndices.includes(idx)
    );
    if (invalidIndices.length > 0) {
      errors.push({
        row: rowNum,
        message: `Correct answers reference empty/missing options: ${invalidIndices.join(", ")}`,
      });
      continue;
    }

    if (questionType === "SINGLE_SELECT" && correctIndices.length !== 1) {
      errors.push({
        row: rowNum,
        message: `SINGLE_SELECT must have exactly 1 correct answer, found ${correctIndices.length}`,
      });
      continue;
    }

    const options = optionTexts.map((o, idx) => ({
      id: `opt_${idBase}_${i}_${idx}`,
      text: o.text,
    }));

    const correctOptionIds = correctIndices.map((ci) => {
      const optIdx = optionTexts.findIndex((o) => o.index === ci);
      return options[optIdx].id;
    });

    const marksRaw = row[colIndex("marks")];
    const marks = marksRaw ? parseInt(marksRaw, 10) : 1;
    if (isNaN(marks) || marks < 1) {
      errors.push({ row: rowNum, message: `Invalid marks value: "${marksRaw}"` });
      continue;
    }

    const negMarksRaw = row[colIndex("negative_marks")];
    const negativeMarks = negMarksRaw ? parseFloat(negMarksRaw) : 0;
    if (isNaN(negativeMarks) || negativeMarks < 0) {
      errors.push({ row: rowNum, message: `Invalid negative_marks value: "${negMarksRaw}"` });
      continue;
    }

    const explanation = row[colIndex("explanation")] || undefined;

    questions.push({
      questionText,
      codeBlock,
      codeLanguage,
      imageUrls,
      questionType,
      options,
      correctOptionIds,
      marks,
      negativeMarks,
      explanation,
      categories,
      difficulty,
    });
  }

  return { questions, errors };
}

/**
 * Generate a CSV template string with category/difficulty columns.
 * Includes code_block, code_language, and image_urls columns.
 */
export function generateLibraryCSVTemplate(): string {
  const header = [...EXPECTED_HEADERS, "code_block", "code_language", "image_urls"].join(",");
  // Plain text
  const example1 = `"What is 2+2?","1","2","3","4","4","SINGLE_SELECT","1","0","","Math","EASY","","",""`;
  // Multi-select with multiple categories (pipe-separated)
  const example2 = `"Select all prime numbers","2","3","4","5","1;2;4","MULTI_SELECT","2","0.5","2 3 and 5 are prime","Math|Logic","MEDIUM","","",""`;
  // Mixed: header + code block
  const mixed = `"What is the output of the following code?","Hello, World!","Hello, name!","Error","None","1","SINGLE_SELECT","2","0","f-strings interpolate variables","Python|Programming","MEDIUM","def greet(name):\n    return f""Hello, {name}!""\nprint(greet(""World""))","python",""`;
  // Code block only
  const pureCode = `"What is the output?","5","10","15","Error","3","SINGLE_SELECT","2","0","a + b = 5 + 10 = 15","C Programming","EASY","#include <stdio.h>\nint main() {\n    int a = 5, b = 10;\n    printf(""%d"", a + b);\n    return 0;\n}","c",""`;
  return `${header}\n${example1}\n${example2}\n${mixed}\n${pureCode}\n`;
}
