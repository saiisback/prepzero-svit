export interface CSVTestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
}

export interface CSVQuestion {
  questionText: string;
  codeBlock?: string;
  codeLanguage?: string;
  imageUrl?: string;
  imageUrls?: string[];
  questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "CODING";
  // MCQ fields (empty arrays for CODING)
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  // Coding fields
  testCases?: CSVTestCase[];
  marks: number;
  negativeMarks: number;
  explanation?: string;
}

export interface CSVParseError {
  row: number;
  message: string;
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
];

/**
 * Parse raw CSV text into a 2D string array.
 * Handles quoted fields with commas, newlines, and escaped quotes ("").
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        current = "";
        if (row.some((cell) => cell !== "")) {
          rows.push(row);
        }
        row = [];
        if (char === "\r") i++; // skip \n in \r\n
      } else {
        current += char;
      }
    }
  }

  // Last field/row
  row.push(current.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

/**
 * Parse and validate a CSV string into MCQ questions.
 */
export function parseQuestionsCSV(text: string): {
  questions: CSVQuestion[];
  errors: CSVParseError[];
} {
  const rows = parseCSV(text);
  const questions: CSVQuestion[] = [];
  const errors: CSVParseError[] = [];

  if (rows.length === 0) {
    errors.push({ row: 0, message: "CSV file is empty" });
    return { questions, errors };
  }

  // Validate header
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const missingHeaders = EXPECTED_HEADERS.filter(
    (h) => !header.includes(h)
  );
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
    const rowNum = i + 1; // 1-indexed for user display

    // Pad row to header length
    while (row.length < header.length) {
      row.push("");
    }

    const questionText = row[colIndex("question_text")];
    if (!questionText) {
      errors.push({ row: rowNum, message: "Question text is empty" });
      continue;
    }

    // Parse question type first so we can branch logic
    const rawType = row[colIndex("question_type")]?.toUpperCase().trim();
    const questionType: "SINGLE_SELECT" | "MULTI_SELECT" | "CODING" =
      rawType === "MULTI_SELECT"
        ? "MULTI_SELECT"
        : rawType === "CODING"
          ? "CODING"
          : "SINGLE_SELECT";

    // Parse marks
    const marksRaw = row[colIndex("marks")];
    const marks = marksRaw ? parseInt(marksRaw, 10) : 1;
    if (isNaN(marks) || marks < 1) {
      errors.push({ row: rowNum, message: `Invalid marks value: "${marksRaw}"` });
      continue;
    }

    // Parse negative marks
    const negMarksRaw = row[colIndex("negative_marks")];
    const negativeMarks = negMarksRaw ? parseFloat(negMarksRaw) : 0;
    if (isNaN(negativeMarks) || negativeMarks < 0) {
      errors.push({ row: rowNum, message: `Invalid negative_marks value: "${negMarksRaw}"` });
      continue;
    }

    const explanation = row[colIndex("explanation")] || undefined;

    // New optional columns: code_block, code_language, image_urls
    const codeBlockIdx = header.indexOf("code_block");
    const codeBlock = codeBlockIdx !== -1 ? row[codeBlockIdx]?.trim() || undefined : undefined;
    const codeLangIdx = header.indexOf("code_language");
    const codeLanguage = codeLangIdx !== -1 ? row[codeLangIdx]?.trim().toLowerCase() || undefined : undefined;
    const imageUrlIdx = header.indexOf("image_url");
    const imageUrl = imageUrlIdx !== -1 ? row[imageUrlIdx]?.trim() || undefined : undefined;
    const imageUrlsIdx = header.indexOf("image_urls");
    const imageUrlsRaw = imageUrlsIdx !== -1 ? row[imageUrlsIdx]?.trim() : "";
    const imageUrls = imageUrlsRaw ? imageUrlsRaw.split(";").map((u) => u.trim()).filter(Boolean) : undefined;

    // --- MCQ / CODING path (CODING uses MCQ options for answers) ---
    // Collect non-empty options
    const optionTexts: { index: number; text: string }[] = [];
    for (let j = 1; j <= 4; j++) {
      const text = row[colIndex(`option_${j}`)];
      if (text) optionTexts.push({ index: j, text });
    }

    if (optionTexts.length < 2) {
      errors.push({ row: rowNum, message: `At least 2 options required, found ${optionTexts.length}` });
      continue;
    }

    // Parse correct answers (1-indexed, semicolon-separated)
    const correctAnswersRaw = row[colIndex("correct_answers")];
    if (!correctAnswersRaw) {
      errors.push({ row: rowNum, message: "Correct answers field is empty" });
      continue;
    }

    const correctIndices = correctAnswersRaw.split(";").map((s) => parseInt(s.trim(), 10));
    if (correctIndices.some((n) => isNaN(n))) {
      errors.push({ row: rowNum, message: `Invalid correct_answers format: "${correctAnswersRaw}"` });
      continue;
    }

    const validOptionIndices = optionTexts.map((o) => o.index);
    const invalidIndices = correctIndices.filter((idx) => !validOptionIndices.includes(idx));
    if (invalidIndices.length > 0) {
      errors.push({ row: rowNum, message: `Correct answers reference empty/missing options: ${invalidIndices.join(", ")}` });
      continue;
    }

    if (questionType === "SINGLE_SELECT" && correctIndices.length !== 1) {
      errors.push({ row: rowNum, message: `SINGLE_SELECT must have exactly 1 correct answer, found ${correctIndices.length}` });
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

    questions.push({
      questionText,
      codeBlock,
      codeLanguage,
      imageUrl,
      imageUrls,
      questionType,
      options,
      correctOptionIds,
      marks,
      negativeMarks,
      explanation,
    });
  }

  return { questions, errors };
}

