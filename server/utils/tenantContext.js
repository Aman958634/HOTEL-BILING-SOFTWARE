import { AsyncLocalStorage } from "node:async_hooks";
import ApiError from "./ApiError.js";

export const tenantStorage = new AsyncLocalStorage();

export const runWithTenantContext = (context, callback) => tenantStorage.run(context, callback);
export const getTenantContext = () => tenantStorage.getStore() || null;

const isScopedModel = (query) => Boolean(query.model?.schema?.path("outlet"));
const assertContext = (query) => {
  const context = getTenantContext();
  if (!context || context.role === "super_admin") return context;
  if (!context.restaurantId || !context.outletId) throw new ApiError(403, "Tenant and outlet context is required");
  return context;
};

export const installTenantQueryGuard = (mongoose) => {
  mongoose.plugin((schema) => {
    if (!schema.path("outlet")) return;
    schema.pre(/^find/, function enforceFindScope(next) {
      const context = assertContext(this);
      if (context?.role !== "super_admin") {
        this.where({ restaurant: context.restaurantId, outlet: context.outletId });
      } else if (context?.outletId) {
        this.where({ outlet: context.outletId });
      }
      next();
    });
    schema.pre(/^update|^delete/, function enforceWriteScope(next) {
      const context = assertContext(this);
      if (context?.role !== "super_admin") {
        this.where({ restaurant: context.restaurantId, outlet: context.outletId });
      } else if (context?.outletId) {
        this.where({ outlet: context.outletId });
      }
      next();
    });
    schema.pre("aggregate", function enforceAggregateScope(next) {
      const context = assertContext(this);
      if (context?.role !== "super_admin" || context?.outletId) {
        const match = context?.role === "super_admin"
          ? { outlet: context.outletId }
          : { restaurant: context.restaurantId, outlet: context.outletId };
        this.pipeline().unshift({ $match: match });
      }
      next();
    });
    schema.pre("save", function enforceSaveScope(next) {
      const context = getTenantContext();
      if (context?.role !== "super_admin") {
        if (!context?.restaurantId || !context?.outletId) return next(new ApiError(403, "Tenant and outlet context is required"));
        if (this.restaurant && String(this.restaurant) !== String(context.restaurantId)) return next(new ApiError(403, "Restaurant scope mismatch"));
        if (this.outlet && String(this.outlet) !== String(context.outletId)) return next(new ApiError(403, "Outlet scope mismatch"));
        this.restaurant = context.restaurantId;
        this.outlet = context.outletId;
      }
      next();
    });
  });
};
