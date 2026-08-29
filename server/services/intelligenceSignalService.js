import IntelligenceInsight from "../models/IntelligenceInsight.js";
import { getBusinessIntelligenceOverview } from "./businessIntelligenceService.js";

export const DEFAULT_INTELLIGENCE_THRESHOLDS = Object.freeze({
  minimumOrdersForTrend: 5,
  salesChangePercent: 15,
  orderChangePercent: 15,
  lowStockCount: 1,
  topItemQuantity: 5,
});

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const percent = (metric) => metric?.growth?.value;
const evidence = (metric, unit = "number") => ({ metric, current: number(metric?.current), baseline: number(metric?.previous), change: metric?.growth?.value ?? null, unit });
const period = (bi) => ({ range: bi.period.range, start: bi.period.start, end: bi.period.end });
const insight = ({ signalKey, category, severity, title, summary, evidence: rows, actions, confidence, bi }) => ({ signalKey, category, severity, title, summary, evidence: rows, recommendedActions: actions, confidence, dataPeriod: period(bi), generatedAt: new Date() });

export const detectSignals = (bi, thresholds = DEFAULT_INTELLIGENCE_THRESHOLDS) => {
  const signals = []; const orders = number(bi.overview?.orders?.current); const priorOrders = number(bi.overview?.orders?.previous); const salesChange = percent(bi.overview?.netSales); const orderChange = percent(bi.overview?.orders);
  if (orders < thresholds.minimumOrdersForTrend || priorOrders < thresholds.minimumOrdersForTrend) {
    signals.push(insight({ signalKey: "insufficient-history", category: "DATA_QUALITY", severity: "INFO", title: "Not enough comparable order history", summary: `Only ${orders} qualifying order(s) are available in this period; trend alerts are held back until both periods have enough activity.`, evidence: [evidence(bi.overview?.orders, "orders")], actions: ["Continue recording completed orders to strengthen comparisons."], confidence: "LOW", bi }));
  } else {
    if (salesChange !== null && salesChange <= -thresholds.salesChangePercent) signals.push(insight({ signalKey: "net-sales-decline", category: "SALES", severity: "ATTENTION", title: "Net sales decreased", summary: `Net sales are ${Math.abs(salesChange)}% below the previous comparable period (${number(bi.overview.netSales.current)} versus ${number(bi.overview.netSales.previous)}).`, evidence: [evidence(bi.overview.netSales, "INR"), evidence(bi.overview.orders, "orders")], actions: ["Review order volume by source and peak-hour traffic before changing prices or menu items."], confidence: "HIGH", bi }));
    if (salesChange !== null && salesChange >= thresholds.salesChangePercent) signals.push(insight({ signalKey: "net-sales-increase", category: "SALES", severity: "OPPORTUNITY", title: "Net sales increased", summary: `Net sales are ${salesChange}% above the previous comparable period.`, evidence: [evidence(bi.overview.netSales, "INR")], actions: ["Review the strongest order sources and service periods to understand the increase."], confidence: "HIGH", bi }));
    if (orderChange !== null && orderChange <= -thresholds.orderChangePercent) signals.push(insight({ signalKey: "order-volume-decline", category: "ORDERS", severity: "ATTENTION", title: "Order volume declined", summary: `Qualifying order volume is ${Math.abs(orderChange)}% below the previous comparable period.`, evidence: [evidence(bi.overview.orders, "orders")], actions: ["Review availability, order channels, and service demand for the selected period."], confidence: "HIGH", bi }));
  }
  const reconciliation = bi.payments?.reconciliation || {};
  if (number(reconciliation.unreconciledPayments) > 0) signals.push(insight({ signalKey: "unreconciled-payments", category: "RECONCILIATION", severity: "ATTENTION", title: "Payments need reconciliation", summary: `${number(reconciliation.unreconciledPayments)} payment record(s) remain unreconciled.`, evidence: [{ metric: "Unreconciled payments", current: number(reconciliation.unreconciledPayments), unit: "payments" }], actions: ["Review the Payment Reconciliation workspace and resolve valid mismatches."], confidence: "HIGH", bi }));
  if (number(reconciliation.cashMismatchCount) > 0) signals.push(insight({ signalKey: "cash-variance", category: "RECONCILIATION", severity: "ATTENTION", title: "Cash variance recorded", summary: `${number(reconciliation.cashMismatchCount)} cash close mismatch(es) were recorded, with a net variance of ${number(reconciliation.cashVariance)}.`, evidence: [{ metric: "Cash variance", current: number(reconciliation.cashVariance), unit: "INR" }], actions: ["Review cash-close notes and supporting payment records; no transaction is changed by this alert."], confidence: "HIGH", bi }));
  if (number(bi.operations?.inventory?.lowStockCount) >= thresholds.lowStockCount) signals.push(insight({ signalKey: "low-stock", category: "INVENTORY", severity: "ATTENTION", title: "Low stock requires review", summary: `${number(bi.operations.inventory.lowStockCount)} active inventory item(s) are at or below their reorder level.`, evidence: [{ metric: "Low-stock items", current: number(bi.operations.inventory.lowStockCount), unit: "items" }], actions: ["Review stock levels and usage before creating any purchase request."], confidence: "HIGH", bi }));
  const topItem = bi.menu?.topItems?.[0];
  if (topItem && number(topItem.quantity) >= thresholds.topItemQuantity) signals.push(insight({ signalKey: `top-item-${String(topItem.item).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`, category: "MENU", severity: "INFO", title: "High-volume menu item", summary: `${topItem.item} sold ${number(topItem.quantity)} unit(s) in the selected period.`, evidence: [{ metric: "Units sold", current: number(topItem.quantity), unit: "units" }, { metric: "Item sales", current: number(topItem.sales), unit: "INR" }], actions: ["Review availability and ingredient readiness for this item during busy periods."], confidence: orders >= thresholds.minimumOrdersForTrend ? "MEDIUM" : "LOW", bi }));
  if (!bi.operations?.kitchen?.preparationTimeAvailable) signals.push(insight({ signalKey: "kitchen-timestamp-gap", category: "DATA_QUALITY", severity: "INFO", title: "Kitchen duration insight unavailable", summary: "KOT preparation-start and ready timestamps are not stored, so preparation-time alerts are not generated.", evidence: [], actions: ["Capture reliable KOT lifecycle timestamps before relying on kitchen-duration insights."], confidence: "HIGH", bi }));
  return signals;
};

