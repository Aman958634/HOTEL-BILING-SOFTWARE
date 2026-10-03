import { memo, useEffect, useState } from "react";
import { currency, dateTime } from "../../utils/format";
import { FiBookOpen } from "react-icons/fi";

const MenuImage = memo(({ src, alt }) => {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) return <div className="h-10 w-10 rounded-lg bg-slate-100" aria-label="No food image" role="img" />;

  return <img src={src} alt={alt} loading="lazy" decoding="async" className="h-10 w-10 rounded-lg object-cover" onError={() => setFailedSource(src)} />;
});

const useDesktopTable = () => {
  const getMatch = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  const [desktop, setDesktop] = useState(getMatch);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return desktop;
};

const MenuActions = ({ item, onEdit, onDelete, onToggle }) => (
  <div className="flex gap-2">
    <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => onEdit(item)}>Edit</button>
    <button className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => onDelete(item)}>Delete</button>
    <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => onToggle(item)}>{item.isAvailable ? "Disable" : "Enable"}</button>
  </div>
);

const MenuTableRow = memo(({ item, onEdit, onDelete, onToggle }) => (
  <tr className="border-b border-slate-100 text-slate-700">
    <td className="py-2 pr-3"><MenuImage src={item.image} alt={item.name} /></td>
    <td className="py-2 pr-3 font-medium">{item.name}</td>
    <td className="py-2 pr-3">{item.category?.name || "-"}</td>
    <td className="py-2 pr-3">{item.description || "-"}</td>
    <td className="py-2 pr-3">{currency(item.price)}</td>
    <td className="py-2 pr-3">{item.isAvailable ? "Available" : "Unavailable"}</td>
    <td className="py-2 pr-3">{dateTime(item.createdAt)}</td>
    <td className="py-2 pr-3"><MenuActions item={item} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} /></td>
  </tr>
));

const MenuCard = memo(({ item, onEdit, onDelete, onToggle }) => (
  <article className="rounded-xl border border-slate-200 p-3">
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h4 className="min-w-0 break-words font-semibold text-slate-900">{item.name}</h4>
      <p className="shrink-0 text-xs text-slate-500">{item.isAvailable ? "Available" : "Unavailable"}</p>
    </div>
    <p className="mt-1 break-words text-sm text-slate-500">{item.category?.name || "-"}</p>
    <p className="mt-1 text-sm text-slate-600">{currency(item.price)}</p>
    <div className="mt-3"><MenuActions item={item} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} /></div>
  </article>
));

const MenuTable = memo(({ items, loading, onEdit, onDelete, onToggle }) => {
  const desktop = useDesktopTable();
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        <FiBookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
        No menu items found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {desktop ? <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Image</th>
              <th className="py-2 pr-3">Food Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Availability</th>
              <th className="py-2 pr-3">Created Date</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>{items.map((item) => <MenuTableRow key={item._id} item={item} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />)}</tbody>
        </table>
      </div> : <div className="space-y-3">
        {items.map((item) => <MenuCard key={item._id} item={item} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />)}
      </div>}
    </div>
  );
});

export default MenuTable;
