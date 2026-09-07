import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import logger from "./utils/logger.js";
import { validateProductionEnvironment } from "./config/envValidation.js";
import { markShuttingDown, markStartupComplete } from "./utils/shutdownState.js";
import { safeErrorContext } from "./utils/safeLog.js";

dotenv.config();
validateProductionEnvironment();

let httpServer;
let socketServer;
let shuttingDown = false;

const closeSocketServer = () => new Promise((resolve) => {
  if (!socketServer) return resolve();
  return socketServer.close(() => resolve());
});

const closeHttpServer = () => new Promise((resolve) => {
  if (!httpServer) return resolve();
  return httpServer.close((error) => {
    if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
      logger.error("HTTP server shutdown error", { event: "SHUTDOWN_ERROR", error: safeErrorContext(error) });
    }
    resolve();
  });
});

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  markShuttingDown();
  logger.info(`${signal} received; closing Socket.IO, HTTP server, and MongoDB connection.`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out; terminating process.");
    process.exit(1);
  }, 30000);
  forceExitTimer.unref?.();

  try {
    await closeSocketServer();
    await closeHttpServer();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    clearTimeout(forceExitTimer);
    logger.info("Graceful shutdown complete.");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    logger.error("Graceful shutdown failed", { event: "SHUTDOWN_ERROR", error: safeErrorContext(error) });
    process.exit(1);
  }
};

process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("uncaughtException", (error) => {
  logger.error("Uncaught exception; shutting down", { event: "UNCAUGHT_EXCEPTION", error: safeErrorContext(error) });
  void shutdown("uncaughtException");
});
process.once("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("Unhandled rejection; shutting down", { event: "UNHANDLED_REJECTION", error: safeErrorContext(error) });
  void shutdown("unhandledRejection");
});

const bootstrap = async () => {
  const [{ default: app }, { default: connectDB }, { initSocketServer }] = await Promise.all([
    import("./app.js"),
    import("./config/db.js"),
    import("./config/socket.js"),
  ]);

  const port = process.env.PORT || 5002;

  try {
    await connectDB();
  } catch (error) {
    logger.error("MongoDB connection failed", { event: "DB_ERROR", error: safeErrorContext(error) });
    process.exit(1);
  }

  const { scheduleDailyBackup } = await import("./services/backupService.js");
  scheduleDailyBackup();

  httpServer = http.createServer(app);
  socketServer = initSocketServer(httpServer);

  httpServer.listen(port, () => {
    const loadTestMode = String(process.env.LOAD_TEST_MODE || "").toLowerCase() === "true";
    logger.info(loadTestMode ? `Load-test server listening on ${port}` : `Server running on port ${port}`);
    markStartupComplete();
  });
};

bootstrap().catch((error) => {
  logger.error("Bootstrap failed", { event: "CONFIG_ERROR", error: safeErrorContext(error) });
  process.exit(1);
});
