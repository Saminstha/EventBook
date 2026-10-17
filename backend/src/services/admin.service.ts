import { pool } from "../config/db";

interface EventInput {
  title: string;
  description: string;
  event_datetime: string;
  venue: string;
  total_seats: number;
}

export async function createEvent(data: EventInput) {
  const result = await pool.query(
    `INSERT INTO events
       (title, description, event_datetime, venue, total_seats)
     VALUES ($1::VARCHAR, $2::TEXT, $3::TIMESTAMPTZ, $4::VARCHAR, $5::INTEGER)
     RETURNING id, title, description, event_datetime, venue, total_seats,
               created_at, updated_at`,
    [
      data.title,
      data.description,
      data.event_datetime,
      data.venue,
      data.total_seats,
    ],
  );

  return result.rows[0];
}

export async function updateEvent(id: string, data: EventInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `SELECT id, event_datetime, is_deleted
       FROM events
       WHERE id = $1::UUID
       FOR UPDATE`,
      [id],
    );

    const existing = existingResult.rows[0];

    if (!existing || existing.is_deleted) {
      throw new Error("EVENT_NOT_FOUND");
    }

    // Do not allow changing a past event into a future event.
    if (new Date(existing.event_datetime).getTime() <= Date.now()) {
      throw new Error("EVENT_ALREADY_STARTED");
    }

    const bookingCountResult = await client.query(
      `SELECT COUNT(*)::INTEGER AS booked_seats
       FROM bookings
       WHERE event_id = $1::UUID
         AND status = 'confirmed'`,
      [id],
    );

    const bookedSeats = bookingCountResult.rows[0].booked_seats as number;

    if (data.total_seats < bookedSeats) {
      throw new Error("CAPACITY_BELOW_BOOKINGS");
    }

    const updatedResult = await client.query(
      `UPDATE events
       SET title = $2::VARCHAR,
           description = $3::TEXT,
           event_datetime = $4::TIMESTAMPTZ,
           venue = $5::VARCHAR,
           total_seats = $6::INTEGER,
           updated_at = NOW()
       WHERE id = $1::UUID
       RETURNING id, title, description, event_datetime, venue,
                 total_seats, created_at, updated_at`,
      [
        id,
        data.title,
        data.description,
        data.event_datetime,
        data.venue,
        data.total_seats,
      ],
    );

    await client.query("COMMIT");
    return updatedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEvent(id: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `SELECT id, event_datetime, is_deleted
       FROM events
       WHERE id = $1::UUID
       FOR UPDATE`,
      [id],
    );

    const event = eventResult.rows[0];

    if (!event || event.is_deleted) {
      throw new Error("EVENT_NOT_FOUND");
    }

    const bookingResult = await client.query(
      `SELECT COUNT(*)::INTEGER AS booked_seats
       FROM bookings
       WHERE event_id = $1::UUID
         AND status = 'confirmed'`,
      [id],
    );

    const bookedSeats = bookingResult.rows[0].booked_seats as number;

    if (bookedSeats > 0) {
      throw new Error("EVENT_HAS_BOOKINGS");
    }

    await client.query(
      `UPDATE events
       SET is_deleted = TRUE,
           updated_at = NOW()
       WHERE id = $1::UUID`,
      [id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getEventAttendees(eventId: string) {
  const eventResult = await pool.query(
    `SELECT id, title, event_datetime, venue, total_seats, is_deleted
     FROM events
     WHERE id = $1::UUID`,
    [eventId],
  );

  const event = eventResult.rows[0];

  if (!event || event.is_deleted) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const attendeesResult = await pool.query(
    `SELECT
       b.id AS booking_id,
       b.status,
       b.created_at AS booked_at,
       u.id AS user_id,
       u.name,
       u.email
     FROM bookings b
     INNER JOIN users u ON u.id = b.user_id
     WHERE b.event_id = $1::UUID
       AND b.status = 'confirmed'
     ORDER BY b.created_at ASC`,
    [eventId],
  );

  return {
    event,
    attendees: attendeesResult.rows,
  };
}
