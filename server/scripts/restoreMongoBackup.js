import dotenv from "dotenv";
import { restoreMongoBackup } from "../services/backupService.js";

dotenv.config();
const directory = process.argv[2];
if (!directory) throw new Error("Usage: node scripts/restoreMongoBackup.js <backup-directory>");
await restoreMongoBackup(directory);
console.log(`Restored MongoDB backup from ${directory}`);
