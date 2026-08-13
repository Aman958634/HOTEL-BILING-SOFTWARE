import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";

const ReservationPage = () => {
  const [form, setForm] = useState({ table: "", date: "", guests: 2, restaurant: "", notes: "" });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/reservations", form);
      toast.success("Reservation created");
      setForm({ table: "", date: "", guests: 2, restaurant: "", notes: "" });
    } catch {
      toast.error("Reservation failed");
    }
  };

  return (
    <form onSubmit={submit} className="glass max-w-xl rounded-2xl p-6">
      <h2 className="text-2xl font-bold">Reserve Table</h2>
      <input className="mt-4 w-full rounded-xl border p-3" placeholder="Restaurant ID" value={form.restaurant} onChange={(e) => setForm({ ...form, restaurant: e.target.value })} />
      <input className="mt-3 w-full rounded-xl border p-3" placeholder="Table ID" value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} />
      <input className="mt-3 w-full rounded-xl border p-3" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <input className="mt-3 w-full rounded-xl border p-3" type="number" min="1" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} />
      <textarea className="mt-3 w-full rounded-xl border p-3" rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="mt-4 rounded-xl bg-brand-700 px-5 py-2 text-white">Reserve</button>
    </form>
  );
};

export default ReservationPage;
