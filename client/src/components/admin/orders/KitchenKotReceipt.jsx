import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiPrinter } from "react-icons/fi";
import { dateTime } from "../../../utils/format";

// This component intentionally receives only the server's kitchen-ticket
// projection. It has no financial or payment fields to accidentally print.
const KitchenKotReceipt = ({ kot, onClose }) => {
  useEffect(() => () => document.body.classList.remove("kitchen-kot-printing"), []);
  if (!kot) return null;
  const location = kot.table?.tableNumber ? `Table ${kot.table.tableNumber}` : "PARCEL / TAKEAWAY";
  const print = () => {
    document.body.classList.add("kitchen-kot-printing");
    const clear = () => document.body.classList.remove("kitchen-kot-printing");
    window.addEventListener("afterprint", clear, { once: true });
    window.print();
    window.setTimeout(clear, 1000);
  };

  return createPortal(
    <div className="kitchen-kot-modal fixed inset-0 z-[70] bg-slate-950/50 p-0 sm:p-4">
      <div className="kitchen-kot-dialog ml-auto flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 print:hidden"><div><h2 className="text-lg font-bold">Kitchen KOT preview</h2><p className="text-sm text-slate-500">Financial and payment data are intentionally excluded.</p></div><button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-3 text-sm">Close</button></header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6"><article id="kitchen-kot-print" className="mx-auto w-[72mm] max-w-full bg-white p-4 font-mono text-xs text-black shadow-sm"><header className="border-b border-dashed border-black pb-3 text-center"><h1 className="text-base font-bold uppercase">{kot.restaurant?.name || "Restaurant"}</h1><p className="mt-1 text-sm font-bold">KITCHEN KOT</p>{kot.restaurant?.address ? <p className="mt-1 text-[10px]">{kot.restaurant.address}</p> : null}</header><section className="space-y-1 border-b border-dashed border-black py-3"><p><strong>KOT:</strong> #{kot.kotNumber}</p><p><strong>Order:</strong> #{kot.orderNumber}</p><p><strong>{kot.table?.tableNumber ? "Table" : "Type"}:</strong> {location}</p><p><strong>Date/Time:</strong> {dateTime(kot.createdAt)}</p></section><table className="w-full border-b border-dashed border-black py-3 text-left"><thead><tr className="border-b border-black"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th></tr></thead><tbody>{(kot.items || []).map((item, index) => <tr key={`${item.name}-${index}`}><td className="py-2 pr-2"><strong>{item.name}</strong>{item.specialInstructions ? <p className="mt-0.5 text-[10px]">Note: {item.specialInstructions}</p> : null}</td><td className="py-2 text-right font-bold">{item.quantity}</td></tr>)}</tbody></table>{kot.notes ? <section className="border-b border-dashed border-black py-3"><strong>Special instructions</strong><p className="mt-1 whitespace-pre-wrap">{kot.notes}</p></section> : null}<footer className="pt-3 text-center font-bold">KITCHEN COPY</footer></article></div>
        <footer className="flex flex-wrap justify-end gap-2 border-t bg-white p-4 print:hidden"><button type="button" onClick={print} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white"><FiPrinter /> Print Kitchen KOT</button><button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm">Close</button></footer>
      </div>
    </div>, document.body
  );
};

export default KitchenKotReceipt;
