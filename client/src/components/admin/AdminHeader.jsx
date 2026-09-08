import { memo } from "react";
import { useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "../common/GlobalSearch";
import OutletSwitcher from "./OutletSwitcher";
import ProfileMenu from "../common/ProfileMenu";
import TodayControl from "../common/TodayControl";

const pageMeta = [
  ["/online-orders", "Online Orders", "Track and fulfill orders from every sales channel."],
  ["/central-kitchen", "Central Kitchen", "Coordinate requisitions, production, and transfers."],
  ["/business-intelligence", "Business Intelligence", "Understand performance with clear operational metrics."],
  ["/my-subscription", "My Subscription", "Review your plan and billing information."],
  ["/intelligence", "RestoSphere Intelligence", "Review restaurant insights and actionable alerts."],
  ["/notifications", "Notifications", "Stay on top of important restaurant activity."],
  ["/customers", "Customer CRM", "Build lasting relationships with your customers."],
  ["/inventory", "Inventory", "Keep stock levels and availability under control."],
  ["/settings", "Settings", "Manage your restaurant preferences and access."],
  ["/payments", "Payments", "Review payments, refunds, and reconciliation."],
  ["/reports", "Reports", "View your restaurant’s operational performance."],
  ["/billing", "Billing & Plans", "Manage billing and your RestoSphere plan."],
  ["/outlets", "Outlets", "Manage your authorized restaurant outlets."],
  ["/orders", "Orders", "Manage restaurant orders and their service status."],
  ["/tables", "Tables", "See table availability and active service."],
  ["/staff", "Staff", "Manage team members and service assignments."],
  ["/kitchen", "Kitchen Display", "Keep kitchen tickets moving in real time."],
  ["/menu", "Menu Management", "Maintain your menu, prices, and availability."],
  ["/categories", "Categories", "Organize your menu for faster service."],
  ["/cockpit", "Service Cockpit", "Monitor live service and urgent activity."],
  ["/loyalty", "Loyalty & Rewards", "Manage customer rewards and activity."],
];

const AdminHeader = ({ title, subtitle }) => {
  const { pathname } = useLocation();
  const matchedMeta = pageMeta.find(([path]) => pathname.includes(path));
  const resolvedTitle = title || matchedMeta?.[1] || "Dashboard";
  const resolvedSubtitle = subtitle || matchedMeta?.[2] || "Today’s restaurant performance at a glance.";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="hidden min-w-0 xl:block">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{resolvedTitle}</h1>
          <p className="text-sm text-slate-500">{resolvedSubtitle}</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2 md:justify-end md:gap-3">
          <GlobalSearch className="order-first w-full min-w-0 sm:w-auto sm:flex-[1_1_16rem] sm:max-w-64 xl:order-none" />
          <OutletSwitcher />

          <TodayControl />

          <div className="relative">
            <NotificationBell />
          </div>

          <ProfileMenu profilePath="/profile" settingsPath="/dashboard/admin/settings" />
        </div>
      </div>
    </header>
  );
};

export default memo(AdminHeader);
