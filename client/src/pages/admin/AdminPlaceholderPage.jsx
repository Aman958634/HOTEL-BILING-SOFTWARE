const AdminPlaceholderPage = ({ title }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-700">
    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-500">
      This module is now route-protected and ready. You can extend workflows in the next sprint without changing auth or layout foundations.
    </p>
  </div>
);

export default AdminPlaceholderPage;
