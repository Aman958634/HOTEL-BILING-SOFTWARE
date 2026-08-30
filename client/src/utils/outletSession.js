const OUTLET_STORAGE_KEYS = ["selectedOutletId", "activeOutletId", "activeOutlet", "currentOutletId"];

export const clearOutletSession = () => {
  OUTLET_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

// `activeOutletId` was the legacy key. Read it once so existing browsers can
// recover safely, then persist only the validated canonical key below.
export const readSavedOutletId = () =>
  localStorage.getItem("selectedOutletId") ||
  localStorage.getItem("activeOutletId") ||
  localStorage.getItem("activeOutlet") ||
  localStorage.getItem("currentOutletId") ||
  "";

export const resolveAuthorizedOutlet = (outlets = [], defaultOutlet = null) => {
  const rows = Array.isArray(outlets) ? outlets : [];
  const savedId = readSavedOutletId();
  const saved = rows.find((outlet) => String(outlet?._id) === String(savedId));
  const preferred = rows.find((outlet) => String(outlet?._id) === String(defaultOutlet));
  return saved || preferred || rows.find((outlet) => outlet?.isDefault) || rows[0] || null;
};

export const persistAuthorizedOutlet = (outlets = [], defaultOutlet = null) => {
  const selected = resolveAuthorizedOutlet(outlets, defaultOutlet);
  clearOutletSession();
  if (selected?._id) localStorage.setItem("selectedOutletId", String(selected._id));
  return selected?._id ? String(selected._id) : "";
};

export { OUTLET_STORAGE_KEYS };
