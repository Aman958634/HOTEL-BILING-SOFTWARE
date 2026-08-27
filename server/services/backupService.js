import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import logger from "../utils/logger.js";

const execFileAsync = promisify(execFile);
const backupRoot = () => path.resolve(process.env.BACKUP_DIR || "./backups");

const mongoArgs = () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI is required for backup");
  return ["--uri", uri, "--gzip"];
};

export const createMongoBackup = async () => {
  const root = backupRoot();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(root, stamp);
  await fs.mkdir(destination, { recursive: true });
  try {
    await execFileAsync(process.env.MONGODUMP_BIN || "mongodump", [...mongoArgs(), "--out", destination], { maxBuffer: 1024 * 1024 });
    await fs.writeFile(path.join(destination, "COMPLETE"), new Date().toISOString(), "utf8");
    await rotateBackups();
    logger.info(`MongoDB backup completed: ${destination}`);
    return destination;
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    logger.error(`MongoDB backup failed: ${error.message}`);
    throw error;
  }
};

export const rotateBackups = async (keep = 7) => {
  const root = backupRoot();
  const entries = (await fs.readdir(root, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory());
  const complete = [];
  for (const entry of entries) {
    if (await fs.access(path.join(root, entry.name, "COMPLETE")).then(() => true).catch(() => false)) complete.push(entry);
  }
  complete.sort((a, b) => b.name.localeCompare(a.name));
  await Promise.all(complete.slice(keep).map((entry) => fs.rm(path.join(root, entry.name), { recursive: true, force: true })));
};

export const restoreMongoBackup = async (directory) => {
  const source = path.resolve(directory || "");
  await fs.access(path.join(source, "COMPLETE"));
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI is required for restore");
  await execFileAsync(process.env.MONGORESTORE_BIN || "mongorestore", ["--uri", uri, "--gzip", "--drop", source]);
};
