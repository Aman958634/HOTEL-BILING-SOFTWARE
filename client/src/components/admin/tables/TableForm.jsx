import { useEffect, useState } from "react";

const initialForm = {
  tableNumber: "",
  capacity: 4,
  floor: "Ground Floor",
  section: "Main Hall",
  shape: "SQUARE",
  description: "",
};

const floorOptions = ["Ground Floor", "First Floor", "Rooftop"];
const sectionOptions = ["Main Hall", "AC Hall", "Outdoor", "VIP", "Family Area"];
const shapeOptions = ["ROUND", "SQUARE", "RECTANGLE"];

const TableForm = ({ open, loading, initialData, onClose, onSubmit }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setForm({
        tableNumber: initialData.tableNumber || "",
        capacity: initialData.capacity || 1,
        floor: initialData.floor || "Ground Floor",
        section: initialData.section || "Main Hall",
        shape: String(initialData.shape || "SQUARE").toUpperCase(),
        description: initialData.description || "",
      });
    } else {
      setForm(initialForm);
    }

    setErrors({});
  }, [open, initialData]);

  if (!open) return null;

  const validate = () => {
    const next = {};

    if (!form.tableNumber.trim()) {
      next.tableNumber = "Table number is required";
    }

    if (!form.capacity || Number(form.capacity) < 1) {
      next.capacity = "Capacity must be at least 1 guest";
    }

    if (!form.floor.trim()) {
      next.floor = "Floor is required";
    }

    if (!form.section.trim()) {
      next.section = "Section is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      tableNumber: form.tableNumber.trim(),
      capacity: Number(form.capacity),
      floor: form.floor,
      section: form.section,
      shape: form.shape,
      description: form.description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-900">{initialData ? "Edit Table" : "Add Table"}</h3>
        <p className="mt-1 text-sm text-slate-500">Manage table identity and seating details. Occupancy is derived from active orders.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">Table Number</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 p-2"
              value={form.tableNumber}
              onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
            />
            {errors.tableNumber && <p className="mt-1 text-xs text-rose-600">{errors.tableNumber}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Capacity</label>
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-xl border border-slate-300 p-2"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
            {errors.capacity && <p className="mt-1 text-xs text-rose-600">{errors.capacity}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Floor</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 p-2"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            >
              {floorOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {errors.floor && <p className="mt-1 text-xs text-rose-600">{errors.floor}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Section</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 p-2"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            >
              {sectionOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {errors.section && <p className="mt-1 text-xs text-rose-600">{errors.section}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Shape</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 p-2"
              value={form.shape}
              onChange={(e) => setForm({ ...form, shape: e.target.value })}
            >
              {shapeOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600">Description</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2"
            placeholder="Add any specific notes for this table"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-70">
            {loading ? "Saving..." : initialData ? "Update Table" : "Create Table"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TableForm;
