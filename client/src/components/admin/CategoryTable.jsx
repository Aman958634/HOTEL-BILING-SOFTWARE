import { FiLayers } from "react-icons/fi";

const CategoryTable = ({ items, loading, onEdit, onDelete, onToggle }) => {
  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        <FiLayers className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
        No categories found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="border-b border-slate-100 text-slate-700">
                <td className="py-2 pr-3 font-medium">{item.name}</td>
                <td className="py-2 pr-3">{item.description || "-"}</td>
                <td className="py-2 pr-3">{item.active || item.isActive ? "Active" : "Disabled"}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => onEdit(item)}>Edit</button>
                    <button className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => onDelete(item)}>Delete</button>
                    <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => onToggle(item)}>
                      {item.active || item.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CategoryTable;
