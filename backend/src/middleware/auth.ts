import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  role: "user" | "admin";
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ message: "Server configuration error" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      (decoded.role !== "user" && decoded.role !== "admin")
    ) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    res.locals.user = {
      id: decoded.sub,
      role: decoded.role,
    } satisfies AuthUser;

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthUser | undefined;

  if (!user || user.role !== "admin") {
    res.status(403).json({ message: "Administrator access required" });
    return;
  }

  next();
}
