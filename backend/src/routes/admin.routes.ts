import { Router, Response } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  createEvent,
  deleteEvent,
  getEventAttendees,
  updateEvent,
} from "../services/admin.service";
import { eventSchema } from "../schemas/event.schema";
import { uuidSchema } from "../schemas/common.schema";

const router = Router();

// Every admin endpoint requires an authenticated administrator.
router.use(authenticate, requireAdmin);

function sendAdminError(error: unknown, res: Response) {
  if (error instanceof Error) {
    const knownErrors: Record<string, { status: number; message: string }> = {
      EVENT_NOT_FOUND: {
        status: 404,
        message: "Event not found",
      },
      EVENT_ALREADY_STARTED: {
        status: 400,
        message: "Past events cannot be edited",
      },
      CAPACITY_BELOW_BOOKINGS: {
        status: 409,
        message:
          "Capacity cannot be lower than the number of confirmed bookings",
      },
      EVENT_HAS_BOOKINGS: {
        status: 409,
        message:
          "Cancel or resolve confirmed bookings before deleting this event",
      },
    };

    const known = knownErrors[error.message];

    if (known) {
      res.status(known.status).json({ message: known.message });
      return;
    }
  }

  console.error("Admin operation failed:", error);
  res.status(500).json({
    message: "Unable to complete the admin operation",
  });
}

router.post("/events", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid event details",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  if (new Date(parsed.data.event_datetime).getTime() <= Date.now()) {
    res.status(400).json({
      message: "New events must be scheduled in the future",
    });
    return;
  }

  try {
    const event = await createEvent(parsed.data);

    res.status(201).json({
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    sendAdminError(error, res);
  }
});

router.patch("/events/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  const parsedBody = eventSchema.safeParse(req.body);

  if (!parsedId.success) {
    res.status(400).json({ message: "Invalid event ID" });
    return;
  }

  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid event details",
      errors: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  if (new Date(parsedBody.data.event_datetime).getTime() <= Date.now()) {
    res.status(400).json({
      message: "The event date must be in the future",
    });
    return;
  }

  try {
    const event = await updateEvent(parsedId.data, parsedBody.data);

    res.json({
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    sendAdminError(error, res);
  }
});

router.delete("/events/:id", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    res.status(400).json({ message: "Invalid event ID" });
    return;
  }

  try {
    await deleteEvent(parsedId.data);
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    sendAdminError(error, res);
  }
});

router.get("/events/:id/attendees", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    res.status(400).json({ message: "Invalid event ID" });
    return;
  }

  try {
    const result = await getEventAttendees(parsedId.data);
    res.json(result);
  } catch (error) {
    sendAdminError(error, res);
  }
});

export default router;
