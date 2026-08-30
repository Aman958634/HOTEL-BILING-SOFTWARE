import { useEffect, useRef, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { Link, NavLink, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";

const MainLayout = () => {
  const { isAuthenticated, user, profileLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const accountPath = isAdmin ? "/dashboard/admin" : "/login";
  const accountLabel = isAdmin ? "Dashboard" : "Login";

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const closeForOutsidePress = (event) => {
      if (!headerRef.current?.contains(event.target)) setMobileMenuOpen(false);
    };
    const closeForEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeForOutsidePress);
    document.addEventListener("keydown", closeForEscape);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsidePress);
      document.removeEventListener("keydown", closeForEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header ref={headerRef} className="site-header sticky top-0 z-30 bg-white/95 shadow-sm backdrop-blur-md">
        <nav className="site-nav mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
          <Link to="/" className="site-logo text-xl font-bold tracking-tight text-slate-900">
            RestoSphere
          </Link>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="desktop-nav-links items-center gap-6 text-sm font-medium text-slate-600">
              <NavLink to="/menu" className={({ isActive }) => (isActive ? "text-slate-900" : "hover:text-slate-900")}>
                Menu
              </NavLink>
              <NavLink to="/pricing" className={({ isActive }) => (isActive ? "text-slate-900" : "hover:text-slate-900")}>
                Pricing
              </NavLink>
            </div>

            {profileLoading ? null : (
              <Link
                to={accountPath}
                className="desktop-account-action rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-300/30 transition duration-200 hover:bg-brand-800"
              >
                {accountLabel}
              </Link>
            )}
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-site-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
            </button>
          </div>
        </nav>
        {mobileMenuOpen ? (
          <div id="mobile-site-navigation" className="mobile-nav-panel" aria-label="Mobile navigation">
            <NavLink to="/menu" onClick={() => setMobileMenuOpen(false)}>Menu</NavLink>
            <NavLink to="/pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</NavLink>
            {!profileLoading ? <Link to={accountPath} onClick={() => setMobileMenuOpen(false)}>{accountLabel}</Link> : null}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
