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
      className={`fixed inset-y-0 left-0 z-30 w-[min(300px,88vw)] transform border-r border-slate-200 bg-slate-950 text-slate-100 transition-transform duration-200 md:fixed md:top-0 md:left-0 md:h-screen md:w-72 md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-dvh h-screen flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 py-4 md:py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-teal-300 md:text-sm">Super Admin</p>
            <h2 className="text-xl font-bold text-white md:text-2xl">RestoSphere SaaS</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm min-h-[44px] ${
                  isActive ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800"
                }`
              }
              onClick={() => setOpen(false)}
            >
              <span className="text-lg">{link.icon}</span>
              <span>{link.label}</span>
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
