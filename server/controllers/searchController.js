import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { globalSearch } from "../services/globalSearchService.js";

// Entity lookup, access checks, and tenant scoping stay in the shared service.
export const search = asyncHandler(async (req, res) => {
  const result = await globalSearch({
    user: req.user,
    query: req.query.q,
    type: req.query.type,
    limit: req.query.limit,
  });
  res.status(200).json(new ApiResponse(true, "Search results", result));
});
