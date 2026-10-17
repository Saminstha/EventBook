import { pool } from "../config/db";

export async function createBooking(userId: string, eventId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock this event row so concurrent requests cannot overbook it.
    const eventResult = await client.query(
      `SELECT id, event_datetime, total_seats, is_deleted
       FROM events
       WHERE id = $1::UUID
       FOR UPDATE`,
      [eventId],
    );

    const event = eventResult.rows[0];

    if (!event || event.is_deleted) {
      throw new Error("EVENT_NOT_FOUND");
    }

    if (new Date(event.event_datetime).getTime() <= Date.now()) {
      throw new Error("EVENT_ALREADY_STARTED");
    }

    const existingResult = await client.query(
      `SELECT id
       FROM bookings
       WHERE user_id = $1::UUID
         AND event_id = $2::UUID
         AND status = 'confirmed'`,
      [userId, eventId],
    );

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      throw new Error("ALREADY_BOOKED");
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::INTEGER AS booked_seats
       FROM bookings
       WHERE event_id = $1::UUID
         AND status = 'confirmed'`,
      [eventId],
    );

    const bookedSeats = countResult.rows[0].booked_seats as number;

    if (bookedSeats >= event.total_seats) {
      throw new Error("EVENT_FULL");
    }

    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, event_id, status)
       VALUES ($1::UUID, $2::UUID, 'confirmed')
       RETURNING id, user_id, event_id, status, created_at`,
      [userId, eventId],
    );

    await client.query("COMMIT");

    return bookingResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMyBookings(userId: string) {
  const result = await pool.query(
    `SELECT
       b.id AS booking_id,
       b.status,
       b.created_at AS booked_at,
       e.id AS event_id,
       e.title,
       e.description,
       e.event_datetime,
       e.venue,
       e.total_seats
     FROM bookings b
     INNER JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1::UUID
     ORDER BY b.created_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function cancelBooking(bookingId: string, userId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the booking and event together while checking cancellation.
    const result = await client.query(
      `SELECT
         b.id,
         b.status,
         b.event_id,
         e.event_datetime,
         e.is_deleted
       FROM bookings b
       INNER JOIN events e ON e.id = b.event_id
       WHERE b.id = $1::UUID
         AND b.user_id = $2::UUID
       FOR UPDATE OF b, e`,
      [bookingId, userId],
    );

    const booking = result.rows[0];

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    if (booking.status !== "confirmed") {
      throw new Error("BOOKING_NOT_ACTIVE");
    }

    if (new Date(booking.event_datetime).getTime() <= Date.now()) {
      throw new Error("EVENT_ALREADY_STARTED");
    }

    await client.query(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = $1::UUID`,
      [bookingId],
    );

    await client.query("COMMIT");

    return { bookingId, status: "cancelled" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
