import { memo, useCallback } from "react";
import { FiBarChart2, FiBell, FiBookOpen, FiBox, FiCoffee, FiCreditCard, FiDollarSign, FiFileText, FiGrid, FiHome, FiLayout, FiLogOut, FiSettings, FiShoppingBag, FiTag, FiTruck, FiUsers, FiWifi, FiX, FiAward, FiMapPin } from "react-icons/fi";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutThunk } from "../../redux/slices/authSlice";
import ModuleIcon from "../common/ModuleIcon";

const links = [
  { group: "Overview", to: "/dashboard/admin", label: "Dashboard", icon: <FiHome />, tone: "dashboard", role: ["admin", "manager"] },
  { group: "Operations", to: "/dashboard/admin/cockpit", label: "Service Cockpit", icon: <FiLayout />, tone: "serviceCockpit", role: ["admin", "manager", "cashier"] },
  { group: "Operations", to: "/dashboard/admin/tables", label: "Tables", icon: <FiGrid />, tone: "tables", role: ["admin", "manager", "cashier"] },
  { group: "Operations", to: "/dashboard/admin/orders", label: "Orders", icon: <FiShoppingBag />, tone: "orders", permission: "orders.view" },
  { group: "Operations", to: "/dashboard/admin/online-orders", label: "Online Orders", icon: <FiTruck />, tone: "onlineOrders", role: ["admin", "manager"] },
  { group: "Operations", to: "/dashboard/admin/kitchen", label: "Kitchen Display", icon: <FiCoffee />, tone: "kitchen", permission: "kds.view" },
  { group: "Menu & Customers", to: "/dashboard/admin/menu", label: "Menu Management", icon: <FiBookOpen />, tone: "menu", role: ["admin"] },
  { group: "Menu & Customers", to: "/dashboard/admin/categories", label: "Categories", icon: <FiTag />, tone: "menu", role: ["admin"] },
  { group: "Menu & Customers", to: "/dashboard/admin/customers", label: "Customer CRM", icon: <FiUsers />, tone: "customers", role: ["admin", "manager", "cashier"] },
  { group: "Menu & Customers", to: "/dashboard/admin/loyalty", label: "Loyalty & Rewards", icon: <FiAward />, tone: "customers", role: ["admin", "manager", "cashier"] },
  { group: "Management", to: "/dashboard/admin/staff", label: "Staff", icon: <FiUsers />, tone: "staff", permission: "staff.view" },
  { group: "Management", to: "/dashboard/admin/inventory", label: "Inventory", icon: <FiBox />, tone: "inventory", permission: "inventory.view" },
  { group: "Management", to: "/dashboard/admin/procurement", label: "Procurement", icon: <FiTruck />, tone: "procurement", role: ["admin"] },
  { group: "Management", to: "/dashboard/admin/central-kitchen", label: "Central Kitchen", icon: <FiCoffee />, tone: "kitchen", role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/payments", label: "Payments", icon: <FiCreditCard />, tone: "payments", permission: "payments.view" },
  { group: "Finance & Insights", to: "/dashboard/admin/billing", label: "Billing & Plans", icon: <FiFileText />, tone: "payments", role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/my-subscription", label: "My Subscription", icon: <FiDollarSign />, tone: "payments", role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/reports", label: "Reports", icon: <FiBarChart2 />, tone: "reports", permission: "reports.view_basic" },
  { group: "Finance & Insights", to: "/dashboard/admin/business-intelligence", label: "Business Intelligence", icon: <FiBarChart2 />, tone: "reports", permission: "reports.view_full" },
  { group: "Finance & Insights", to: "/dashboard/admin/intelligence", label: "RestoSphere Intelligence", icon: <FiAward />, tone: "reports", permission: "reports.view_full" },
  { group: "Administration", to: "/dashboard/admin/notifications", label: "Notifications", icon: <FiBell />, tone: "notifications", role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/outlets", label: "Outlets", icon: <FiMapPin />, tone: "dashboard", role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/settings", label: "Settings", icon: <FiSettings />, tone: "settings", role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/integrations", label: "Integrations", icon: <FiWifi />, tone: "settings", role: ["admin"] },
];

const linkGroups = Object.entries(
  links.reduce((groups, link) => ({ ...groups, [link.group]: [...(groups[link.group] || []), link] }), {})
);

const AdminSidebar = ({ open, setOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const allowed = (link) => user?.role === "admin" || (!link.role || link.role.includes(user?.role)) && (!link.permission || user?.permissions?.includes(link.permission));

  const visibleGroups = linkGroups.map(([group, groupLinks]) => [group, groupLinks.filter(allowed)]).filter(([, groupLinks]) => groupLinks.length);

  const onLogout = useCallback(async () => {
    await dispatch(logoutThunk());
    navigate("/", { replace: true });
  }, [dispatch, navigate]);

  return (
    <aside
      id="admin-navigation-drawer"
      aria-label="Restaurant administration"
      className={`admin-sidebar fixed inset-y-0 left-0 z-50 h-dvh w-[min(82vw,300px)] transform overflow-hidden border-r transition-transform duration-200 lg:fixed lg:top-0 lg:left-0 lg:w-72 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between px-5 py-5 md:py-6">
          <div className="flex items-center gap-3">
            <div className="admin-sidebar__logo flex h-9 w-9 items-center justify-center rounded-xl">
              <FiAward className="h-5 w-5" />
            </div>
            <span className="admin-sidebar__brand-name text-lg font-bold md:text-xl">Resto<span>Sphere</span></span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="admin-sidebar__close flex h-11 w-11 items-center justify-center rounded-lg border text-sm lg:hidden"
            aria-label="Close menu"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Restaurant administration" tabIndex={0} className="sidebar-scroll-region flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain px-3 py-2">
          {visibleGroups.map(([group, groupLinks]) => (
            <div key={group}>
              <p className="admin-sidebar__section px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{group}</p>
              <div className="space-y-1">
              {groupLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `module-sidebar-link admin-sidebar__link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                  isActive
                    ? "is-active"
                    : ""
                }`
              }
              onClick={() => setOpen(false)}
            >
              <ModuleIcon icon={link.icon} tone={link.tone} variant="sidebar" />
              <span className="min-w-0 truncate">{link.label}</span>
            </NavLink>
              ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer shrink-0 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="admin-sidebar__logout flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium min-h-[44px]"
          >
            <FiLogOut className="text-base" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default memo(AdminSidebar);
