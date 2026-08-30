import ApiError from "./ApiError.js";

/**
 * Browser clients may record a cash tender, but provider-backed settlement is
 * accepted only from the provider-verification flow.
 */
export const assertDirectCashSettlement = (paymentMethod) => {
  if (String(paymentMethod || "").toUpperCase() !== "CASH") {
    throw new ApiError(422, "Digital payments must be verified by the payment provider.");
  }
};
