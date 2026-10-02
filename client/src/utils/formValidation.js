const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{7,20}$/;
const text = (value) => String(value ?? "").trim();
const isFiniteNumber = (value) => value !== "" && Number.isFinite(Number(value));

export const isHttpUrl = (value) => {
  try {
    const url = new URL(text(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
};

export const validateCategoryForm = (form) => {
  const errors = {};
  if (!text(form.name)) errors.name = "Category name is required.";
  else if (text(form.name).length > 120) errors.name = "Category name must be 120 characters or fewer.";
  if (text(form.description).length > 500) errors.description = "Description must be 500 characters or fewer.";
  if (text(form.image) && !isHttpUrl(form.image)) errors.image = "Enter a valid image URL.";
  return errors;
};

export const validateCustomerForm = (form) => {
  const errors = {};
  if (!text(form.fullName)) errors.fullName = "Customer name is required.";
  if (text(form.email) && !emailPattern.test(text(form.email))) errors.email = "Enter a valid email address.";
  if (text(form.phone) && !phonePattern.test(text(form.phone))) errors.phone = "Enter a valid phone number.";
  if (!text(form.phone) && !text(form.email)) errors.contact = "Add a valid phone number or email address.";
  if (text(form.address).length > 500) errors.address = "Address must be 500 characters or fewer.";
  if (text(form.note).length > 1000) errors.note = "Internal note must be 1000 characters or fewer.";
  const tags = Array.isArray(form.tags) ? form.tags : String(form.tags ?? "").split(",").filter((tag) => text(tag));
  if (tags.length > 20) errors.tags = "Use no more than 20 tags.";
  return errors;
};

export const validateMenuForm = (form) => {
  const errors = {};
  if (!text(form.name)) errors.name = "Food name is required.";
  if (!text(form.category)) errors.category = "Category is required.";
  if (!isFiniteNumber(form.price)) errors.price = "Enter a valid price.";
  else if (Number(form.price) <= 0) errors.price = "Price must be greater than 0.";
  if (text(form.discountPrice) && (!isFiniteNumber(form.discountPrice) || Number(form.discountPrice) < 0)) errors.discountPrice = "Discount price must be 0 or greater.";
  if (text(form.image) && !isHttpUrl(form.image)) errors.image = "Enter a valid image URL.";
  if (text(form.description) && (text(form.description).length < 10 || text(form.description).length > 1200)) errors.description = "Description must be between 10 and 1200 characters.";
  if (text(form.preparationTime) && (!Number.isInteger(Number(form.preparationTime)) || Number(form.preparationTime) < 1)) errors.preparationTime = "Preparation time must be at least 1 minute.";
  return errors;
};

export const validateRestaurantSettings = (form) => {
  const errors = {};
  if (!text(form.name)) errors.name = "Restaurant name is required.";
  if (!text(form.branchCode)) errors.branchCode = "Branch code is required.";
  if (!text(form.address)) errors.address = "Address is required.";
  if (text(form.email) && !emailPattern.test(text(form.email))) errors.email = "Enter a valid email address.";
  if (text(form.phone) && !phonePattern.test(text(form.phone))) errors.phone = "Enter a valid phone number.";
  if (text(form.logoUrl) && !isHttpUrl(form.logoUrl)) errors.logoUrl = "Enter a valid URL.";
  if (text(form.website) && !isHttpUrl(form.website)) errors.website = "Enter a valid URL.";
  if (!isFiniteNumber(form.gstRate) || Number(form.gstRate) < 0 || Number(form.gstRate) > 100) errors.gstRate = "GST rate must be between 0 and 100.";
  if (text(form.openingHours) && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(text(form.openingHours))) errors.openingHours = "Use the format HH:MM-HH:MM.";
  return errors;
};
