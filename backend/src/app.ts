import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./config/db";
import authRoutes from "./routes/auth.routes";
import { authenticate, AuthUser } from "./middleware/auth";
import eventRoutes from "./routes/events.routes";
import bookingRoutes from "./routes/bookings.routes";
import adminRoutes from "./routes/admin.routes";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "EventBook API is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "EventBook backend is healthy",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

app.get("/api/auth/me", authenticate, (_req, res) => {
  const user = res.locals.user as AuthUser;

  res.json({
    message: "Authenticated successfully",
    user,
  });
});

export default app;
