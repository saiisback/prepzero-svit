import { z } from "zod";

export const registerCollegeAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  collegeCode: z.string().min(1, "College code is required"),
});

export const registerStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  collegeCode: z.string().min(1, "College code is required"),
  departmentId: z.string().min(1, "Department is required"),
  semester: z.number().int().min(1).max(8, "Semester must be 1-8"),
});

export const listDepartmentsSchema = z.object({
  collegeCode: z.string().min(1, "College code is required"),
});
