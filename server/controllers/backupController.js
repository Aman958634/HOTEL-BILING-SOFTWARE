import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createDatabaseBackup, listDatabaseBackups, restoreDatabaseBackup } from "../services/backupService.js";

export const listBackups = asyncHandler(async (_req, res) => {
  const backups = await listDatabaseBackups();
  res.status(200).json(new ApiResponse(true, "Backups fetched", backups));
});

export const createBackup = asyncHandler(async (_req, res) => {
  const backup = await createDatabaseBackup();
  res.status(201).json(new ApiResponse(true, "Database backup created", backup));
});

export const restoreBackup = asyncHandler(async (req, res) => {
  if (
    String(process.env.ENABLE_BACKUP_RESTORE || "").toLowerCase() !== "true"
    || String(process.env.BACKUP_RESTORE_MAINTENANCE_MODE || "").toLowerCase() !== "true"
  ) {
    throw new ApiError(403, "Backup restore is disabled. Enable it only during a planned maintenance window.");
  }
  const backupName = String(req.body?.backupName || "").trim();
  if (req.body?.confirmation !== `RESTORE ${backupName}`) {
    throw new ApiError(422, "Confirmation must equal RESTORE <backupName>");
  }
  const result = await restoreDatabaseBackup(backupName);
  res.status(200).json(new ApiResponse(true, "Database restored. Restart the server before reopening POS terminals.", result));
});
