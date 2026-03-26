import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  usn: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  semester: z.number().int().min(1).max(8, "Semester must be 1-8"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  semester: z.number().int().min(1).max(8).optional().nullable(),
});

export const studentFilterSchema = z.object({
  departmentId: z.string().optional(),
  semester: z.number().int().min(1).max(8).optional(),
  graduated: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

export const bulkStudentSchema = z.object({
  students: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      usn: z.string().min(1),
      deptCode: z.string().min(1),
      semester: z.number().int().min(1).max(8),
    })
  ),
  passwords: z.record(z.string(), z.string().min(8)),
});

export const bulkDeleteStudentSchema = z
  .object({
    studentIds: z.array(z.string()).min(1).optional(),
    filters: studentFilterSchema.optional(),
  })
  .refine((data) => data.studentIds || data.filters, {
    message: "Either studentIds or filters must be provided",
  });

export const bulkPromoteStudentSchema = z
  .object({
    studentIds: z.array(z.string()).min(1).optional(),
    filters: studentFilterSchema.optional(),
  })
  .refine((data) => data.studentIds || data.filters, {
    message: "Either studentIds or filters must be provided",
  });
