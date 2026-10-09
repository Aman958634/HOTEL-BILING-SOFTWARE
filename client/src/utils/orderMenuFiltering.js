export const filterOrderMenuItems = (menuItems = [], search = "", categoryId = "") => {
  const query = String(search).trim().toLowerCase();

  return menuItems.filter((item) => {
    const itemCategoryId = item.category?._id || item.category;
    const available = item.isAvailable ?? item.available ?? true;
    return available
      && (!query || String(item.name || "").trim().toLowerCase().startsWith(query))
      && (!categoryId || String(itemCategoryId) === String(categoryId));
  });
};
