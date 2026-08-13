export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CHEF: "chef",
  WAITER: "waiter",
  CASHIER: "cashier",
  DELIVERY: "delivery",
  CUSTOMER: "customer",
};

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002/api/v1";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5002";
