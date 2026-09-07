export const roleLandingPath = (role) => {
  const destinations = {
    super_admin: "/super-admin/dashboard",
    admin: "/dashboard/admin",
    manager: "/dashboard/admin",
    chef: "/dashboard/admin/kitchen",
    kitchen_manager: "/dashboard/admin/kitchen",
    cashier: "/dashboard/admin/orders",
    waiter: "/dashboard/service",
    delivery: "/dashboard/delivery",
    customer: "/dashboard/customer",
  };

  return destinations[String(role || "").toLowerCase()] || "/";
};

export const isRestaurantStaff = (user) => {
  const staffRoles = new Set(["manager", "chef", "kitchen_manager", "cashier", "waiter", "delivery", "receptionist", "inventory_manager", "staff"]);
  return Boolean(user?.restaurant) && staffRoles.has(String(user?.role || "").toLowerCase());
};

