import mongoose from "mongoose";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import { createRestaurantWithStableSlug } from "../utils/restaurantSlug.js";

const MAIN_OUTLET_CODE = "MAIN";

const mainOutletPayload = (restaurant) => ({
  restaurant: restaurant._id,
  name: "Main Outlet",
  code: MAIN_OUTLET_CODE,
  address: restaurant.address || "",
  city: restaurant.city || "",
  state: restaurant.state || "",
  phone: restaurant.phone || "",
  email: restaurant.email || "",
  timeZone: restaurant.timeZone || "Asia/Kolkata",
  gstNumber: restaurant.gstNumber || "",
  isActive: true,
  isDefault: true,
});

const isDuplicateKeyError = (error) => error?.code === 11000;

const findOutlet = async (filter, session) => {
  const query = Outlet.findOne(filter);
  if (session) query.session(session);
  return query;
};

/**
 * Creates the one tenant-owned Main Outlet for a new restaurant. The unique
 * indexes are the final concurrency guard; a duplicate-key race reads the
 * winner from this restaurant only.
 */
export const ensureProvisionedMainOutlet = async (restaurant, { session } = {}) => {
  const filter = { restaurant: restaurant._id, code: MAIN_OUTLET_CODE };
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    ...(session ? { session } : {}),
  };

  try {
    return await Outlet.findOneAndUpdate(filter, { $setOnInsert: mainOutletPayload(restaurant) }, options);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const outlet = await findOutlet(filter, session);
    if (outlet) return outlet;
    throw error;
  }
};

export const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  return /Transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(message);
};

/**
 * Required tenant bootstrap records are written in one transaction. There is
 * intentionally no non-transactional fallback: unsupported topologies fail
 * closed rather than leave a partially configured tenant.
 */
export const provisionRestaurantWithAdmin = async ({ restaurantInput, adminInput, subscriptionInput }) => {
  const session = await mongoose.startSession();
  let provisioned;

  try {
    await session.withTransaction(async () => {
      const restaurant = await createRestaurantWithStableSlug(restaurantInput, { session });
      const mainOutlet = await ensureProvisionedMainOutlet(restaurant, { session });
      const [admin] = await User.create(
        [{
          ...adminInput,
          restaurant: restaurant._id,
          defaultOutlet: mainOutlet._id,
          outletAccess: [{ outlet: mainOutlet._id, role: adminInput.role, isActive: true }],
        }],
        { session }
      );
      const [subscription] = await Subscription.create(
        [{ ...subscriptionInput, restaurant: restaurant._id }],
        { session }
      );
      provisioned = { restaurant, mainOutlet, admin, subscription };
    });
    return provisioned;
  } finally {
    await session.endSession();
  }
};

export { MAIN_OUTLET_CODE };