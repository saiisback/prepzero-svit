interface TestEligibilityFields {
  allowedDepartmentIds: unknown;
  allowedSemesters: unknown;
  allowedStudentIds: unknown;
}

interface StudentFields {
  id: string;
  departmentId: string | null;
  semester: number | null;
}

/**
 * Check if a student is eligible for a test.
 *
 * Rules:
 * - If ALL three criteria are empty/null → NO one can access (admin must set criteria)
 * - allowedStudentIds (CSV/manual) = always grants access if student is listed
 * - allowedDepartmentIds + allowedSemesters = AND (must match both when both are set)
 * - Final: eligible if (in student list) OR (matches dept AND semester filters)
 */
export function isStudentEligible(
  test: TestEligibilityFields,
  student: StudentFields
): boolean {
  const deptIds = Array.isArray(test.allowedDepartmentIds)
    ? (test.allowedDepartmentIds as string[])
    : [];
  const semesters = Array.isArray(test.allowedSemesters)
    ? (test.allowedSemesters as number[])
    : [];
  const studentIds = Array.isArray(test.allowedStudentIds)
    ? (test.allowedStudentIds as string[])
    : [];

  // No criteria at all → no one is eligible
  if (deptIds.length === 0 && semesters.length === 0 && studentIds.length === 0) {
    return false;
  }

  // Student explicitly listed via CSV/manual → always eligible
  if (studentIds.includes(student.id)) {
    return true;
  }

  // If only CSV IDs were set (no dept/sem filters), student must be in the list
  if (deptIds.length === 0 && semesters.length === 0) {
    return false;
  }

  // Department + semester AND logic
  const deptMatch =
    deptIds.length === 0 ||
    (student.departmentId !== null && deptIds.includes(student.departmentId));
  const semesterMatch =
    semesters.length === 0 ||
    (student.semester !== null && semesters.includes(student.semester));

  return deptMatch && semesterMatch;
}

/**
 * Build a Prisma `where` clause to query only eligible students for a test.
 */
export function buildEligibleStudentsWhere(
  test: TestEligibilityFields,
  collegeId: string
) {
  const deptIds = Array.isArray(test.allowedDepartmentIds)
    ? (test.allowedDepartmentIds as string[])
    : [];
  const semesters = Array.isArray(test.allowedSemesters)
    ? (test.allowedSemesters as number[])
    : [];
  const studentIds = Array.isArray(test.allowedStudentIds)
    ? (test.allowedStudentIds as string[])
    : [];

  const base = { collegeId, role: "STUDENT" as const };

  // No criteria → no students
  if (deptIds.length === 0 && semesters.length === 0 && studentIds.length === 0) {
    return { ...base, id: "__none__" };
  }

  // Build dept+sem condition
  const hasDeptSem = deptIds.length > 0 || semesters.length > 0;
  const deptSemCondition: Record<string, unknown> = {};
  if (deptIds.length > 0) {
    deptSemCondition.departmentId = { in: deptIds };
  }
  if (semesters.length > 0) {
    deptSemCondition.semester = { in: semesters };
  }

  // CSV only (no dept/sem)
  if (!hasDeptSem && studentIds.length > 0) {
    return { ...base, id: { in: studentIds } };
  }

  // Dept/sem only (no CSV)
  if (hasDeptSem && studentIds.length === 0) {
    return { ...base, ...deptSemCondition };
  }

  // Both dept/sem AND CSV → OR logic
  return {
    ...base,
    OR: [deptSemCondition, { id: { in: studentIds } }],
  };
}
