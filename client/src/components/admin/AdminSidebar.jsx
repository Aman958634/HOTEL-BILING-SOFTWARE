import { FiBarChart2, FiBell, FiBookOpen, FiClipboard, FiCreditCard, FiGrid, FiHome, FiLayers, FiLogOut, FiSettings, FiShoppingBag, FiTag, FiUsers } from "react-icons/fi";
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
      className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-slate-200 bg-slate-950 text-slate-100 transition-transform md:fixed md:top-0 md:left-0 md:h-screen md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-5">
          <h2 className="text-2xl font-bold text-teal-300">RestoSphere</h2>
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
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm min-h-[44px] ${isActive ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800"}`
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
            <FiLogOut /> Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
