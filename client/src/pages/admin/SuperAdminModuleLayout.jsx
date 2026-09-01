import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SuperAdminSidebar from "../../components/superAdmin/SuperAdminSidebar";
import MobileAppHeader from "../../components/common/MobileAppHeader";

const SuperAdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="app-shell">
      <div className="flex min-h-dvh">
        <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="min-w-0 flex-1 md:ml-72">
          <MobileAppHeader onMenuClick={() => setSidebarOpen(true)} notificationCount={0} />
          <main className="min-w-0">
            <div className="app-page-container">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default SuperAdminModuleLayout;
