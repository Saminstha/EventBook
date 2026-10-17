import { Router } from "express";
import { getEventById, getEvents } from "../services/event.service";
import { listEventsQuerySchema } from "../schemas/event.schema";
import { uuidSchema } from "../schemas/common.schema";

const router = Router();

router.get("/", async (req, res) => {
  const parsed = listEventsQuerySchema.safeParse(req.query);

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
