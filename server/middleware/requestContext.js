import crypto from "crypto";
import logger from "../utils/logger.js";
import { recordMetric } from "../utils/operationalMetrics.js";

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestContext = (req, res, next) => {
  const suppliedRequestId = String(req.get("X-Request-Id") || "").trim();
  const requestId = REQUEST_ID_PATTERN.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (durationMs >= SLOW_REQUEST_MS) {
      recordMetric("slowRequestsTotal");
      logger.warn("Slow HTTP request", {
        requestId,
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    }
    recordMetric("httpRequestsTotal");
    if (res.statusCode >= 500) recordMetric("http5xxTotal");
  });

  next();
};
