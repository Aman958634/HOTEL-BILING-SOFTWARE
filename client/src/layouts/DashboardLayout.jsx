import { Link, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const DashboardLayout = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl bg-slate-900 p-4">
          <h2 className="mb-4 text-lg font-semibold">Dashboard</h2>
          <div className="flex flex-col gap-2 text-sm">
            {user?.role === "admin" && <Link to="/dashboard/admin">Admin</Link>}
            <Link to="/dashboard/chef">Chef</Link>
            <Link to="/dashboard/waiter">Waiter</Link>
            <Link to="/dashboard/delivery">Delivery</Link>
            <Link to="/dashboard/customer">Customer</Link>
          </div>
        </aside>
        <section className="rounded-2xl bg-slate-900 p-4">
          <Outlet />
        </section>
      </div>
    </div>
  );
};

export default DashboardLayout;
