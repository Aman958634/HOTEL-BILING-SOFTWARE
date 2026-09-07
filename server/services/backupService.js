import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { getMongoUri } from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { safeErrorContext } from "../utils/safeLog.js";

const isProduction = () => process.env.NODE_ENV === "production";
const isEnabled = (value) => String(value || "").trim().toLowerCase() === "true";
const backupRoot = () => path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
const backupNamePattern = /^backup-\d{8}T\d{6}Z$/;
let restoreInProgress = false;

export const isDatabaseRestoreInProgress = () => restoreInProgress;

// Production containers normally have ephemeral disks. Local dump backups are
// therefore disabled unless operations explicitly supplies a durable absolute
// mount and acknowledges that it is persistent storage.
export const isLocalBackupStorageAvailable = () => {
  if (!isProduction()) return true;
  const configuredDirectory = String(process.env.BACKUP_DIR || "").trim();
  return isEnabled(process.env.BACKUP_ENABLED)
    && isEnabled(process.env.BACKUP_LOCAL_STORAGE_CONFIRMED)
    && Boolean(configuredDirectory)
    && path.isAbsolute(configuredDirectory);
};

const assertLocalBackupStorageAvailable = () => {
  if (isLocalBackupStorageAvailable()) return;
  throw new ApiError(
    503,
    "Local database backups are unavailable in production. Use provider backups or configure a durable mounted backup directory."
  );
};

const runMongoTool = (tool, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(tool, args, { shell: false, windowsHide: true });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${tool} exited with code ${code}`));
    });
  });

const getSafeBackupPath = async (backupName) => {
  const name = String(backupName || "").trim();
  if (!backupNamePattern.test(name)) throw new ApiError(422, "Invalid backup name");
  const root = backupRoot();
  const target = path.resolve(root, name);
  if (!target.startsWith(`${root}${path.sep}`)) throw new ApiError(422, "Invalid backup path");
  const info = await fs.stat(target).catch(() => null);
  if (!info?.isDirectory()) throw new ApiError(404, "Backup not found");
  return target;
};

export const listDatabaseBackups = async () => {
  assertLocalBackupStorageAvailable();
  const root = backupRoot();
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const backups = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && backupNamePattern.test(entry.name))
    .map(async (entry) => {
      const info = await fs.stat(path.join(root, entry.name));
      return { name: entry.name, createdAt: info.birthtime, modifiedAt: info.mtime };
    }));
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const createDatabaseBackup = async () => {
  assertLocalBackupStorageAvailable();
  const uri = getMongoUri();
  if (!uri) throw new ApiError(503, "Database URI is not configured");
  const root = backupRoot();
  await fs.mkdir(root, { recursive: true });
  const name = `backup-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;
  const target = path.join(root, name);
  await fs.mkdir(target, { recursive: false });
  try {
    await runMongoTool(process.env.MONGODUMP_PATH || "mongodump", ["--uri", uri, "--out", target]);
    return { name, createdAt: new Date() };
  } catch (error) {
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    logger.error("Database backup failed", { event: "DB_BACKUP_ERROR", error: safeErrorContext(error) });
    throw new ApiError(500, "Backup failed. Check the server logs for the operation result.");
  }
};

export const restoreDatabaseBackup = async (backupName) => {
  assertLocalBackupStorageAvailable();
  const uri = getMongoUri();
  if (!uri) throw new ApiError(503, "Database URI is not configured");
  const target = await getSafeBackupPath(backupName);
  restoreInProgress = true;
  try {
    await runMongoTool(process.env.MONGORESTORE_PATH || "mongorestore", ["--uri", uri, "--drop", "--stopOnError", target]);
  } catch (error) {
    logger.error("Database restore failed", { event: "DB_RESTORE_ERROR", error: safeErrorContext(error) });
    throw new ApiError(500, "Restore failed. Check the server logs for the operation result.");
  } finally {
    restoreInProgress = false;
  }
  return { name: String(backupName), restoredAt: new Date() };
};

export const scheduleDailyBackup = () => {
  const enabledByDefault = isProduction() ? "false" : "true";
  if (!isEnabled(process.env.BACKUP_ENABLED || enabledByDefault)) {
    logger.info("Automatic local database backups are disabled.");
    return null;
  }
  if (!isLocalBackupStorageAvailable()) {
    logger.warn("Automatic local database backups are disabled in production until durable mounted storage is explicitly configured. Configure managed database backups separately.");
    return null;
  }
  const configuredHour = Number(process.env.BACKUP_HOUR_UTC ?? 2);
  const hour = Number.isInteger(configuredHour) && configuredHour >= 0 && configuredHour <= 23 ? configuredHour : 2;
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const delay = next.getTime() - now.getTime();
  const timer = setTimeout(async () => {
    try {
      const backup = await createDatabaseBackup();
      logger.info(`Daily database backup completed: ${backup.name}`);
    } catch (error) {
      logger.error("Daily database backup failed", { event: "DB_BACKUP_ERROR", error: safeErrorContext(error) });
    }
    scheduleDailyBackup();
  }, delay);
  timer.unref?.();
  logger.info(`Daily database backup scheduled for ${next.toISOString()}`);
  return timer;
};
