import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const HomePage = () => (
  <div className="space-y-16">
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-8"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm shadow-teal-100/80">
          ⭐ ALL-IN-ONE RESTAURANT MANAGEMENT
        </div>

        <div className="space-y-5">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-6xl">
            Enterprise Restaurant <span className="text-brand-700">Management</span> for Modern Teams
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-600">
            Manage orders, tables, kitchen, inventory, staff and delivery through one powerful SaaS platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition duration-200 hover:bg-brand-800"
          >
            View Pricing →
          </Link>
          <Link
            to="/menu"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition duration-200 hover:border-slate-400"
          >
            Browse Menu
          </Link>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <p className="text-sm font-semibold text-slate-900">Easy to Use</p>
            <p className="mt-2 text-sm text-slate-500">Intuitive Interface</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <p className="text-sm font-semibold text-slate-900">Real-time Updates</p>
            <p className="mt-2 text-sm text-slate-500">Live Synchronization</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
            <p className="text-sm font-semibold text-slate-900">Secure & Reliable</p>
            <p className="mt-2 text-sm text-slate-500">99.9% Uptime</p>
          </div>
        </div>
      </motion.div>
    </section>

    <section className="space-y-8">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Everything You Need to Run Your Restaurant</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Complete restaurant management solution in one platform</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          { title: "Menu Management", description: "Create, update and manage your menu with categories, prices and availability." },
          { title: "Order Management", description: "Track orders in real-time, manage kitchen workflow and order status." },
          { title: "Table & Reservation", description: "Smart table management and seamless reservation handling." },
          { title: "Kitchen Management", description: "Streamline kitchen operations and track preparation status." },
          { title: "Inventory Management", description: "Monitor stock levels, set alerts and manage inventory efficiently." },
          { title: "Reports & Analytics", description: "Get detailed insights and analytics to grow your restaurant business." },
        ].map((feature) => (
          <article key={feature.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-brand-700">✓</div>
            <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>

    <footer className="rounded-[32px] bg-slate-950 px-6 py-5 text-slate-200 shadow-sm sm:px-8">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-lg font-bold text-white sm:text-xl">RestoSphere</p>
          <p className="mt-0.5 text-sm text-slate-400">Smarter Restaurant Management</p>
        </div>
        <p className="shrink-0 text-center text-sm text-slate-500 sm:text-right">
          © 2026 RestoSphere. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
);

export default HomePage;
