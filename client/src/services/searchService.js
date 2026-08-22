import api from "./api";

export const globalSearch = (query) => api.get("/search", { params: { q: query } });
