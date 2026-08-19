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
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [sidebarOpen]);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="min-w-0 flex-1 flex flex-col h-full md:ml-72">
          <div className="hidden md:block">
            <MobileAppHeader onMenuClick={() => setSidebarOpen(true)} notificationCount={0} />
          </div>
          <div className="md:hidden">
            <MobileAppHeader onMenuClick={() => setSidebarOpen(true)} notificationCount={0} />
          </div>
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-0">
            <div className="p-4 md:p-6">
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
