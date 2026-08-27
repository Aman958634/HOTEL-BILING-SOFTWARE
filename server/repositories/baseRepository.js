import ApiError from "../utils/ApiError.js";

const trusted = (context) => context?.role === "system" || context?.role === "super_admin";

export const assertRepositoryContext = (context) => {
  if (trusted(context)) return context;
  if (!context?.restaurantId || !context?.outletId) {
    throw new ApiError(403, "Restaurant and outlet context are required");
  }
  return context;
};

export const scopedFilter = (context, filter = {}) => {
  const scope = assertRepositoryContext(context);
  if (scope.role === "super_admin" && !scope.outletId) return { ...filter };
  return { ...filter, restaurant: scope.restaurantId, outlet: scope.outletId };
};

export const contextFromRequest = (req) => ({
  restaurantId: req?.user?.restaurant || req?.restaurantId || null,
  outletId: req?.outletId || req?.user?.outletId || null,
  role: req?.user?.role || "",
});

export const createRepository = (Model) => ({
  find: (context, filter = {}, options = {}) => Model.find(scopedFilter(context, filter), null, options),
  findOne: (context, filter = {}, options = {}) => Model.findOne(scopedFilter(context, filter), null, options),
  create: async (context, document, options = {}) => {
    const [created] = await Model.create([{ ...document, ...scopedFilter(context) }], options);
    return created;
  },
  update: (context, filter, update, options = {}) => Model.updateMany(scopedFilter(context, filter), update, options),
  updateOne: (context, filter, update, options = {}) => Model.updateOne(scopedFilter(context, filter), update, options),
  aggregate: (context, pipeline = []) => {
    const scope = assertRepositoryContext(context);
    const match = scope.role === "super_admin" && !scope.outletId
      ? {}
      : { restaurant: scope.restaurantId, outlet: scope.outletId };
    return Model.aggregate([{ $match: match }, ...pipeline]);
  },
});
