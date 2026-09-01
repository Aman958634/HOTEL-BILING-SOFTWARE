import { memo, useEffect, useState } from "react";
import Button from "../../ui/Button";

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
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="table-form-title">
      <form onSubmit={submit} className="ui-modal max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <h3 id="table-form-title" className="text-xl font-bold text-slate-900">{initialData ? "Edit Table" : "Add Table"}</h3>
        <p className="mt-1 text-sm text-slate-500">Manage table identity and seating details. Occupancy is derived from active orders.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <label htmlFor="table-number" className="text-sm font-medium text-slate-600">Table Number</label>
            <input
              id="table-number"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              value={form.tableNumber}
              onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
            />
            {errors.tableNumber && <p className="mt-1 break-words text-xs text-rose-600">{errors.tableNumber}</p>}
          </div>

          <div>
            <label htmlFor="table-capacity" className="text-sm font-medium text-slate-600">Capacity</label>
            <input
              id="table-capacity"
              type="number"
              min="1"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
            {errors.capacity && <p className="mt-1 break-words text-xs text-rose-600">{errors.capacity}</p>}
          </div>

          <div>
            <label htmlFor="table-floor" className="text-sm font-medium text-slate-600">Floor</label>
            <select
              id="table-floor"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            >
              {floorOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {errors.floor && <p className="mt-1 break-words text-xs text-rose-600">{errors.floor}</p>}
          </div>

          <div>
            <label htmlFor="table-section" className="text-sm font-medium text-slate-600">Section</label>
            <select
              id="table-section"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            >
              {sectionOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {errors.section && <p className="mt-1 break-words text-xs text-rose-600">{errors.section}</p>}
          </div>

          <div>
            <label htmlFor="table-shape" className="text-sm font-medium text-slate-600">Shape</label>
            <select
              id="table-shape"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
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
          <label htmlFor="table-description" className="text-sm font-medium text-slate-600">Description</label>
          <textarea
            id="table-description"
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
            placeholder="Add any specific notes for this table"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} loadingText="Saving…">{initialData ? "Update Table" : "Create Table"}</Button>
        </div>
      </form>
    </div>
  );
};

export default memo(TableForm);
