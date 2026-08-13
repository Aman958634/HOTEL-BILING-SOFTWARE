import { Link, NavLink, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const MainLayout = () => {
  const { accessToken, user } = useSelector((state) => state.auth);

  const accountLink =
    accessToken && user?.role === "admin"
      ? "/dashboard/admin"
      : accessToken && user?.role === "super_admin"
        ? "/super-admin/dashboard"
        : "/login";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/95 shadow-sm backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">
            RestoSphere
          </Link>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
              <NavLink to="/menu" className={({ isActive }) => (isActive ? "text-slate-900" : "hover:text-slate-900")}>
                Menu
              </NavLink>
              <NavLink to="/pricing" className={({ isActive }) => (isActive ? "text-slate-900" : "hover:text-slate-900")}>
                Pricing
              </NavLink>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium text-slate-600 md:hidden">
              <NavLink to="/pricing" className={({ isActive }) => (isActive ? "text-slate-900" : "")}>
                Pricing
              </NavLink>
            </div>

            <Link
              to={accountLink}
              className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-300/30 transition duration-200 hover:bg-brand-800"
            >
              {accessToken ? "Dashboard" : "Login"}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
