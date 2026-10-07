import Restaurant from "../models/Restaurant.js";

// The simplified workflow is deliberately opt-in and requires KDS to be off.
// This keeps the established kitchen lifecycle unchanged for every other tenant.
export const isSimplePrintedKotWorkflow = (restaurant) => Boolean(
  restaurant?.simpleOrderWorkflowEnabled === true
  && restaurant?.kitchenDisplayEnabled === false
);

export const getRestaurantWorkflowSettings = async (restaurantId) =>
  Restaurant.findById(restaurantId)
    .select("kitchenDisplayEnabled simpleOrderWorkflowEnabled")
    .lean();
