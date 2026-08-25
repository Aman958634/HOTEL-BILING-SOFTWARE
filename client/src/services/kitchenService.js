import api from "./api";

export const getKitchenTickets = (params = {}) => api.get("/kitchen/tickets", { params });

export const updateKitchenItemStatus = (orderId, itemIndex, kitchenStatus) =>
  api.patch(`/kitchen/tickets/${orderId}/items/${itemIndex}`, { kitchenStatus });

export const bulkStartKitchenItems = (orderId) =>
  api.patch(`/kitchen/tickets/${orderId}/start`);

export const bulkReadyKitchenItems = (orderId) =>
  api.patch(`/kitchen/tickets/${orderId}/ready`);

export const getKitchenStations = (params = {}) => api.get("/kitchen/stations", { params });

export const createKitchenStation = (payload) => api.post("/kitchen/stations", payload);

export const updateKitchenStation = (id, payload) => api.put(`/kitchen/stations/${id}`, payload);

export const deleteKitchenStation = (id) => api.delete(`/kitchen/stations/${id}`);
