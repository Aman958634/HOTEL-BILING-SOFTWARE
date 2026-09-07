import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

const rateLimitHandler = (req, res) => {
  logger.warn("Rate limit exceeded", { event: "RATE_LIMIT", requestId: req.requestId, method: req.method, route: req.originalUrl });
  res.status(429).json({ success: false, message: "Too many requests, try again later." });
};

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, try again later." },
  handler: rateLimitHandler,
  skip: (req) => req.method === "OPTIONS" || req.path === "/api/v1/health" || req.path === "/api/v1/ready",
});

export const intelligenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many intelligence requests. Please try again shortly." },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many search requests. Please try again shortly." },
});

/** Failed login attempts are deliberately tighter than normal POS traffic. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many login attempts. Please wait a few minutes and try again." },
});

/** Public account creation gets its own abuse budget and never affects login attempts. */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many signup attempts. Please try again later." },
});

/** Password recovery is separately bounded because it is a public email-triggering flow. */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many password reset attempts. Please try again later." },
});

/** Public QR/guest ordering is unauthenticated and therefore separately bounded. */
export const publicOrderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many order attempts. Please try again shortly." },
});

/** Provider-payment initiation and verification need stricter abuse bounds than general API traffic. */
export const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment attempts. Please try again shortly." },
});
