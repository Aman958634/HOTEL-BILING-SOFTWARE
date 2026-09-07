import { memo, useCallback } from "react";
import { FiBarChart2, FiBell, FiBookOpen, FiBox, FiCoffee, FiCreditCard, FiDollarSign, FiFileText, FiGrid, FiHome, FiLayout, FiLogOut, FiSettings, FiShoppingBag, FiTag, FiTruck, FiUsers, FiWifi, FiX, FiAward, FiMapPin } from "react-icons/fi";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutThunk } from "../../redux/slices/authSlice";

const links = [
  { group: "Overview", to: "/dashboard/admin", label: "Dashboard", icon: <FiHome />, role: ["admin", "manager"] },
  { group: "Operations", to: "/dashboard/admin/cockpit", label: "Service Cockpit", icon: <FiLayout />, role: ["admin", "manager", "cashier"] },
  { group: "Operations", to: "/dashboard/admin/tables", label: "Tables", icon: <FiGrid />, role: ["admin", "manager", "cashier"] },
  { group: "Operations", to: "/dashboard/admin/orders", label: "Orders", icon: <FiShoppingBag />, permission: "orders.view" },
  { group: "Operations", to: "/dashboard/admin/online-orders", label: "Online Orders", icon: <FiTruck />, role: ["admin", "manager"] },
  { group: "Operations", to: "/dashboard/admin/kitchen", label: "Kitchen Display", icon: <FiCoffee />, permission: "kds.view" },
  { group: "Menu & Customers", to: "/dashboard/admin/menu", label: "Menu Management", icon: <FiBookOpen />, role: ["admin"] },
  { group: "Menu & Customers", to: "/dashboard/admin/categories", label: "Categories", icon: <FiTag />, role: ["admin"] },
  { group: "Menu & Customers", to: "/dashboard/admin/customers", label: "Customer CRM", icon: <FiUsers />, role: ["admin", "manager", "cashier"] },
  { group: "Menu & Customers", to: "/dashboard/admin/loyalty", label: "Loyalty & Rewards", icon: <FiAward />, role: ["admin", "manager", "cashier"] },
  { group: "Management", to: "/dashboard/admin/staff", label: "Staff", icon: <FiUsers />, permission: "staff.view" },
  { group: "Management", to: "/dashboard/admin/inventory", label: "Inventory", icon: <FiBox />, permission: "inventory.view" },
  { group: "Management", to: "/dashboard/admin/procurement", label: "Procurement", icon: <FiTruck />, role: ["admin"] },
  { group: "Management", to: "/dashboard/admin/central-kitchen", label: "Central Kitchen", icon: <FiCoffee />, role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/payments", label: "Payments", icon: <FiCreditCard />, permission: "payments.view" },
  { group: "Finance & Insights", to: "/dashboard/admin/billing", label: "Billing & Plans", icon: <FiFileText />, role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/my-subscription", label: "My Subscription", icon: <FiDollarSign />, role: ["admin"] },
  { group: "Finance & Insights", to: "/dashboard/admin/reports", label: "Reports", icon: <FiBarChart2 />, permission: "reports.view_basic" },
  { group: "Finance & Insights", to: "/dashboard/admin/business-intelligence", label: "Business Intelligence", icon: <FiBarChart2 />, permission: "reports.view_full" },
  { group: "Finance & Insights", to: "/dashboard/admin/intelligence", label: "RestoSphere Intelligence", icon: <FiAward />, permission: "reports.view_full" },
  { group: "Administration", to: "/dashboard/admin/notifications", label: "Notifications", icon: <FiBell />, role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/outlets", label: "Outlets", icon: <FiMapPin />, role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/settings", label: "Settings", icon: <FiSettings />, role: ["admin"] },
  { group: "Administration", to: "/dashboard/admin/integrations", label: "Integrations", icon: <FiWifi />, role: ["admin"] },
];

const linkGroups = Object.entries(
  links.reduce((groups, link) => ({ ...groups, [link.group]: [...(groups[link.group] || []), link] }), {})
);

const AdminSidebar = ({ open, setOpen, desktopOpen = true }) => {
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
      className={`fixed inset-y-0 left-0 z-50 w-[min(82vw,300px)] transform border-r border-slate-700/50 bg-[#0B1120] text-slate-300 transition-transform duration-200 lg:fixed lg:top-0 lg:left-0 lg:h-dvh lg:w-72 ${desktopOpen ? "lg:translate-x-0" : "lg:-translate-x-full"} ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-dvh flex-col">
        <div className="flex shrink-0 items-center justify-between px-5 py-5 md:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <FiAward className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-white md:text-xl">RestoSphere</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 lg:hidden"
            aria-label="Close menu"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Restaurant administration" className="flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain px-3 py-2">
          {visibleGroups.map(([group, groupLinks]) => (
            <div key={group}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group}</p>
              <div className="space-y-1">
              {groupLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`
              }
              onClick={() => setOpen(false)}
            >
              <span className="shrink-0 text-base">{link.icon}</span>
              <span className="min-w-0 truncate">{link.label}</span>
            </NavLink>
              ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-700/50 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-700/60 px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 min-h-[44px]"
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
