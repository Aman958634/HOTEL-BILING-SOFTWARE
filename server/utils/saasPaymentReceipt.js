/** A SaaS receipt is proof of a settled platform subscription payment only. */
export const isSaasPaymentReceiptAvailable = (payment) => payment?.status === "paid";

/**
 * internalReference is generated once by the persisted SaasPayment schema and
 * is unique/immutable. It is therefore the stable server-side receipt number.
 */
export const getSaasReceiptNumber = (payment) => payment?.internalReference || String(payment?._id || payment?.id || "");