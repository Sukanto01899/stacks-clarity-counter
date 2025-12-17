import { RequestHandler } from "express";
import { CHAINHOOK_AUTH_TOKEN } from "./config";

// Middleware to verify Chainhook auth
export const verifyAuth: RequestHandler = (req, res, next) => {
  if (!CHAINHOOK_AUTH_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const authHeader = req.headers.authorization;
  const expectedHeader = `Bearer ${CHAINHOOK_AUTH_TOKEN}`;
  const tokenQuery = req.query.token;

  if (authHeader === expectedHeader) {
    next();
    return;
  }

  if (typeof tokenQuery === "string" && tokenQuery === CHAINHOOK_AUTH_TOKEN) {
    next();
    return;
  }

  if (Array.isArray(tokenQuery) && tokenQuery[0] === CHAINHOOK_AUTH_TOKEN) {
    next();
    return;
  }

  {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
};
