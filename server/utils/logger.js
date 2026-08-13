import fs from "fs";
import path from "path";
import winston from "winston";

const logDir = path.resolve("server/logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

export default logger;
