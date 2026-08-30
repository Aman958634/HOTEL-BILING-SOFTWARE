import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Restaurant from "../models/Restaurant.js";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

const sameId = (left, right) => String(left || "") === String(right || "");
const MIGRATION_MARKER = "tenantCategoryMigrationStarted";

const ensureIndexes = async () => {
  try {
    await Category.collection.dropIndex("slug_1");
    console.log("Dropped legacy global category slug index.");
  } catch (error) {
    if (error.codeName !== "IndexNotFound" && error.code !== 27) throw error;
  }
  await Category.collection.createIndex({ restaurant: 1, slug: 1 }, { unique: true, name: "restaurant_1_slug_1" });
  await Category.collection.createIndex({ restaurant: 1, isActive: 1, name: 1 }, { name: "restaurant_1_isActive_1_name_1" });
};

const copyForRestaurant = async ({ category, restaurant, counts }) => {
  const ownership = { restaurant: restaurant._id, hotelId: restaurant.hotelId || null };
  if (sameId(category.restaurant, restaurant._id)) {
    await Category.updateOne({ _id: category._id }, { $set: ownership });
    return category._id;
  }

  const existing = await Category.findOne({ restaurant: restaurant._id, slug: category.slug }).select("_id").lean();
  if (existing) return existing._id;

  const created = await Category.create({
    name: category.name,
    slug: category.slug,
    description: category.description || "",
    image: category.image || "",
    active: category.active !== false,
    isActive: category.isActive !== false,
    ...ownership,
  });
  await Category.updateOne({ _id: created._id }, { $set: { createdAt: category.createdAt, updatedAt: category.updatedAt } });
  counts.cloned += 1;
  return created._id;
};

await mongoose.connect(uri);
const counts = { scanned: 0, scoped: 0, cloned: 0, foodsRepointed: 0, removedLegacy: 0, unresolved: 0 };
const unresolved = [];

try {
  await ensureIndexes();
  const categories = await Category.find().lean();
  for (const category of categories) {
    counts.scanned += 1;
    const foods = await Food.find({ category: category._id }).select("_id restaurant").lean();
    const restaurantIds = [...new Set(foods.map((food) => String(food.restaurant || "")).filter(Boolean))];

    if (!restaurantIds.length) {
      if (!category.restaurant) {
        const marker = await Category.collection.findOne({ _id: category._id }, { projection: { [MIGRATION_MARKER]: 1 } });
        if (marker?.[MIGRATION_MARKER]) {
          await Category.deleteOne({ _id: category._id });
          counts.removedLegacy += 1;
        } else {
          counts.unresolved += 1;
          unresolved.push({ categoryId: String(category._id), reason: "no linked foods; ownership cannot be inferred" });
        }
      }
      continue;
    }

    // A durable marker lets a rerun safely finish cleanup if interrupted after
    // foods were repointed but before the old global source was removed.
    await Category.collection.updateOne({ _id: category._id }, { $set: { [MIGRATION_MARKER]: new Date() } });

    for (const restaurantId of restaurantIds) {
      const restaurant = await Restaurant.findById(restaurantId).select("_id hotelId").lean();
      if (!restaurant) {
        counts.unresolved += 1;
        unresolved.push({ categoryId: String(category._id), restaurantId, reason: "linked restaurant does not exist" });
        continue;
      }
      const targetId = await copyForRestaurant({ category, restaurant, counts });
      const result = await Food.updateMany({ category: category._id, restaurant: restaurant._id }, { $set: { category: targetId } });
      counts.foodsRepointed += result.modifiedCount;
    }

    const remaining = await Food.countDocuments({ category: category._id });
    if (!remaining && !category.restaurant) {
      await Category.deleteOne({ _id: category._id });
      counts.removedLegacy += 1;
    } else if (category.restaurant) {
      await Category.collection.updateOne({ _id: category._id }, { $unset: { [MIGRATION_MARKER]: "" } });
      counts.scoped += 1;
    }
  }
  await ensureIndexes();
  console.log(JSON.stringify({ migration: "tenant-categories", counts, unresolved }, null, 2));
  if (unresolved.length) process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
