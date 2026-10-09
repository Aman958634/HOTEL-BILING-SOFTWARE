import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiPrinter } from "react-icons/fi";
import { dateTime } from "../../../utils/format";

// This component intentionally receives only the server's kitchen-ticket
// projection. It has no financial or payment fields to accidentally print.
const KitchenKotReceipt = ({ kot, onClose }) => {
  useEffect(() => () => document.body.classList.remove("kitchen-kot-printing"), []);
  if (!kot) return null;
  const tableLabel = kot.table?.tableNumber ? `Table ${kot.table.tableNumber}` : "PARCEL / TAKEAWAY";
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <article id="kitchen-kot-print" className="kitchen-kot-ticket mx-auto w-full max-w-[72mm] bg-white px-3 py-3 text-[14px] leading-[1.35] text-black sm:px-4">
            <header className="border-b border-black pb-2.5 text-center">
              <h1 className="text-[17px] font-bold leading-tight text-slate-900">{kot.restaurant?.name || "Hotel"}</h1>
              <p className="mx-auto mt-2 inline-block rounded-md bg-slate-100 px-3 py-1.5 text-[15px] font-bold text-slate-900">{tableLabel}</p>
            </header>

            <section className="space-y-1.5 border-b border-black py-2.5">
              <p><strong>KOT No:</strong> #{kot.kotNumber}</p>
              <p><strong>Order No:</strong> #{kot.orderNumber}</p>
              <p><strong>Date &amp; Time:</strong> {dateTime(kot.createdAt)}</p>
            </section>

            <table className="w-full border-b border-dashed border-black text-left">
              <thead className="bg-slate-100 text-[12px] font-bold uppercase tracking-wide">
                <tr><th className="px-2 py-2">Item</th><th className="px-2 py-2 text-right">Qty</th></tr>
              </thead>
              <tbody>
                {(kot.items || []).map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-b border-dashed border-slate-300 last:border-0">
                    <td className="py-2.5 pr-2 font-bold leading-snug">{item.name}{item.specialInstructions ? <p className="mt-0.5 text-[11px] font-medium">Note: {item.specialInstructions}</p> : null}</td>
                    <td className="w-10 py-2.5 text-right font-bold">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {kot.notes ? <section className="border-b border-dashed border-black py-2.5"><strong>Special instructions</strong><p className="mt-1 whitespace-pre-wrap">{kot.notes}</p></section> : null}
            <footer className="border-t border-dashed border-black pt-2.5 text-center text-[13px] font-bold tracking-wide">KITCHEN COPY</footer>
          </article>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t bg-white p-4 print:hidden"><button type="button" onClick={print} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white"><FiPrinter /> Print Kitchen KOT</button><button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm">Close</button></footer>
      </div>
    </div>, document.body
  );
};

export default KitchenKotReceipt;
