import { memo, useEffect, useState } from "react";
import Button from "../../ui/Button";
import { validateTableForm } from "../../../utils/formValidation";

const initialForm = {
  tableNumber: "",
  capacity: "",
  floor: "",
  section: "Main Hall",
  shape: "",
  description: "",
};

const floorOptions = ["Ground Floor", "First Floor", "Rooftop"];
// This is the sole UI source for standard table sections; the backend preserves
// valid existing/custom values rather than constraining records to this list.
const sectionOptions = ["Main Hall", "AC Hall", "Non AC", "Outdoor", "VIP", "Family Area"];
const shapeOptions = ["ROUND", "SQUARE", "RECTANGLE"];

const TableForm = ({ open, loading, initialData, onClose, onSubmit }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setForm({
        tableNumber: initialData.tableNumber || "",
        capacity: initialData.capacity ?? "",
        floor: initialData.floor ?? "",
        section: initialData.section || "Main Hall",
        shape: initialData.shape ? String(initialData.shape).toUpperCase() : "",
        description: initialData.description || "",
      });
    } else {
      setForm(initialForm);
    }

    setErrors({});
  }, [open, initialData]);

  if (!open) return null;

  const validate = () => {
    const next = validateTableForm(form);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const update = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[field]) setErrors(validateTableForm(next));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!validate()) return;

    onSubmit({
      tableNumber: form.tableNumber.trim(),
      section: form.section,
      description: form.description.trim(),
      ...(form.capacity === "" ? (initialData ? { capacity: null } : {}) : { capacity: Number(form.capacity) }),
      ...(form.floor.trim() ? { floor: form.floor.trim() } : initialData ? { floor: null } : {}),
      ...(form.shape ? { shape: form.shape } : initialData ? { shape: null } : {}),
    });
  };

  const fieldClass = (field) => `mt-1 min-h-11 w-full rounded-xl border px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 ${errors[field] ? "border-rose-500" : "border-slate-300"}`;
  const availableSectionOptions = initialData?.section && !sectionOptions.includes(initialData.section) ? [initialData.section, ...sectionOptions] : sectionOptions;

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="table-form-title">
      <form onSubmit={submit} className="ui-modal max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <h3 id="table-form-title" className="text-xl font-bold text-slate-900">{initialData ? "Edit Table" : "Add Table"}</h3>
        <p className="mt-1 text-sm text-slate-500">Manage table identity and seating details. Occupancy is derived from active orders.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <label htmlFor="table-number" className="text-sm font-medium text-slate-600">Table Number</label>
            <input id="table-number" aria-invalid={Boolean(errors.tableNumber)} aria-describedby={errors.tableNumber ? "table-number-error" : undefined} className={fieldClass("tableNumber")} value={form.tableNumber} onChange={(event) => update("tableNumber", event.target.value)} />
            {errors.tableNumber && <p id="table-number-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.tableNumber}</p>}
          </div>

          <div>
            <label htmlFor="table-capacity" className="text-sm font-medium text-slate-600">Capacity (Optional)</label>
            <input id="table-capacity" type="number" min="1" aria-invalid={Boolean(errors.capacity)} aria-describedby={errors.capacity ? "table-capacity-error" : undefined} className={fieldClass("capacity")} value={form.capacity} onChange={(event) => update("capacity", event.target.value)} />
            {errors.capacity && <p id="table-capacity-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.capacity}</p>}
          </div>

          <div>
            <label htmlFor="table-floor" className="text-sm font-medium text-slate-600">Floor (Optional)</label>
            <select id="table-floor" aria-invalid={Boolean(errors.floor)} aria-describedby={errors.floor ? "table-floor-error" : undefined} className={fieldClass("floor")} value={form.floor} onChange={(event) => update("floor", event.target.value)}>
              <option value="">Select Floor (Optional)</option>
              {floorOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {errors.floor && <p id="table-floor-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.floor}</p>}
          </div>

          <div>
            <label htmlFor="table-section" className="text-sm font-medium text-slate-600">Section</label>
            <select id="table-section" aria-invalid={Boolean(errors.section)} aria-describedby={errors.section ? "table-section-error" : undefined} className={fieldClass("section")} value={form.section} onChange={(event) => update("section", event.target.value)}>
              {availableSectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {errors.section && <p id="table-section-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.section}</p>}
          </div>

          <div>
            <label htmlFor="table-shape" className="text-sm font-medium text-slate-600">Shape (Optional)</label>
            <select id="table-shape" aria-invalid={Boolean(errors.shape)} aria-describedby={errors.shape ? "table-shape-error" : undefined} className={fieldClass("shape")} value={form.shape} onChange={(event) => update("shape", event.target.value)}>
              <option value="">Select Shape (Optional)</option>
              {shapeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {errors.shape && <p id="table-shape-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.shape}</p>}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="table-description" className="text-sm font-medium text-slate-600">Description (Optional)</label>
          <textarea id="table-description" rows={3} maxLength={500} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "table-description-error" : undefined} className={fieldClass("description")} placeholder="Add any specific notes for this table" value={form.description} onChange={(event) => update("description", event.target.value)} />
          {errors.description && <p id="table-description-error" role="alert" className="mt-1 break-words text-xs text-rose-600">{errors.description}</p>}
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
