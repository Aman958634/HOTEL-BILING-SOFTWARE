import { useEffect, useRef, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

const MainLayout = () => {
  const { isAuthenticated, user, profileLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const location = useLocation();
  const accountPath = isAdmin ? "/dashboard/admin" : "/login";
  const accountLabel = isAdmin ? "Dashboard" : "Login";

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeForEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", closeForEscape);
    return () => {
      document.removeEventListener("keydown", closeForEscape);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell bg-slate-50 text-slate-900">
      <header className="site-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur-md">
        <nav className="site-nav mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-3 px-4 md:px-6 lg:px-8" aria-label="Primary navigation">
          <Link to="/" className="site-logo min-w-0 truncate text-xl font-bold tracking-tight text-slate-900" onClick={closeMobileMenu}>
            RestoSphere
          </Link>

          <div className="flex shrink-0 items-center gap-3 md:gap-6">
            <div className="desktop-nav-links items-center gap-6 text-sm font-medium text-slate-600">
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
              ref={menuButtonRef}
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
      </header>
      {mobileMenuOpen ? (
        <div className="mobile-nav-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMobileMenu(); }}>
          <aside
            id="mobile-site-navigation"
            className="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
          >
            <div className="mobile-nav-panel-header">
              <span id="mobile-navigation-title" className="min-w-0 truncate text-lg font-bold tracking-tight text-slate-900">RestoSphere</span>
              <button ref={closeButtonRef} type="button" className="mobile-nav-close-button" aria-label="Close navigation menu" onClick={closeMobileMenu}>
                <FiX aria-hidden="true" />
              </button>
            </div>
            <nav className="mobile-nav-links" aria-label="Mobile navigation">
              <NavLink to="/pricing">Pricing</NavLink>
              {!profileLoading ? <Link to={accountPath}>{accountLabel}</Link> : null}
              <a href="mailto:contact@restosphere.com" onClick={closeMobileMenu}>Contact Us</a>
            </nav>
          </aside>
        </div>
      ) : null}
      <main className="app-page-container mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
