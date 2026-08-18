import { NavLink } from 'react-router-dom';
import { FiHome, FiGrid, FiShoppingBag, FiMoreHorizontal } from 'react-icons/fi';

const navItems = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: FiHome,
    end: true,
  },
  {
    label: 'Tables',
    to: '/dashboard/tables',
    icon: FiGrid,
    end: false,
  },
  {
    label: 'Orders',
    to: '/dashboard/orders',
    icon: FiShoppingBag,
    end: false,
  },
  {
    label: 'More',
    to: '/dashboard/admin/notifications',
    icon: FiMoreHorizontal,
    end: false,
  },
];

export default function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {navItems.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-2 relative group min-h-[44px] ${
                  isActive
                    ? 'text-brand-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-700 rounded-b-full" />
                  )}
                  <item.icon className="text-xl" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
