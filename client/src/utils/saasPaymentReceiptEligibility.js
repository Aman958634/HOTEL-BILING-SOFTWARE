/**
 * Receipt download is authorized only by the raw persisted SaaS payment state.
 * Display labels such as SUCCESS are intentionally not accepted as proof.
 */
export const canDownloadSaasPaymentReceipt = (payment) => payment?.statusRaw === "paid";