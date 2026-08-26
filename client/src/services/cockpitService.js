import api from "./api";

export const getCockpitOverview = (params = {}, options = {}) =>
  api.get("/cockpit", { params, ...options });
