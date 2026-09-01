import { memo } from "react";

const TablePagination = ({ meta, onPageChange, itemLabel = "records", className = "" }) => {
  const page = Math.max(Number(meta?.page) || 1, 1);
  const limit = Math.max(Number(meta?.limit) || 1, 1);
  const total = Math.max(Number(meta?.total) || 0, 0);
  const totalPages = Math.max(Number(meta?.totalPages) || 1, 1);

  if (totalPages <= 1) return null;

  const firstItem = (page - 1) * limit + (total ? 1 : 0);
  const lastItem = Math.min(page * limit, total);
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1);

  return (
    <nav aria-label={`${itemLabel} pagination`} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm ${className}`}>
      <p className="text-slate-600">Showing {firstItem}-{lastItem} of {total} {itemLabel}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="min-h-10 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-60">Previous</button>
        {pages.map((itemPage) => <button key={itemPage} type="button" onClick={() => onPageChange(itemPage)} aria-current={itemPage === page ? "page" : undefined} className={`min-h-10 rounded-lg border px-3 py-1.5 ${itemPage === page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{itemPage}</button>)}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="min-h-10 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-60">Next</button>
      </div>
    </nav>
  );
};

export default memo(TablePagination);
