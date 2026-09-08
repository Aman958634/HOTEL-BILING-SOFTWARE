import { useEffect, useRef, useState } from "react";
import { FiArrowRight, FiChevronRight, FiMenu, FiStar, FiTag, FiUser, FiX } from "react-icons/fi";
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
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const closeForEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", closeForEscape);
    return () => {
      document.removeEventListener("keydown", closeForEscape);
      window.cancelAnimationFrame(focusFrame);
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
      <header className="site-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-950/[0.03] backdrop-blur-md">
        <nav className="site-nav mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
          <Link to="/" className="site-logo flex min-w-0 items-center gap-3 text-xl font-bold tracking-tight text-slate-900" onClick={closeMobileMenu}>
            <span className="truncate">RestoSphere</span>
            <span className="site-tagline">ALL-IN-ONE RESTAURANT MANAGEMENT</span>
          </Link>

          <div className="flex shrink-0 items-center">
            {profileLoading ? null : (
              <div className="desktop-actions">
                <NavLink to="/pricing" className={({ isActive }) => `desktop-action desktop-pricing-action${isActive ? " is-active" : ""}`}>
                  <FiTag aria-hidden="true" />
                  <span>Pricing</span>
                </NavLink>
                <Link to={accountPath} className="desktop-action desktop-login-action">
                  <FiUser aria-hidden="true" />
                  <span>{accountLabel}</span>
                  <FiArrowRight className="desktop-login-arrow" aria-hidden="true" />
                </Link>
              </div>
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
      <div className={`mobile-nav-overlay${mobileMenuOpen ? " is-open" : ""}`} aria-hidden={!mobileMenuOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) closeMobileMenu(); }}>
        <aside id="mobile-site-navigation" className="mobile-nav-panel" role="dialog" aria-modal={mobileMenuOpen ? "true" : undefined} aria-labelledby="mobile-navigation-title">
          <div className="mobile-nav-panel-header">
            <span id="mobile-navigation-title" className="min-w-0 truncate text-lg font-bold tracking-tight text-slate-900">RestoSphere</span>
            <button ref={closeButtonRef} type="button" className="mobile-nav-close-button" aria-label="Close navigation menu" onClick={closeMobileMenu}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          <nav className="mobile-nav-links" aria-label="Mobile navigation">
            <NavLink to="/pricing" className={({ isActive }) => `mobile-nav-link${isActive ? " is-active" : ""}`}>
              <FiTag aria-hidden="true" />
              <span>Pricing</span>
              <FiChevronRight className="mobile-nav-chevron" aria-hidden="true" />
            </NavLink>
            {!profileLoading ? <Link to={accountPath} className="mobile-nav-link">
              <FiUser aria-hidden="true" />
              <span>{accountLabel}</span>
              <FiChevronRight className="mobile-nav-chevron" aria-hidden="true" />
            </Link> : null}
          </nav>
          <div className="mobile-nav-cta-card">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><FiStar className="mobile-nav-sparkle" aria-hidden="true" />Start Managing</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Simplify your restaurant operations today.</p>
            <Link to="/register" className="mobile-nav-get-started">
              Get Started <FiArrowRight className="mobile-nav-get-started-arrow" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
      <main className="app-page-container mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
