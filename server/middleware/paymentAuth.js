import { authorize } from "./auth.js";

export const requirePaymentViewAccess = authorize("admin", "manager", "cashier");
export const requirePaymentAdminAccess = authorize("admin");
