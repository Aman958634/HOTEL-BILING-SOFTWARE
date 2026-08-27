import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

// POS writes change several collections. A replica set (including a one-node
// replica set) is a production requirement; never fall back to partial writes.
export const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
    return result;
  } catch (error) {
    if (error?.code === 20 || /Transaction numbers are only allowed/i.test(error?.message || "")) {
      throw new ApiError(503, "MongoDB transactions require a replica set. POS write was not applied.");
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
