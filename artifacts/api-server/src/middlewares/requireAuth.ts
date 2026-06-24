import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";

/**
 * Gate a route behind a valid Clerk session. The web client authenticates with
 * httpOnly session cookies (same-origin through the shared proxy), so no bearer
 * token handling is needed here.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
