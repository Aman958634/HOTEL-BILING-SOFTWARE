import ApiError from "../utils/ApiError.js";

export const EXTERNAL_PROVIDERS = Object.freeze([]);

export const EXTERNAL_ORDER_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

export const getExternalOrderIntegrationStatus = () => ({
  status: "Provider access required",
  providers: EXTERNAL_PROVIDERS,
  webhook: "Not implemented - provider specification required",
  menuMapping: "Not available",
  availabilitySync: "Not available",
});

export const getExternalOrderAdapter = (provider) => {
  const normalized = String(provider || "").trim().toLowerCase();
  throw new ApiError(503, normalized
    ? `External order provider '${normalized}' is not configured`
    : "External order provider is not configured");
};

export const normalizeExternalOrder = () => {
  throw new ApiError(501, "External order normalization requires a provider adapter and specification");
};

export const normalizeExternalOrderStatus = () => {
  throw new ApiError(501, "External order status mapping requires a provider adapter and specification");
};
