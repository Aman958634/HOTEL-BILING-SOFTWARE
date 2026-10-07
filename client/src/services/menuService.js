import api from "./api";

export const getPublicMenu = ({ qrToken, restaurant } = {}, params = {}) => {
  if (qrToken) return api.get(`/public/menu/qr/${encodeURIComponent(qrToken)}`, { params });
  return api.get(`/public/menu/${encodeURIComponent(restaurant)}`, { params });
};

export const getAdminMenu = (params = {}) => api.get("/menu", { params });

// The admin menu endpoint is deliberately paginated. Menu Management needs a
// complete, server-filtered result so a category cannot appear empty merely
// because its items live beyond the first page.
const MENU_MANAGEMENT_PAGE_SIZE = 100;

export const getAllAdminMenu = async (params = {}) => {
  const firstResponse = await getAdminMenu({ ...params, page: 1, limit: MENU_MANAGEMENT_PAGE_SIZE });
  const firstPage = firstResponse.data || {};
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages) || 1);

  if (totalPages === 1) return firstPage.data || [];

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      getAdminMenu({ ...params, page: index + 2, limit: MENU_MANAGEMENT_PAGE_SIZE })
    )
  );

  return [
    ...(firstPage.data || []),
    ...remainingPages.flatMap((response) => response.data?.data || []),
  ];
};

export const getAdminMenuItem = (id) => api.get(`/menu/${id}`);
export const createAdminMenuItem = (payload) => api.post("/menu", payload);
export const updateAdminMenuItem = (id, payload) => api.put(`/menu/${id}`, payload);
export const deleteAdminMenuItem = (id) => api.delete(`/menu/${id}`);
export const toggleAdminMenuAvailability = (id, available) =>
	api.patch(`/menu/${id}/availability`, { available });
