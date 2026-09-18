import "server-only";
import { createHash } from "node:crypto";

export const SESSION_COOKIE = "dt_session";

export function expectedToken(): string | null {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(password).digest("hex");
}

export function isValidPassword(password: string): boolean {
  return password === process.env.DASHBOARD_PASSWORD;
}
