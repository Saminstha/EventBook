import bcrypt from "bcrypt";
import { pool } from "../config/db";

export async function registerUser(
  name: string,
  email: string,
  password: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), normalizedEmail, passwordHash],
    );

    return result.rows[0];
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, role
     FROM users
     WHERE email = $1`,
    [email.trim().toLowerCase()],
  );

  return result.rows[0] ?? null;
}
