import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { findUserByEmail, registerUser } from "../services/auth.service";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

function createAccessToken(user: { id: string; role: "user" | "admin" }) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ role: user.role }, secret, {
    subject: user.id,
    expiresIn: "1h",
  });
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid registration details",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const user = await registerUser(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
    );

    res.status(201).json({
      message: "Registration successful",
      user,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      res.status(409).json({
        message: "An account with this email already exists",
      });
      return;
    }

    console.error("Registration failed:", error);
    res.status(500).json({
      message: "Unable to register account",
    });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid login details",
    });
    return;
  }

  try {
    const user = await findUserByEmail(parsed.data.email);

    if (
      !user ||
      !(await bcrypt.compare(parsed.data.password, user.password_hash))
    ) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    const accessToken = createAccessToken({
      id: user.id,
      role: user.role,
    });

    res.json({
      message: "Login successful",
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({
      message: "Unable to log in",
    });
  }
});

export default router;
