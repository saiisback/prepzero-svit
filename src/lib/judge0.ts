import { CodingLanguage } from "@/generated/prisma/client";

const JUDGE0_API_URL = process.env.JUDGE0_API_URL!;
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

const LANGUAGE_IDS: Record<CodingLanguage, number> = {
  PYTHON: 71,
  JAVA: 62,
  C: 50,
  CPP: 54,
};

function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

function fromBase64(str: string): string {
  return Buffer.from(str, "base64").toString("utf-8");
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // If using RapidAPI (external hosted Judge0), add RapidAPI headers
  // If self-hosted (local Docker), no extra auth headers needed
  if (JUDGE0_API_KEY && JUDGE0_API_URL.includes("rapidapi.com")) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = new URL(JUDGE0_API_URL).host;
  }

  return headers;
}

export interface ExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  passed: boolean;
  stderr: string | null;
  compileError: string | null;
}

export async function executeCode(
  sourceCode: string,
  language: CodingLanguage,
  stdin: string
): Promise<ExecutionResult> {
  const res = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      source_code: toBase64(sourceCode),
      language_id: LANGUAGE_IDS[language],
      stdin: toBase64(stdin),
    }),
  });

  if (!res.ok) {
    return {
      stdout: null,
      stderr: `Judge0 API error: ${res.status}`,
      compile_output: null,
      status: { id: 0, description: "API Error" },
      time: null,
      memory: null,
    };
  }

  const data = await res.json();
  return {
    stdout: data.stdout ? fromBase64(data.stdout) : null,
    stderr: data.stderr ? fromBase64(data.stderr) : null,
    compile_output: data.compile_output ? fromBase64(data.compile_output) : null,
    status: data.status,
    time: data.time,
    memory: data.memory,
  };
}

export async function executeBatch(
  sourceCode: string,
  language: CodingLanguage,
  testCases: Array<{ input: string; expectedOutput: string }>
): Promise<TestCaseResult[]> {
  // Submit all test cases as a batch
  const submissions = testCases.map((tc) => ({
    source_code: toBase64(sourceCode),
    language_id: LANGUAGE_IDS[language],
    stdin: toBase64(tc.input),
    expected_output: toBase64(tc.expectedOutput),
  }));

  const res = await fetch(
    `${JUDGE0_API_URL}/submissions/batch?base64_encoded=true`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ submissions }),
    }
  );

  if (!res.ok) {
    return testCases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: null,
      passed: false,
      stderr: `Judge0 API error: ${res.status}`,
      compileError: null,
    }));
  }

  const tokens: Array<{ token: string }> = await res.json();

  // Poll for results (max 30 seconds)
  const tokenStr = tokens.map((t) => t.token).join(",");
  let results: ExecutionResult[] = [];

  const pollHeaders = getHeaders();
  delete pollHeaders["Content-Type"];

  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `${JUDGE0_API_URL}/submissions/batch?tokens=${tokenStr}&base64_encoded=true&fields=stdout,stderr,compile_output,status`,
      {
        headers: pollHeaders,
      }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const subs = pollData.submissions as Array<{
      stdout: string | null;
      stderr: string | null;
      compile_output: string | null;
      status: { id: number; description: string };
    }>;

    // Check if all are done (status id >= 3 means finished)
    const allDone = subs.every((s) => s.status.id >= 3);

    if (allDone) {
      results = subs.map((s) => ({
        stdout: s.stdout ? fromBase64(s.stdout) : null,
        stderr: s.stderr ? fromBase64(s.stderr) : null,
        compile_output: s.compile_output ? fromBase64(s.compile_output) : null,
        status: s.status,
        time: null,
        memory: null,
      }));
      break;
    }
  }

  // If polling timed out, treat all as failed
  if (results.length === 0) {
    return testCases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: null,
      passed: false,
      stderr: "Execution timed out",
      compileError: null,
    }));
  }

  return testCases.map((tc, i) => {
    const r = results[i];
    const actualOutput = r.stdout?.trimEnd() ?? null;
    const expected = tc.expectedOutput.trimEnd();
    // Status id 3 = Accepted
    const passed = r.status.id === 3 || actualOutput === expected;

    return {
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput,
      passed,
      stderr: r.stderr,
      compileError: r.compile_output,
    };
  });
}
