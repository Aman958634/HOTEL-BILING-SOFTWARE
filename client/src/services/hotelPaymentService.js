import apiClient from "./api";

export const getHotelPaymentSettings = async () => apiClient.get("/hotel-payments/settings");
export const saveHotelPaymentSettings = async (payload) => apiClient.put("/hotel-payments/settings", payload);
export const generateHotelPaymentQr = async (payload) => apiClient.post("/hotel-payments/qr", payload);
export const verifyHotelPayment = async (payload) => apiClient.post("/hotel-payments/verify", payload);
export const rejectHotelPayment = async (payload) => apiClient.post("/hotel-payments/reject", payload);
