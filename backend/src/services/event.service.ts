import { pool } from "../config/db";

export interface EventQuery {
  search: string;
  page: number;
  limit: number;
}

export async function getEvents({ search, page, limit }: EventQuery) {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::INTEGER AS total
     FROM events
     WHERE is_deleted = FALSE
       AND event_datetime > NOW()
       AND title ILIKE '%' || $1::TEXT || '%'`,
    [search],
  );

  const eventsResult = await pool.query(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.event_datetime,
       e.venue,
       e.total_seats,
       (
         SELECT COUNT(*)::INTEGER
         FROM bookings b
         WHERE b.event_id = e.id
           AND b.status = 'confirmed'
       ) AS booked_seats,
       GREATEST(
         e.total_seats - (
           SELECT COUNT(*)::INTEGER
           FROM bookings b
           WHERE b.event_id = e.id
             AND b.status = 'confirmed'
         ),
         0
       ) AS available_seats
     FROM events e
     WHERE e.is_deleted = FALSE
       AND e.event_datetime > NOW()
       AND e.title ILIKE '%' || $1::TEXT || '%'
     ORDER BY e.event_datetime ASC
     LIMIT $2::INTEGER OFFSET $3::INTEGER`,
    [search, limit, offset],
  );

  const total = countResult.rows[0].total as number;

  return {
    events: eventsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEventById(id: string) {
  const result = await pool.query(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.event_datetime,
       e.venue,
       e.total_seats,
       (
         SELECT COUNT(*)::INTEGER
         FROM bookings b
         WHERE b.event_id = e.id
           AND b.status = 'confirmed'
       ) AS booked_seats,
       GREATEST(
         e.total_seats - (
           SELECT COUNT(*)::INTEGER
           FROM bookings b
           WHERE b.event_id = e.id
             AND b.status = 'confirmed'
         ),
         0
       ) AS available_seats
     FROM events e
     WHERE e.id = $1::UUID
       AND e.is_deleted = FALSE`,
    [id],
  );

  return result.rows[0] ?? null;
}
