import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";

describe("EventBook API", () => {
  it("should return a message from the root endpoint", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("EventBook API is running");
  });

  it("should return a healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.message).toBe("EventBook backend is healthy");
  });

  it("should reject invalid registration data", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "123",
    });

    expect(response.status).toBe(400);
  });
});

afterAll(async () => {
  await pool.end();
});
