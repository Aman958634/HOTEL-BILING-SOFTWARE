import Log from "../models/Log.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const listActivityLogs = asyncHandler(async (req, res) => {
  const { q, action, page = 1, limit = 25 } = req.query;
  const filter = { level: "activity" };
  if (action) filter["message"] = action;
  if (q) filter["context.description"] = new RegExp(q, "i");

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Log.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Log.countDocuments(filter),
  ]);

  res.status(200).json(new ApiResponse(true, "Activity logs fetched", { items, total }));
});

export default { listActivityLogs };
