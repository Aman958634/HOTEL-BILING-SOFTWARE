import { requirePermission } from "./auth.js";

export const requirePaymentViewAccess = requirePermission("payments.view");
export const requirePaymentAdminAccess = requirePermission("payments.collect");
