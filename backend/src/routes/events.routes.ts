import { Router } from "express";
import { z } from "zod";
import { getEventById, getEvents } from "../services/event.service";

const router = Router();

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const uuidSchema = z.string().uuid();

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid search or pagination parameters",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await getEvents(parsed.data);

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ message: "Unable to fetch events" });
  }
});

router.get("/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    res.status(400).json({ message: "Invalid event ID" });
    return;
  }

  try {
    const event = await getEventById(parsedId.data);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    res.json({ event });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ message: "Unable to fetch event details" });
  }
});

export default router;
