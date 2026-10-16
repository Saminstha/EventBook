import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { pool } from "./config/db";

dotenv.config();

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const userPassword = process.env.SEED_USER_PASSWORD;

  if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
    throw new Error("Seed account credentials are missing from .env");
  }

  if (adminEmail === userEmail) {
    throw new Error("Admin and normal user must have different emails");
  }

  if (adminPassword.length < 12 || userPassword.length < 12) {
    throw new Error("Seed passwords must be at least 12 characters long");
  }

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const userHash = await bcrypt.hash(userPassword, 12);

  // Create or update the development admin account.
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('EventBook Admin', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin'`,
    [adminEmail, adminHash],
  );

  // Create or update the normal development account.
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Test User', $1, $2, 'user')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'user'`,
    [userEmail, userHash],
  );

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const events = [
    {
      title: "Past Community Meetup",
      description: "A sample past event for testing event listings.",
      date: new Date(now - 7 * day),
      venue: "Kathmandu Community Hall",
      seats: 30,
    },
    {
      title: "Introduction to Web Development",
      description: "Learn the basics of modern web development.",
      date: new Date(now + 3 * day),
      venue: "Tech Hub, Kathmandu",
      seats: 50,
    },
    {
      title: "Full Stack Developer Workshop",
      description: "A practical workshop on frontend and backend development.",
      date: new Date(now + 7 * day),
      venue: "Innovation Center, Kathmandu",
      seats: 2,
    },
    {
      title: "Design and Technology Meetup",
      description: "Discuss design, technology, and product development.",
      date: new Date(now + 14 * day),
      venue: "City Conference Center",
      seats: 80,
    },
    {
      title: "Startup Networking Evening",
      description: "Meet people building new products and businesses.",
      date: new Date(now + 21 * day),
      venue: "Business Park, Kathmandu",
      seats: 100,
    },
  ];

  for (const event of events) {
    await pool.query(
      `INSERT INTO events
     (title, description, event_datetime, venue, total_seats)
   SELECT
     $1::VARCHAR,
     $2::TEXT,
     $3::TIMESTAMPTZ,
     $4::VARCHAR,
     $5::INTEGER
   WHERE NOT EXISTS (
     SELECT 1
     FROM events
     WHERE title = $1::VARCHAR
   )`,
      [
        event.title,
        event.description,
        event.date.toISOString(),
        event.venue,
        event.seats,
      ],
    );
  }

  // Give the test user one seat at the two-seat workshop,
  // so the event starts nearly full for testing.
  await pool.query(
    `INSERT INTO bookings (user_id, event_id, status)
   SELECT u.id, e.id, 'confirmed'
   FROM users u
   CROSS JOIN events e
   WHERE u.email = $1::VARCHAR
     AND e.title = $2::VARCHAR
     AND e.event_datetime > NOW()
   ON CONFLICT (user_id, event_id)
     WHERE status = 'confirmed'
   DO NOTHING`,
    [userEmail, "Full Stack Developer Workshop"],
  );

  console.log("Seed completed successfully.");
  console.log("Created/updated development accounts and sample events.");
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
