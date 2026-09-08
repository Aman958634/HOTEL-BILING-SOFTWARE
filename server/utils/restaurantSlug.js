import Restaurant from "../models/Restaurant.js";

export const RESTAURANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugifyRestaurantName = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 110)
  .replace(/-+$/g, "");

export const isValidRestaurantSlug = (value) => {
  const slug = String(value || "").trim();
  return slug.length > 0 && slug.length <= 120 && RESTAURANT_SLUG_PATTERN.test(slug);
};

export const allocateRestaurantSlug = async (name, { excludeId = null } = {}) => {
  const base = slugifyRestaurantName(name);
  if (!base) throw new Error("Restaurant name cannot produce a public menu slug");

  for (let sequence = 1; sequence <= 10_000; sequence += 1) {
    const slug = sequence === 1 ? base : `${base}-${sequence}`;
    const filter = { slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
    if (!(await Restaurant.exists(filter))) return slug;
  }

  throw new Error("Unable to allocate a unique public menu slug");
};

export const createRestaurantWithStableSlug = async (payload) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = await allocateRestaurantSlug(payload.name);
    try {
      return await Restaurant.create({ ...payload, slug });
    } catch (error) {
      const duplicateSlug = error?.code === 11000 && (error?.keyPattern?.slug || String(error?.message || "").includes("slug"));
      if (!duplicateSlug || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to create restaurant with a public menu slug");
};
