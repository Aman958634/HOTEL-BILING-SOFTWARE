import { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBookOpen,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiHome,
  FiLayers,
  FiShoppingBag,
  FiTag,
  FiUsers,
  FiX,
} from "react-icons/fi";

const navItems = [
  { to: "/dashboard/admin", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/admin/tables", label: "Tables", icon: FiGrid, end: false },
  { to: "/dashboard/admin/orders", label: "Orders", icon: FiShoppingBag, end: false },
  { to: "/dashboard/admin/payments", label: "Payments", icon: FiBarChart2, end: false },
  { to: "/dashboard/admin/menu", label: "Menu", icon: FiBookOpen, end: false },
  { to: "/dashboard/admin/categories", label: "Categories", icon: FiLayers, end: false },
  { to: "/dashboard/admin/staff", label: "Staff", icon: FiUsers, end: false },
  { to: "/dashboard/admin/reports", label: "Reports", icon: FiClipboard, end: false },
  { to: "/dashboard/admin/notifications", label: "Notifications", icon: FiTag, end: false },
  { to: "/dashboard/admin/billing", label: "Billing", icon: FiCreditCard, end: false },
  { to: "/dashboard/admin/settings", label: "Settings", icon: FiTag, end: false },
];

const MobileMoreDrawer = ({ open, onClose }) => {
  const navigate = useNavigate();
  const drawerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const handleNavigate = (to) => {
    navigate(to);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:hidden">
      <div
        ref={drawerRef}
        className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl"
        style={{ maxHeight: "75vh" }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h2 className="text-lg font-bold text-slate-900">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(75vh - 64px)" }}>
          <div className="grid grid-cols-2 gap-3">
            {navItems.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => handleNavigate(item.to)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <item.icon className="h-5 w-5 text-brand-700" />
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMoreDrawer;
