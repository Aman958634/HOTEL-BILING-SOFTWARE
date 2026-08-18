import { useState } from "react";
import { Outlet } from "react-router-dom";
import SuperAdminSidebar from "../../components/superAdmin/SuperAdminSidebar";
import MobileAppHeader from "../../components/common/MobileAppHeader";
import MobileBottomNav from "../../components/common/MobileBottomNav";

const SuperAdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
            <div className="p-4 md:p-6">
              <Outlet />
            </div>
          </main>
          <div className="md:hidden">
            <MobileBottomNav />
          </div>
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
