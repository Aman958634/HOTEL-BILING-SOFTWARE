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
      className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-slate-200 bg-slate-950 text-slate-100 transition-transform md:fixed md:top-0 md:left-0 md:h-screen md:overflow-y-auto md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Super Admin</p>
            <h2 className="text-2xl font-bold text-white">RestoSphere SaaS</h2>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-700 p-2 text-xs md:hidden" aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
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

        <div className="border-t border-slate-800 px-4 py-4">
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
