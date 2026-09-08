import dotenv from "dotenv";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import { allocateRestaurantSlug, isValidRestaurantSlug } from "../utils/restaurantSlug.js";

dotenv.config();

const apply = process.argv.includes("--apply");
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);

try {
  const counts = { scanned: 0, valid: 0, backfilled: 0, skipped: 0 };
  const skipped = [];
  const restaurants = await Restaurant.find().sort({ createdAt: 1, _id: 1 }).select("_id name slug").lean();

  for (const restaurant of restaurants) {
    counts.scanned += 1;
    if (isValidRestaurantSlug(restaurant.slug)) {
      counts.valid += 1;
      continue;
    }

    if (!String(restaurant.name || "").trim()) {
      counts.skipped += 1;
      skipped.push({ restaurantId: String(restaurant._id), reason: "missing restaurant name" });
      continue;
    }

    const slug = await allocateRestaurantSlug(restaurant.name, { excludeId: restaurant._id });
    if (apply) {
      await Restaurant.updateOne({ _id: restaurant._id, slug: restaurant.slug }, { $set: { slug } });
    }
    counts.backfilled += 1;
  }

  console.log(JSON.stringify({ migration: "restaurant-public-slugs", mode: apply ? "apply" : "dry-run", counts, skipped }, null, 2));
  if (skipped.length) process.exitCode = 2;
  if (!apply && counts.backfilled) process.exitCode = 3;
} finally {
  await mongoose.disconnect();
}
