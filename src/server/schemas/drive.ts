import { z } from "zod";

export const createDriveSchema = z.object({
  title: z.string().min(1, "Drive title is required"),
  description: z.string().optional(),
  companyName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const updateDriveSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  companyName: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
});

export const driveFilterSchema = z.object({
  status: z.enum(["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  search: z.string().optional(),
});
