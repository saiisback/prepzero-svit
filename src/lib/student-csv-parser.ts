import { parseCSV, type CSVParseError } from "./csv-parser";

export interface CSVStudent {
  name: string;
  email: string;
  usn: string;
  deptCode: string;
  semester: number;
}

const EXPECTED_HEADERS = ["name", "email", "usn", "department", "semester"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse and validate a CSV string into student records.
 * Department code is read from an explicit "department" column.
 * @param usnFormat - A regex pattern string to validate USN format (e.g. "^1SI\d{2}[A-Z]{2}\d{3}$")
 */
export function parseStudentsCSV(
  text: string,
  usnFormat: string
): { students: CSVStudent[]; errors: CSVParseError[] } {
  let usnRegex: RegExp;
  try {
    usnRegex = new RegExp(usnFormat);
  } catch {
    return { students: [], errors: [{ row: 0, message: `Invalid USN regex pattern: "${usnFormat}"` }] };
  }
  const rows = parseCSV(text);
  const students: CSVStudent[] = [];
  const errors: CSVParseError[] = [];

  if (rows.length === 0) {
    errors.push({ row: 0, message: "CSV file is empty" });
    return { students, errors };
  }

  // Validate header
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    errors.push({
      row: 1,
      message: `Missing headers: ${missingHeaders.join(", ")}`,
    });
    return { students, errors };
  }

  const colIndex = (name: string) => header.indexOf(name);
  const seenEmails = new Set<string>();
  const seenUsns = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Pad row to header length
    while (row.length < header.length) {
      row.push("");
    }

    const name = row[colIndex("name")]?.trim();
    const email = row[colIndex("email")]?.trim().toLowerCase();
    const usn = row[colIndex("usn")]?.trim().toUpperCase();
    const deptCode = row[colIndex("department")]?.trim().toUpperCase();
    const semesterRaw = row[colIndex("semester")]?.trim();

    if (!name) {
      errors.push({ row: rowNum, message: "Name is empty" });
      continue;
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      errors.push({ row: rowNum, message: `Invalid email: "${email || ""}"` });
      continue;
    }

    if (seenEmails.has(email)) {
      errors.push({ row: rowNum, message: `Duplicate email in CSV: "${email}"` });
      continue;
    }

    if (!usn) {
      errors.push({ row: rowNum, message: "USN is empty" });
      continue;
    }

    if (!usnRegex.test(usn)) {
      errors.push({
        row: rowNum,
        message: `USN "${usn}" does not match the expected pattern: ${usnFormat}`,
      });
      continue;
    }

    if (seenUsns.has(usn)) {
      errors.push({ row: rowNum, message: `Duplicate USN in CSV: "${usn}"` });
      continue;
    }

    if (!deptCode) {
      errors.push({ row: rowNum, message: "Department is empty" });
      continue;
    }

    if (!semesterRaw) {
      errors.push({ row: rowNum, message: "Semester is empty" });
      continue;
    }

    const semester = parseInt(semesterRaw, 10);
    if (isNaN(semester) || semester < 1 || semester > 8) {
      errors.push({
        row: rowNum,
        message: `Invalid semester: "${semesterRaw}" (must be 1-8)`,
      });
      continue;
    }

    seenEmails.add(email);
    seenUsns.add(usn);
    students.push({ name, email, usn, deptCode, semester });
  }

  return { students, errors };
}

export function generateStudentCSVTemplate(usnExample?: string): string {
  const header = EXPECTED_HEADERS.join(",");
  const usn1 = usnExample || "1SI22CS001";
  const usn2 = usnExample ? usnExample.slice(0, -3) + "002" : "1SI22EC002";
  
  const example1 = `John Doe,john@example.com,${usn1},CS,3`;
  const example2 = `Jane Smith,jane@example.com,${usn2},EC,5`;
  return `${header}\n${example1}\n${example2}\n`;
}
