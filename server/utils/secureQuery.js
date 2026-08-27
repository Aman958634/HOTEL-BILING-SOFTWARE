import ApiError from "./ApiError.js";

const isSuperAdmin = (req) => req?.user?.role === "super_admin";

export const getOutletContext = (req) => {
  const outletId = req?.outletId || req?.user?.outletId;
  if (!outletId && !isSuperAdmin(req)) throw new ApiError(403, "Outlet context is required");
  return { restaurant: req?.user?.restaurant || null, outlet: outletId || null };
};

export const secureFilter = (req, query = {}) => {
  const context = getOutletContext(req);
  if (isSuperAdmin(req)) return context.outlet ? { ...query, outlet: context.outlet } : query;
  return { ...query, restaurant: context.restaurant, outlet: context.outlet };
};

export const secureQuery = (model, req, query = {}) => model.find(secureFilter(req, query));
export const secureFindOne = (model, req, query = {}) => model.findOne(secureFilter(req, query));
export const secureWrite = (model, req, query = {}, update = {}, options = {}) =>
  model.updateOne(secureFilter(req, query), update, options);
export const secureAggregate = (model, req, pipeline = []) => {
  const context = getOutletContext(req);
  const match = context.outlet ? { outlet: context.outlet, ...(context.restaurant ? { restaurant: context.restaurant } : {}) } : {};
  return model.aggregate(match ? [{ $match: match }, ...pipeline] : pipeline);
};
