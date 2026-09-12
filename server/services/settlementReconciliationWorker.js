import SettlementTransaction from "../models/SettlementTransaction.js";
import { reconcileCashfreeSettlement } from "./easySplitSettlementService.js";
import { getCashfreeConfig } from "../config/cashfree.js";
import logger from "../utils/logger.js";
import { safeErrorContext } from "../utils/safeLog.js";

// Only reads provider state for existing allocations. It never calls checkout,
// vendor creation, or the post-payment split API. Explicitly opt-in.
export const createSettlementReconciliationWorker = ({
  model = SettlementTransaction, reconcile = reconcileCashfreeSettlement,
  config = getCashfreeConfig, enabled = () => getCashfreeConfig().settlementReconciliationEnabled,
  now = () => Date.now(), intervalMs = 60000, batchSize = 20,
  onError = (error) => logger.warn("Background settlement reconciliation failed", { error: safeErrorContext(error) }),
} = {}) => {
  let inFlight = null;
  let timer = null;
  let stopped = false;
  const runOnce = () => {
    if (inFlight) return Promise.resolve({ skipped: "already_running" });
    if (stopped || !enabled()) return Promise.resolve({ skipped: "disabled" });
    const settings = config();
    if (!["sandbox", "production"].includes(settings.environment) || !settings.configured || !settings.easySplitEnabled || !settings.easySplitPaymentsEnabled) {
      return Promise.resolve({ skipped: "preflight" });
    }
    inFlight = (async () => {
      const candidates = await model.find({
        provider: "CASHFREE",
        settlementStatus: { $in: ["NOT_SCHEDULED", "PENDING", "PROCESSING", "ON_HOLD"] },
        $and: [
          { $or: [{ splitStatus: "ALLOCATED" }, { allocationStrategy: "ORDER_CREATION_SPLIT", splitStatus: { $in: ["PENDING", "PROCESSING"] } }] },
          { $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lt: new Date(now() - intervalMs) } }] },
        ],
      }).sort({ lastReconciledAt: 1, _id: 1 }).limit(batchSize).select("_id").lean();
      const result = { attempted: 0, succeeded: 0, failed: 0 };
      for (const transaction of candidates) {
        if (stopped) break;
        result.attempted++;
        try { await reconcile(transaction._id, { source: "background_reconciliation" }); result.succeeded++; }
        catch (error) { result.failed++; onError(error); }
      }
      return result;
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
  return {
    runOnce,
    start() {
      if (timer || !enabled() || stopped) return;
      timer = setInterval(() => { void runOnce().catch(onError); }, intervalMs);
      timer.unref?.();
    },
    async stop() { stopped = true; if (timer) clearInterval(timer); timer = null; await inFlight?.catch(onError); },
  };
};
