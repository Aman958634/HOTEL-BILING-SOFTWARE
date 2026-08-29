import api from "./api";

const CUSTOMER_SEGMENTS = new Set(["new", "returning", "recent", "inactive"]);

/** Keeps optional CRM filters out of the URL unless they carry a valid value. */
export const buildCustomerListParams = ({ page, limit, search, segment, tag } = {}) => {
  const safePage = Number(page);
  const safeLimit = Number(limit);
  const params = {
    page: Number.isInteger(safePage) && safePage >= 1 ? safePage : 1,
    limit: Number.isInteger(safeLimit) && safeLimit >= 1 && safeLimit <= 100 ? safeLimit : 20,
  };
  const trimmedSearch = String(search || "").trim();
  const trimmedTag = String(tag || "").trim();
  if (trimmedSearch) params.search = trimmedSearch;
  if (trimmedTag) params.tag = trimmedTag;
  if (CUSTOMER_SEGMENTS.has(segment)) params.segment = segment;
  return params;
};

export const getCustomers = (filters = {}) => api.get("/customers", { params: buildCustomerListParams(filters) });
export const getCustomerProfile = (id) => api.get(`/customers/${id}`);
export const createCustomer = (payload) => api.post("/customers", payload);
export const updateCustomer = (id, payload) => api.put(`/customers/${id}`, payload);
export const archiveCustomer = (id) => api.patch(`/customers/${id}/archive`);
