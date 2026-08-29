import api from "./api";

const key = () => globalThis.crypto?.randomUUID?.() || `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const getCentralKitchens = () => api.get("/central-kitchens");
export const createCentralKitchen = (payload) => api.post("/central-kitchens", payload);
export const getCentralKitchenInventory = (id) => api.get(`/central-kitchens/${id}/inventory`);
export const createCentralKitchenInventory = (id, payload) => api.post(`/central-kitchens/${id}/inventory`, payload);
export const getRequisitions = (params = {}) => api.get("/central-kitchens/operations/requisitions", { params });
export const createRequisition = (payload) => api.post("/central-kitchens/operations/requisitions", payload);
export const approveRequisition = (id, payload) => api.patch(`/central-kitchens/operations/requisitions/${id}/approve`, payload);
export const rejectRequisition = (id, payload) => api.patch(`/central-kitchens/operations/requisitions/${id}/reject`, payload);
export const getProductionBatches = (params = {}) => api.get("/central-kitchens/operations/batches", { params });
export const createProductionBatch = (payload) => api.post("/central-kitchens/operations/batches", payload);
export const startProductionBatch = (id) => api.patch(`/central-kitchens/operations/batches/${id}/start`);
export const completeProductionBatch = (id, payload) => api.patch(`/central-kitchens/operations/batches/${id}/complete`, payload);
export const getCentralTransfers = (params = {}) => api.get("/central-kitchens/operations/transfers", { params });
export const createCentralTransfer = (payload) => api.post("/central-kitchens/operations/transfers", payload);
export const dispatchCentralTransfer = (id) => api.patch(`/central-kitchens/operations/transfers/${id}/dispatch`, {}, { headers: { "Idempotency-Key": key() } });
export const receiveCentralTransfer = (id, payload) => api.patch(`/central-kitchens/operations/transfers/${id}/receive`, payload, { headers: { "Idempotency-Key": key() } });
