const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const currency = (value) => currencyFormatter.format(Number(value || 0));

export const dateTime = (value) => dateTimeFormatter.format(new Date(value));
