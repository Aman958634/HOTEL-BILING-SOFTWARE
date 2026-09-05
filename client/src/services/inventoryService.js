import api from "./api";

export const getInventoryItems = (params = {}, config = {}) => api.get("/inventory/items", { params, ...config });
export const createInventoryItem = (payload) => api.post("/inventory/items", payload);
export const adjustInventoryItem = (id, payload) => api.post(`/inventory/items/${id}/adjust`, payload);
export const getInventoryMovements = (id) => api.get(`/inventory/items/${id}/movements`);
export const getRecipes = () => api.get("/inventory/recipes");
export const createRecipe = (payload) => api.post("/inventory/recipes", payload);
export const getRecipeCost = (id) => api.get(`/inventory/recipes/${id}/cost`);
