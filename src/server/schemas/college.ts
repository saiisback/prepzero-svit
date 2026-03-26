import { z } from "zod";

export const createCollegeSchema = z.object({
  name: z.string().min(1, "College name is required"),
  code: z.string().min(1).optional(),
  address: z.string().optional(),
  website: z.string().url().or(z.literal("")).optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  contactEmail: z.string().email().or(z.literal("")).optional(),
  contactPhone: z.string().optional(),
  isActive: z.boolean().optional(),
  usnFormat: z.string().optional().nullable(),
  usnExample: z.string().optional().nullable(),
});

export const updateCollegeSchema = createCollegeSchema.partial();
