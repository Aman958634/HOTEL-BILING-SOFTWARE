import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import SuperAdminSidebar from "../../components/superAdmin/SuperAdminSidebar";
import MobileAppHeader from "../../components/common/MobileAppHeader";

const SuperAdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <div className="flex min-h-dvh">
        <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="min-w-0 flex-1 lg:ml-72">
          <MobileAppHeader
            onMenuClick={() => setSidebarOpen(true)}
            sidebarOpen={sidebarOpen}
            sidebarId="super-admin-navigation-drawer"
            subtitle="Super Admin"
            settingsPath="/super-admin/settings"
          />
          <main className="min-w-0">
            <div className="app-page-container">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default SuperAdminModuleLayout;
