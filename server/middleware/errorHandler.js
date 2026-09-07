import logger from "../utils/logger.js";
import { recordMetric } from "../utils/operationalMetrics.js";
import { redactSensitive, safeErrorContext } from "../utils/safeLog.js";

export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = typeof err.code === "string" ? err.code : null;
  const details = err.details || null;

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = err?.keyPattern?.tableNumber ? "Table number already exists." : "Duplicate value found";
    code = null;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid id format";
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Invalid or expired token";
  }

  const isDbConnectionError =
    err.name === "MongoNetworkError" ||
    err.name === "MongoServerSelectionError" ||
    String(err.message || "").includes("buffering timed out") ||
    String(err.message || "").includes("Client must be connected") ||
    String(err.message || "").includes("ECONNREFUSED");

  if (isDbConnectionError) {
    statusCode = 503;
    message = "Database temporarily unavailable. Please try again.";
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    statusCode = 409;
    message = "Duplicate value found";
  }

  recordMetric(statusCode >= 500 ? "http5xxTotal" : "httpErrorsTotal");
  logger.error("HTTP request failed", {
    requestId: req.requestId,
    method: req.method,
    route: req.originalUrl,
    status: statusCode,
    error: safeErrorContext(err),
    category: code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
  });
  const clientMessage = statusCode >= 500 && statusCode !== 503 ? "Internal server error" : message;
  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(code ? { code } : {}),
    ...(details ? { details: redactSensitive(details) } : {}),
  });
};
