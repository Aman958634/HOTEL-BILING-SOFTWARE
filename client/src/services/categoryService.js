import api from "./api";

export const getAdminCategories = (params = {}) => api.get("/categories", { params });

// Category responses are paginated by the API. Order entry needs the entire
// tenant-scoped category set so a valid category is never omitted from the
// selector just because it falls after the first API page.
const ORDER_CATEGORY_PAGE_SIZE = 100;

export const getAllAdminCategoriesForOrder = async (params = {}) => {
  const firstResponse = await getAdminCategories({ ...params, page: 1, limit: ORDER_CATEGORY_PAGE_SIZE });
  const firstPage = firstResponse.data || {};
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages) || 1);

  if (totalPages === 1) return firstPage.data || [];

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      getAdminCategories({ ...params, page: index + 2, limit: ORDER_CATEGORY_PAGE_SIZE })
    )
  );

  return [
    ...(firstPage.data || []),
    ...remainingPages.flatMap((response) => response.data?.data || []),
  ];
};
export const createAdminCategory = (payload) => api.post("/categories", payload);
export const updateAdminCategory = (id, payload) => api.put(`/categories/${id}`, payload);
export const deleteAdminCategory = (id) => api.delete(`/categories/${id}`);
export const toggleAdminCategoryStatus = (id, active) => api.patch(`/categories/${id}/status`, { active });
