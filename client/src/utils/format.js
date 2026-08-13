export const currency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);

export const dateTime = (value) => new Date(value).toLocaleString();
