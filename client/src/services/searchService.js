import api from "./api";

export const globalSearch = (query, { type, limit, signal } = {}) => {
  const params = { q: String(query || "").trim() };
  if (type && type !== "all") params.type = type;
  if (Number.isInteger(limit)) params.limit = limit;
  return api.get("/search", { params, signal });
};
