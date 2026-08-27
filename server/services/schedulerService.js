import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";
import Subscription from "../models/Subscription.js";
import { createMongoBackup } from "./backupService.js";
import { getEffectiveTrialEndDate } from "../utils/subscriptionUtils.js";
import logger from "../utils/logger.js";
import { runWithTenantContext } from "../utils/tenantContext.js";

let started = false;

export const startSchedulers = () => {
  if (started || process.env.DISABLE_SCHEDULERS === "true") return;
  started = true;
  const systemContext = { role: "system", restaurantId: null, outletId: null };
  cron.schedule(process.env.BACKUP_CRON || "0 2 * * *", () => runWithTenantContext(systemContext, () => createMongoBackup()).catch(() => {}));
  cron.schedule("*/15 * * * *", () => runWithTenantContext(systemContext, async () => {
    const now = new Date();
    const trials = await Subscription.find({ status: "trial" }).select("trialEndDate trialEndAt trialStartDate startDate");
    for (const subscription of trials) {
      const end = getEffectiveTrialEndDate(subscription);
      if (end && now >= end) await Subscription.updateOne({ _id: subscription._id, status: "trial" }, { $set: { status: "expired" } });
    }
  }));
  cron.schedule("0 3 * * *", () => runWithTenantContext(systemContext, async () => {
    const logDir = path.resolve(process.env.LOG_DIR || "./logs");
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const entry of await fs.readdir(logDir).catch(() => [])) {
      const file = path.join(logDir, entry);
      const stat = await fs.stat(file).catch(() => null);
      if (stat?.isFile() && stat.mtimeMs < cutoff) await fs.rm(file, { force: true });
    }
  }));
  logger.info("Production schedulers started");
};
