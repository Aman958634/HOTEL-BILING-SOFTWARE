import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import { fetchMySubscription } from "../../services/billingService";
import {
  SubscriptionExpiredGate,
  TrialBanner,
} from "../../components/subscription/SubscriptionWidgets";

const AdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const location = useLocation();
  const isBilling =
    location.pathname.includes("/billing") ||
    location.pathname.includes("/my-subscription");

  const loadSubscription = async () => {
    try {
      const { data } = await fetchMySubscription();
      const sub = data?.data || null;
      setSubscription(sub);
      if (sub?.status === "expired" || sub?.status === "cancelled" || sub?.status === "suspended") {
        if (!isBilling) {
          setBlocked({
            code: `SUBSCRIPTION_${String(sub.status).toUpperCase()}`,
            message:
              sub.status === "expired"
                ? "Please choose a paid plan to continue using RestoSphere."
                : data?.message,
          });
        }
      } else {
        setBlocked(null);
      }
    } catch (_err) {
      // billing endpoint should work even when expired; ignore soft failures here
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [location.pathname]);

  useEffect(() => {
    const onBlocked = (event) => {
      if (isBilling) return;
      setBlocked(event.detail || { message: "Your 15-day free trial has ended." });
    };
    window.addEventListener("restosphere:subscription-blocked", onBlocked);
    return () => window.removeEventListener("restosphere:subscription-blocked", onBlocked);
  }, [isBilling]);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <AdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

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
            <AdminHeader />
            <div className="p-4 md:p-6">
              {!isBilling && <TrialBanner subscription={subscription} />}
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <SubscriptionExpiredGate
        open={Boolean(blocked) && !isBilling}
        message={blocked?.message}
        onClose={() => setBlocked(null)}
      />
    </div>
  );
};

export default AdminModuleLayout;
