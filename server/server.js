import http from "http";
import dotenv from "dotenv";
import logger from "./utils/logger.js";
import { validateProductionEnvironment } from "./config/envValidation.js";

dotenv.config();
validateProductionEnvironment();

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

  const { scheduleDailyBackup } = await import("./services/backupService.js");
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