export const buildExecutiveSummary = (signals) => {
  const actionable = signals.filter((row) => ["CRITICAL", "ATTENTION", "OPPORTUNITY"].includes(row.severity)).slice(0, 3);
  if (!actionable.length) return "No material deterministic alerts were detected for this period.";
  return actionable.map((row) => row.summary).join(" ");
};

export const getIntelligenceSnapshot = async ({ restaurantId, query }) => {
  const bi = await getBusinessIntelligenceOverview({ restaurantId, query }); const insights = detectSignals(bi);
  return { bi, insights, executiveSummary: buildExecutiveSummary(insights) };
};

export const persistInsights = async ({ restaurantId, query }) => {
  const snapshot = await getIntelligenceSnapshot({ restaurantId, query });
  const records = await Promise.all(snapshot.insights.map(async (row) => IntelligenceInsight.findOneAndUpdate({ restaurant: restaurantId, signalKey: row.signalKey, "dataPeriod.start": row.dataPeriod.start, "dataPeriod.end": row.dataPeriod.end }, { $set: { ...row, restaurant: restaurantId }, $setOnInsert: { status: "ACTIVE" } }, { upsert: true, new: true, setDefaultsOnInsert: true })));
  return { ...snapshot, insights: records };
};

export const answerAllowedQuestion = ({ question, snapshot }) => {
  const input = String(question || "").trim().toLowerCase(); const bi = snapshot.bi;
  if (/(sales|revenue|week|today)/.test(input)) return { intent: "SALES_SUMMARY", answer: `Net sales are ${number(bi.overview.netSales.current)} for the selected period, compared with ${number(bi.overview.netSales.previous)} previously.`, evidence: [evidence(bi.overview.netSales, "INR"), evidence(bi.overview.orders, "orders")] };
  if (/(top|item|menu)/.test(input)) { const item = bi.menu?.topItems?.[0]; return { intent: "TOP_ITEMS", answer: item ? `${item.item} is the highest-volume item in this period with ${number(item.quantity)} units sold.` : "No qualifying menu-item sales are available for this period.", evidence: item ? [{ metric: "Units sold", current: number(item.quantity), unit: "units" }] : [] }; }
  if (/(refund|payment|cash|reconcil)/.test(input)) return { intent: "PAYMENT_MIX", answer: `Net collected is ${number(bi.overview.netCollected.current)}. There are ${number(bi.payments.reconciliation?.unreconciledPayments)} unreconciled payment record(s).`, evidence: [evidence(bi.overview.netCollected, "INR"), { metric: "Unreconciled payments", current: number(bi.payments.reconciliation?.unreconciledPayments), unit: "payments" }] };
  if (/(busy|peak|hour)/.test(input)) return { intent: "PEAK_HOURS", answer: bi.sales.peakHours?.length ? `The busiest recorded hours are ${bi.sales.peakHours.map((row) => `${String(row.hour).padStart(2, "0")}:00`).join(", ")}.` : "No peak-hour data is available for this period.", evidence: (bi.sales.peakHours || []).map((row) => ({ metric: `${row.hour}:00 orders`, current: number(row.orders), unit: "orders" })) };
  if (/(inventory|stock)/.test(input)) return { intent: "INVENTORY_RISK", answer: `${number(bi.operations.inventory?.lowStockCount)} inventory item(s) are currently at or below their reorder level.`, evidence: [{ metric: "Low-stock items", current: number(bi.operations.inventory?.lowStockCount), unit: "items" }] };
  return { intent: "UNSUPPORTED", answer: "I can answer sales, top items, payment/reconciliation, peak-hour, and inventory-risk questions using the selected period's verified BI metrics.", evidence: [] };
};
