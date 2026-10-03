import api from "./api";

export const getTables = (params = {}, options = {}) =>
  api.get("/tables", { params, ...options });
// The tables endpoint is deliberately paginated. Order creation needs the
// complete, server-scoped set so a selector never silently stops after page 1.
const TABLE_SELECTOR_PAGE_SIZE = 100;

export const getAllTablesForOrder = async () => {
  const firstResponse = await getTables({ page: 1, limit: TABLE_SELECTOR_PAGE_SIZE, sortBy: "tableNumber", order: "asc" });
  const firstPage = firstResponse.data || {};
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages) || 1);

  if (totalPages === 1) return firstPage.data || [];

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      getTables({ page: index + 2, limit: TABLE_SELECTOR_PAGE_SIZE, sortBy: "tableNumber", order: "asc" })
    )
  );

  return [
    ...(firstPage.data || []),
    ...remainingPages.flatMap((response) => response.data?.data || []),
  ];
};
export const getTableById = (id) => api.get(`/tables/${id}`);
export const getTableQr = (id) => api.get(`/tables/${id}/qr`);
export const createTable = (payload) => api.post("/tables", payload);
export const updateTable = (id, payload) => api.put(`/tables/${id}`, payload);
export const deleteTable = (id) => api.delete(`/tables/${id}`);
export const getTableStats = () => api.get("/tables/stats");
export const getAvailableTables = (params = {}) => api.get("/tables/available", { params });
