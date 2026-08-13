import api from "./api";

export const fetchBillingPlans = () => api.get("/admin/billing/plans");
export const fetchMySubscription = () => api.get("/admin/billing/subscription");
export const fetchMyBillingPayments = () => api.get("/admin/billing/payments");
export const downloadMyBillingPaymentPdf = (paymentId) =>
  api.get(`/admin/billing/payments/${paymentId}/pdf`, { responseType: "blob" });
export const selectBillingPlan = (payload) => api.post("/admin/billing/select-plan", payload);
export const createBillingCheckout = (payload) => api.post("/admin/billing/checkout", payload);
export const verifyBillingPayment = (payload) => api.post("/admin/billing/verify", payload);
