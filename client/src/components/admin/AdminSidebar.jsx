import { FiBarChart2, FiBell, FiBookOpen, FiClipboard, FiCreditCard, FiGrid, FiHome, FiLayers, FiLogOut, FiSettings, FiShoppingBag, FiTag, FiUsers, FiAward } from "react-icons/fi";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logoutThunk } from "../../redux/slices/authSlice";

const links = [
  { to: "/dashboard/admin", label: "Dashboard", icon: <FiHome /> },
  { to: "/dashboard/admin/menu", label: "Menu Management", icon: <FiBookOpen /> },
  { to: "/dashboard/admin/categories", label: "Categories", icon: <FiLayers /> },
  { to: "/dashboard/admin/tables", label: "Tables", icon: <FiGrid /> },
  { to: "/dashboard/admin/orders", label: "Orders", icon: <FiShoppingBag /> },
  { to: "/dashboard/admin/staff", label: "Staff", icon: <FiUsers /> },
  { to: "/dashboard/admin/payments", label: "Payments", icon: <FiBarChart2 /> },
  { to: "/dashboard/admin/billing", label: "Billing & Plans", icon: <FiCreditCard /> },
  { to: "/dashboard/admin/my-subscription", label: "My Subscription", icon: <FiTag /> },
  { to: "/dashboard/admin/reports", label: "Reports", icon: <FiClipboard /> },
  { to: "/dashboard/admin/notifications", label: "Notifications", icon: <FiBell /> },
  { to: "/dashboard/admin/settings", label: "Settings", icon: <FiSettings /> },
];

const AdminSidebar = ({ open, setOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const onLogout = async () => {
    await dispatch(logoutThunk());
    navigate("/", { replace: true });
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] transform border-r border-slate-700/50 bg-[#0B1120] text-slate-300 transition-transform duration-200 md:fixed md:top-0 md:left-0 md:h-screen md:w-72 md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-dvh h-screen flex-col">
        <div className="flex shrink-0 items-center justify-between px-5 py-5 md:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <FiAward className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-white md:text-xl">RestoSphere</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-2">
          {links.map((link) => (
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
              <span className="text-base">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
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

export default AdminSidebar;
