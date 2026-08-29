import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { getBusinessIntelligenceOverview } from "../services/businessIntelligenceService.js";

export const getBusinessIntelligence = asyncHandler(async (req, res) => {
  const scope = await buildRestaurantQuery({}, req.user);
  if (!scope.restaurant || Array.isArray(scope.restaurant?.$in)) throw new ApiError(403, "A single authorized restaurant context is required for business intelligence");
  const data = await getBusinessIntelligenceOverview({ restaurantId: scope.restaurant, query: req.query });
  res.json(new ApiResponse(true, "Business intelligence fetched", data));
});
