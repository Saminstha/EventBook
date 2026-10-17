import { Router } from "express";
import { authenticate, AuthUser } from "../middleware/auth";
import {
  cancelBooking,
  createBooking,
  getMyBookings,
} from "../services/booking.service";
import { createBookingSchema } from "../schemas/booking.schema";
import { uuidSchema } from "../schemas/common.schema";

const router = Router();

// All booking endpoints require authentication.
router.use(authenticate);

router.post("/", async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "A valid eventId is required",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const user = res.locals.user as AuthUser;

  try {
    const booking = await createBooking(user.id, parsed.data.eventId);

    res.status(201).json({
      message: "Event booked successfully",
      booking,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        EVENT_NOT_FOUND: {
          status: 404,
          message: "Event not found",
        },
        EVENT_ALREADY_STARTED: {
          status: 400,
          message: "Past events cannot be booked or changed",
        },
        ALREADY_BOOKED: {
          status: 409,
          message: "You already have an active booking for this event",
        },
        EVENT_FULL: {
          status: 409,
          message: "This event has no available seats",
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        res.status(knownError.status).json({
          message: knownError.message,
        });
        return;
      }
    }

    console.error("Booking failed:", error);
    res.status(500).json({ message: "Unable to book this event" });
  }
});

router.get("/my", async (_req, res) => {
  const user = res.locals.user as AuthUser;

  try {
    const bookings = await getMyBookings(user.id);
    res.json({ bookings });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    res.status(500).json({ message: "Unable to fetch your bookings" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  const parsedId = uuidSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    res.status(400).json({ message: "Invalid booking ID" });
    return;
  }

  const user = res.locals.user as AuthUser;

  try {
    const booking = await cancelBooking(parsedId.data, user.id);

    res.json({
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        BOOKING_NOT_FOUND: {
          status: 404,
          message: "Booking not found",
        },
        BOOKING_NOT_ACTIVE: {
          status: 400,
          message: "This booking has already been cancelled",
        },
        EVENT_ALREADY_STARTED: {
          status: 400,
          message: "Bookings for past events cannot be cancelled",
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        res.status(knownError.status).json({
          message: knownError.message,
        });
        return;
      }
    }

    console.error("Booking cancellation failed:", error);
    res.status(500).json({ message: "Unable to cancel booking" });
  }
});

export default router;
