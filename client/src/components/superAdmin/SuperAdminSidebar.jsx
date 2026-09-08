import { FiBarChart2, FiCreditCard, FiFileText, FiGrid, FiHome, FiSettings, FiShoppingBag, FiTag, FiUsers, FiZap } from "react-icons/fi";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logoutThunk } from "../../redux/slices/authSlice";

const links = [
  { to: "/super-admin/dashboard", label: "Dashboard", icon: <FiHome /> },
  { to: "/super-admin/restaurants", label: "Restaurants", icon: <FiGrid /> },
  { to: "/super-admin/users", label: "Users", icon: <FiUsers /> },
  { to: "/super-admin/subscriptions", label: "Subscriptions", icon: <FiTag /> },
  { to: "/super-admin/activity-logs", label: "Activity Logs", icon: <FiZap /> },
  { to: "/super-admin/orders", label: "Orders", icon: <FiShoppingBag /> },
  { to: "/super-admin/payments", label: "Payments", icon: <FiCreditCard /> },
  { to: "/super-admin/reports", label: "Reports", icon: <FiFileText /> },
  { to: "/super-admin/settings", label: "Settings", icon: <FiSettings /> },
];

const SuperAdminSidebar = ({ open, setOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const onLogout = async () => {
    await dispatch(logoutThunk());
    navigate("/", { replace: true });
  };

  return (
    <aside
      id="super-admin-navigation-drawer"
      aria-label="Super administration"
      className={`fixed inset-y-0 left-0 z-50 w-[min(82vw,300px)] transform border-r border-slate-200 bg-slate-950 text-slate-100 transition-transform duration-200 lg:fixed lg:top-0 lg:left-0 lg:h-dvh lg:w-72 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-dvh flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 py-4 md:py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-teal-300 md:text-sm">Super Admin</p>
            <h2 className="text-xl font-bold text-white md:text-2xl">RestoSphere SaaS</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800 lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav aria-label="Super administration" className="flex-1 min-h-0 space-y-1 overflow-y-auto overscroll-contain px-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm min-h-[44px] ${
                  isActive ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800"
                }`
              }
              onClick={() => setOpen(false)}
            >
              <span className="shrink-0 text-lg">{link.icon}</span>
              <span className="min-w-0 truncate">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-800 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-700 px-3 py-3 text-sm text-slate-200 hover:bg-slate-800 min-h-[44px]"
          >
            <FiZap /> Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default SuperAdminSidebar;
