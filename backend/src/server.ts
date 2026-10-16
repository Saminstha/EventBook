import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./config/db";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "EventBook API is running",
  });
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

app.listen(PORT, () => {
  console.log(`EventBook API running on http://localhost:${PORT}`);
});
