import IntelligenceInsight from "../models/IntelligenceInsight.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { createActivity } from "../services/activityService.js";
import { answerAllowedQuestion, getIntelligenceSnapshot, persistInsights } from "../services/intelligenceSignalService.js";
import { getIntelligenceProviderStatus } from "../services/intelligenceProviderService.js";

const restaurantFor = async (user) => {
  const scope = await buildRestaurantQuery({}, user);
  if (!scope.restaurant || Array.isArray(scope.restaurant?.$in)) throw new ApiError(403, "A single authorized restaurant context is required for intelligence");
  return scope.restaurant;
};

export const getIntelligenceSummary = asyncHandler(async (req, res) => {
  const restaurantId = await restaurantFor(req.user);
  const snapshot = await getIntelligenceSnapshot({ restaurantId, query: req.query });
  res.json(new ApiResponse(true, "Intelligence summary fetched", { executiveSummary: snapshot.executiveSummary, insights: snapshot.insights, period: snapshot.bi.period, provider: getIntelligenceProviderStatus() }));
});

export const refreshIntelligence = asyncHandler(async (req, res) => {
  const restaurantId = await restaurantFor(req.user);
  const snapshot = await persistInsights({ restaurantId, query: req.body });
  await createActivity({ action: "Intelligence Refreshed", description: "Deterministic business insights refreshed", performedBy: req.user._id, restaurantId, targetType: "Intelligence" });
  res.json(new ApiResponse(true, "Intelligence insights refreshed", { executiveSummary: snapshot.executiveSummary, insights: snapshot.insights, period: snapshot.bi.period, provider: getIntelligenceProviderStatus() }));
});

export const listIntelligenceInsights = asyncHandler(async (req, res) => {
  const restaurantId = await restaurantFor(req.user); const page = Math.max(Number(req.query.page) || 1, 1); const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100); const filter = { restaurant: restaurantId };
  if (req.query.status) filter.status = String(req.query.status).toUpperCase();
  const [items, total] = await Promise.all([IntelligenceInsight.find(filter).sort({ generatedAt: -1, severity: -1 }).skip((page - 1) * limit).limit(limit).lean(), IntelligenceInsight.countDocuments(filter)]);
  res.json(new ApiResponse(true, "Intelligence insights fetched", items, { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }));
});

export const updateInsightStatus = asyncHandler(async (req, res) => {
  const restaurantId = await restaurantFor(req.user); const status = String(req.body.status || "").toUpperCase();
  const insight = await IntelligenceInsight.findOne({ _id: req.params.id, restaurant: restaurantId }); if (!insight) throw new ApiError(404, "Insight not found");
  insight.status = status;
  if (status === "ACKNOWLEDGED") { insight.acknowledgedAt = new Date(); insight.acknowledgedBy = req.user._id; }
  if (status === "RESOLVED") { insight.resolvedAt = new Date(); insight.resolvedBy = req.user._id; }
  await insight.save(); await createActivity({ action: `Intelligence ${status}`, description: insight.title, performedBy: req.user._id, restaurantId, targetId: insight._id, targetType: "IntelligenceInsight" });
  res.json(new ApiResponse(true, "Insight status updated", insight));
});

export const askIntelligence = asyncHandler(async (req, res) => {
  const restaurantId = await restaurantFor(req.user); const snapshot = await getIntelligenceSnapshot({ restaurantId, query: req.body.range ? { range: req.body.range, startDate: req.body.startDate, endDate: req.body.endDate } : {} });
  // The allowlisted deterministic mapper never creates database queries from user text.
  res.json(new ApiResponse(true, "Intelligence answer generated", { ...answerAllowedQuestion({ question: req.body.question, snapshot }), period: snapshot.bi.period, provider: getIntelligenceProviderStatus() }));
});
