import { useEffect, useRef, useState } from "react";
import { FiArrowRight, FiChevronRight, FiDownload, FiMenu, FiStar, FiTag, FiUser, FiX } from "react-icons/fi";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import usePWAInstall from "../hooks/usePWAInstall";
import LanguageSelector from "../components/common/LanguageSelector";
import { useLanguage } from "../i18n/LanguageContext";

const MainLayout = () => {
  const { isAuthenticated, user, profileLoading } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const location = useLocation();
  const pwa = usePWAInstall();
  const { language, t } = useLanguage();
  const accountPath = isAdmin ? "/dashboard/admin" : "/login";
  const accountLabel = isAdmin ? t("header.dashboard") : t("header.login");
  const isPublicHome = location.pathname === "/";

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
    <div className={`app-shell language-${language} bg-slate-50 text-slate-900${isPublicHome ? " public-landing" : ""}`}>
      <header className="site-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-950/[0.03] backdrop-blur-md">
        <nav className="site-nav mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8" aria-label={t("header.primaryNavigation")}>
          <Link to="/" className="site-logo flex min-w-0 items-center text-slate-900" onClick={closeMobileMenu}>
            <span className="navbar-brand">
              <img
                src="/restosphere-logo.png"
                alt={t("header.logoAlt")}
                className="brand-logo"
                width="48"
                height="48"
                decoding="async"
                fetchPriority="high"
              />
              <span className="brand-name truncate"><span className="brand-name-resto">Resto</span><span className="brand-name-sphere">Sphere</span></span>
            </span>
            <span className="site-tagline">{t("header.tagline")}</span>
          </Link>

          <div className="flex shrink-0 items-center">
            {profileLoading ? null : (
              <div className="desktop-actions">
                <LanguageSelector compact />
                <NavLink to="/pricing" className={({ isActive }) => `desktop-action desktop-pricing-action${isActive ? " is-active" : ""}`}>
                  <FiTag aria-hidden="true" />
                  <span>{t("header.pricing")}</span>
                </NavLink>
                <Link to={accountPath} className="desktop-action desktop-login-action">
                  <FiUser aria-hidden="true" />
                  <span>{accountLabel}</span>
                  <FiArrowRight className="desktop-login-arrow" aria-hidden="true" />
                </Link>
                {pwa.showInstallAction ? <button type="button" className="desktop-action desktop-install-action" aria-label="Install RestoSphere app" disabled={pwa.isPrompting} onClick={() => { void pwa.requestInstall(); }}>
                  <FiDownload aria-hidden="true" />
                  <span>{pwa.isPrompting ? t("header.preparing") : t("header.installApp")}</span>
                </button> : null}
              </div>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? t("header.closeMenu") : t("header.openMenu")}
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
            <button ref={closeButtonRef} type="button" className="mobile-nav-close-button" aria-label={t("header.closeMenu")} onClick={closeMobileMenu}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          <nav className="mobile-nav-links" aria-label={t("header.primaryNavigation")}>
            <LanguageSelector />
            <NavLink to="/pricing" className={({ isActive }) => `mobile-nav-link${isActive ? " is-active" : ""}`}>
              <FiTag aria-hidden="true" />
              <span>{t("header.pricing")}</span>
              <FiChevronRight className="mobile-nav-chevron" aria-hidden="true" />
            </NavLink>
            {!profileLoading ? <Link to={accountPath} className="mobile-nav-link">
              <FiUser aria-hidden="true" />
              <span>{accountLabel}</span>
              <FiChevronRight className="mobile-nav-chevron" aria-hidden="true" />
            </Link> : null}
            {pwa.showInstallAction ? <button type="button" className="mobile-nav-link mobile-install-action" aria-label={t("header.installApp")} disabled={pwa.isPrompting} onClick={() => { closeMobileMenu(); void pwa.requestInstall(); }}>
              <FiDownload aria-hidden="true" />
              <span>{pwa.isPrompting ? t("header.preparing") : t("header.installApp")}</span>
              <FiChevronRight className="mobile-nav-chevron" aria-hidden="true" />
            </button> : null}
          </nav>
          <div className="mobile-nav-cta-card">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><FiStar className="mobile-nav-sparkle" aria-hidden="true" />{t("header.startManaging")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{t("header.simplify")}</p>
            <Link to="/register" className="mobile-nav-get-started">
              {t("header.getStarted")} <FiArrowRight className="mobile-nav-get-started-arrow" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
      <main className="app-page-container mx-auto max-w-7xl">
        <Outlet />
      </main>
      {pwa.showIOSInstructions ? <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/35 p-3 sm:items-center sm:justify-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) pwa.closeInstallHelp(); }}>
        <section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="pwa-install-title" className="text-lg font-bold text-slate-900">Install RestoSphere</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Tap the Share button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to install RestoSphere.</li></ol>
            </div>
            <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={pwa.closeInstallHelp}>Close</button>
          </div>
        </section>
      </div> : null}
    </div>
  );
};

export default MainLayout;