export interface EligibilityCSVStudent {
  name: string;
  email: string;
  usn: string;
  department: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ELIGIBILITY_HEADERS = ["name", "usn", "email", "department"];

/**
 * Parse a CSV with name, usn, email, department columns for bulk adding
 * students to a test. Creates students in the DB if they don't already exist.
 */
export function parseEligibilityCSV(text: string): {
  students: EligibilityCSVStudent[];
  errors: string[];
} {
  const rows = parseCSV(text);
  const students: EligibilityCSVStudent[] = [];
  const errors: string[] = [];

  if (rows.length === 0) {
    errors.push("CSV file is empty");
    return { students, errors };
  }

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const missingHeaders = ELIGIBILITY_HEADERS.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    errors.push(`Missing headers: ${missingHeaders.join(", ")}`);
    return { students, errors };
  }

  const colIndex = (name: string) => header.indexOf(name);
  const seenUsns = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    while (row.length < header.length) {
      row.push("");
    }

    const name = row[colIndex("name")]?.trim();
    const email = row[colIndex("email")]?.trim().toLowerCase();
    const usn = row[colIndex("usn")]?.trim().toUpperCase();
    const department = row[colIndex("department")]?.trim();

    if (!name) {
      errors.push(`Row ${rowNum}: Name is empty`);
      continue;
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      errors.push(`Row ${rowNum}: Invalid email "${email || ""}"`);
      continue;
    }

    if (seenEmails.has(email)) {
      errors.push(`Row ${rowNum}: Duplicate email "${email}"`);
      continue;
    }

    if (!usn) {
      errors.push(`Row ${rowNum}: USN is empty`);
      continue;
    }

    if (seenUsns.has(usn)) {
      errors.push(`Row ${rowNum}: Duplicate USN "${usn}"`);
      continue;
    }

    if (!department) {
      errors.push(`Row ${rowNum}: Department is empty`);
      continue;
    }

    seenEmails.add(email);
    seenUsns.add(usn);
    students.push({ name, email, usn, department });
  }

  return { students, errors };
}

/**
 * Generate a CSV template string for download.
 * Columns: question_text (header), code_block, code_language, options, correct_answers,
 * question_type, marks, negative_marks, explanation, image_urls
 */
export function generateCSVTemplate(): string {
  const header = [...EXPECTED_HEADERS, "code_block", "code_language", "image_urls"].join(",");
  // Row 1: Plain text only (no code block)
  const mcq1 = `"What is 2+2?","1","2","3","4","4","SINGLE_SELECT","1","0","","","",""`;
  // Row 2: Multi-select plain text
  const mcq2 = `"Select all prime numbers","2","3","4","5","1;2;4","MULTI_SELECT","2","0.5","2 3 and 5 are prime","","",""`;
  // Row 3: Header text + code block (mixed)
  const mixed = `"What is the output of the following code?","[3, 2, 1]","[1, 2, 3]","[1, 3, 2]","Error","1","SINGLE_SELECT","2","0","Slicing with [::-1] reverses the list","x = [1, 2, 3]\nprint(x[::-1])","python",""`;
  // Row 4: Code block only (no header text needed, but can add a short prompt)
  const coding = `"What is the output?","10","11","12","13","3","SINGLE_SELECT","2","0","x++ is 5 (post), then x becomes 7 (pre), 5+7=12","public class Main {\n    public static void main(String[] args) {\n        int x = 5;\n        System.out.println(x++ + ++x);\n    }\n}","java",""`;
  return `${header}\n${mcq1}\n${mcq2}\n${mixed}\n${coding}\n`;
}
