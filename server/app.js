import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { limiter } from "./middleware/rateLimiter.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireDb } from "./middleware/dbReady.js";
import { isDbConnected } from "./config/db.js";
import { isOriginAllowed } from "./utils/allowedOrigins.js";
import authRoutes from "./routes/authRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import serviceCockpitRoutes from "./routes/serviceCockpitRoutes.js";

import searchRoutes from "./routes/searchRoutes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.join(__dirname, "docs", "openapi.json");
const openapiSpec = JSON.parse(fs.readFileSync(openapiPath, "utf-8"));

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined"));
app.use(limiter);

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    database: isDbConnected() ? "connected" : "disconnected",
  });
});

app.get("/api-docs/openapi.json", (_req, res) => {
  res.status(200).json(openapiSpec);
});

// All API routes require an active MongoDB connection (except health probe).
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  if (req.path === "/api/v1/health") return next();
  return requireDb(req, res, next);
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/super-admin", superAdminRoutes);
app.use("/api/v1/tables", tableRoutes);
app.use("/api/v1/cockpit", serviceCockpitRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/resources", resourceRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/v1/reservations", reservationRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/search", searchRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
