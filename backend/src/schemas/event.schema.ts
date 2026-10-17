import { z } from "zod";

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  event_datetime: z
    .string()
    .min(1)
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "A valid event date and time is required",
    ),
  venue: z.string().trim().min(2).max(255),
  total_seats: z.coerce.number().int().min(1).max(100000),
});

export const listEventsQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
