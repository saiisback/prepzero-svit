import { z } from "zod";

export const idSchema = z.object({ id: z.string() });

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const searchSchema = z.object({
  search: z.string().optional(),
});
