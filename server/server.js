import http from "http";
import dotenv from "dotenv";
import logger from "./utils/logger.js";

dotenv.config();

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
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  const [{ reconcilePaymentSettlements }, { scheduleDailyBackup }] = await Promise.all([
    import("./services/paymentService.js"),
    import("./services/backupService.js"),
  ]);
  try {
    const repaired = await reconcilePaymentSettlements();
    if (repaired) logger.info(`Recovered ${repaired} payment settlement(s) after startup`);
  } catch (error) {
    // The server stays available, but production MongoDB must be a replica
    // set so the payment transaction and recovery guarantees can run.
    logger.error(`Payment settlement recovery failed: ${error.message}`);
  }
  scheduleDailyBackup();

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
};

bootstrap().catch((error) => {
  logger.error(`Bootstrap failed: ${error.message}`);
  process.exit(1);
});
