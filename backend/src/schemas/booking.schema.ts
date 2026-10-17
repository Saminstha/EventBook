import { z } from "zod";

export const createBookingSchema = z.object({
  eventId: z.string().uuid(),
});
