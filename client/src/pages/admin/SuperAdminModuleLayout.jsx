import { useState } from "react";
import { Outlet } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import SuperAdminSidebar from "../../components/superAdmin/SuperAdminSidebar";

const SuperAdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="min-w-0 flex-1 flex flex-col h-full md:ml-72">
          <div className="px-4 pt-4 md:hidden">
            <button
              className="rounded-lg border border-slate-300 bg-white p-2"
              onClick={() => setSidebarOpen(true)}
            >
              <FiMenu />
            </button>
          </div>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-4 pt-4 md:p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminModuleLayout;
