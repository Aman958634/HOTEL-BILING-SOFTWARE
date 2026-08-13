import Log from "../models/Log.js";

export const createActivity = async ({ action, description, performedBy = null, restaurantId = null, targetId = null, targetType = null, metadata = {} }) => {
  try {
    await Log.create({
      level: "activity",
      message: action,
      context: {
        description,
        performedBy,
        restaurantId,
        targetId,
        targetType,
        metadata,
      },
    });
  } catch (_err) {
    // do not block main flow on audit failures
    // intentionally silent
  }
};

export default { createActivity };
