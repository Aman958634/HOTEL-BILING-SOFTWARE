import kotRepository from "../repositories/kotRepository.js";

const contextFromOrder = (order) => ({
  restaurantId: order.restaurant,
  outletId: order.outlet,
  role: "service",
});

const mapItems = (order) => (order.items || []).map((item) => ({
  menuItem: item.menuItem,
  name: item.name,
  quantity: item.quantity,
  specialInstructions: item.specialInstructions || "",
  kitchenStatus: item.kitchenStatus || "NEW",
}));

export const createKotRevision = async ({ order, userId = null, session = null }) => {
  const query = kotRepository.findOneAndUpdate(contextFromOrder(order),
    { restaurant: order.restaurant, order: order._id, revision: Number(order.kotRevision || 0) },
    {
      $setOnInsert: {
        restaurant: order.restaurant,
        outlet: order.outlet,
        order: order._id,
        revision: Number(order.kotRevision || 0),
        items: mapItems(order),
        createdBy: userId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (session) query.session(session);
  return query;
};

// Preserve state per item occurrence; a new duplicate starts as NEW.
export const mergeItemsWithKitchenState = ({ previousItems = [], nextItems = [] }) => {
  const statesByMenuItem = new Map();

  for (const item of previousItems) {
    const key = String(item.menuItem || "");
    const queue = statesByMenuItem.get(key) || [];
    queue.push(item.kitchenStatus || "NEW");
    statesByMenuItem.set(key, queue);
  }

  return nextItems.map((item) => {
    const queue = statesByMenuItem.get(String(item.menuItem || "")) || [];
    return { ...item, kitchenStatus: queue.shift() || item.kitchenStatus || "NEW" };
  });
};

export const cancelKotTickets = async ({ order, session = null }) => {
  const query = kotRepository.updateMany(contextFromOrder(order),
    { restaurant: order.restaurant, order: order._id, status: { $in: ["NEW", "PREPARING", "READY"] } },
    { $set: { status: "CANCELLED", "items.$[].kitchenStatus": "CANCELLED" } }
  );
  if (session) query.session(session);
  return query;
};

export const syncKotKitchenStatus = async ({ order, itemIndex = null, status, session = null }) => {
  const filter = { restaurant: order.restaurant, order: order._id, revision: Number(order.kotRevision || 0) };
  const update = itemIndex == null
    ? { $set: { status, "items.$[].kitchenStatus": status } }
    : { $set: { status, [`items.${Number(itemIndex)}.kitchenStatus`]: status } };
  const query = kotRepository.updateOne(contextFromOrder(order), filter, update);
  if (session) query.session(session);
  return query;
};
