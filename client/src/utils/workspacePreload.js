const adminModuleLoaders = [
  () => import("../pages/admin/MenuManagement"),
  () => import("../pages/admin/CategoryManagement"),
  () => import("../pages/admin/TableManagement"),
  () => import("../pages/admin/ServiceCockpit"),
  () => import("../pages/admin/OrderManagement"),
  () => import("../pages/admin/OnlineOrdersHub"),
  () => import("../pages/admin/CustomerCRM"),
  () => import("../pages/admin/LoyaltyManagement"),
  () => import("../pages/admin/StaffManagement"),
  () => import("../pages/admin/InventoryPage"),
  () => import("../pages/admin/ProcurementPage"),
  () => import("../pages/admin/CentralKitchen"),
  () => import("../pages/admin/Payments"),
  () => import("../pages/admin/BillingPage"),
  () => import("../pages/admin/MySubscriptionPage"),
  () => import("../pages/admin/Reports"),
  () => import("../pages/admin/BusinessIntelligence"),
  () => import("../pages/admin/RestoSphereIntelligence"),
  () => import("../pages/admin/Notifications"),
  () => import("../pages/admin/Settings"),
  () => import("../pages/admin/IntegrationsPage"),
  () => import("../pages/admin/Outlets"),
  () => import("../pages/admin/KitchenDisplay"),
];

const superAdminModuleLoaders = [
  () => import("../pages/admin/SuperAdminModuleLayout"),
  () => import("../pages/admin/SuperAdminDashboard"),
  () => import("../pages/admin/RestaurantsPage"),
  () => import("../pages/admin/AddRestaurantPage"),
  () => import("../pages/admin/RestaurantDetailsPage"),
  () => import("../pages/admin/UsersPage"),
  () => import("../pages/admin/AddUserPage"),
  () => import("../pages/admin/UserDetailsPage"),
  () => import("../pages/admin/SubscriptionsPage"),
  () => import("../pages/admin/ActivityLogsPage"),
  () => import("../pages/admin/SuperAdminPaymentsPage"),
  () => import("../pages/admin/AdminPlaceholderPage"),
];

const loadInBatches = async (loaders, batchSize = 4) => {
  for (let index = 0; index < loaders.length; index += batchSize) {
    await Promise.allSettled(loaders.slice(index, index + batchSize).map((load) => load()));
  }
};

const scheduleWhenIdle = (work) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(work, { timeout: 1200 });
    return;
  }
  window.setTimeout(work, 250);
};

let adminWorkspacePrefetch;
let superAdminWorkspacePrefetch;

const warmAdminWorkspace = () => {
  if (!adminWorkspacePrefetch) {
    adminWorkspacePrefetch = import("../pages/admin/AdminDashboard")
      .catch(() => null)
      .then(() => new Promise((resolve) => {
        scheduleWhenIdle(() => {
          loadInBatches(adminModuleLoaders).finally(resolve);
        });
      }));
  }
  return adminWorkspacePrefetch;
};

const warmSuperAdminWorkspace = () => {
  if (!superAdminWorkspacePrefetch) {
    superAdminWorkspacePrefetch = new Promise((resolve) => {
      scheduleWhenIdle(() => {
        loadInBatches(superAdminModuleLoaders).finally(resolve);
      });
    });
  }
  return superAdminWorkspacePrefetch;
};

export const prefetchWorkspaceForRole = (role) => {
  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "super_admin") return warmSuperAdminWorkspace();
  if (["admin", "manager", "kitchen_manager", "chef", "cashier"].includes(normalizedRole)) return warmAdminWorkspace();
  if (["waiter", "delivery"].includes(normalizedRole)) return import("../pages/service/MobileServiceMode").catch(() => null);
  return Promise.resolve();
};
