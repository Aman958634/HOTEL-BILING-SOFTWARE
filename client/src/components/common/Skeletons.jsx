const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden="true" />
);

export const SkeletonCard = ({ className = "h-28" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-10 w-10 rounded-xl" />
      <SkeletonBlock className="h-4 w-16" />
    </div>
    <SkeletonBlock className="mt-4 h-3 w-24" />
    <SkeletonBlock className="mt-2 h-7 w-32" />
  </div>
);

export const SkeletonList = ({ count = 6, className = "h-20" }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="mt-3 h-3 w-2/3" />
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 6, columns = 5 }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy="true" aria-label="Loading">
    <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, index) => <SkeletonBlock key={index} className="h-3" />)}
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-4 px-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, column) => <SkeletonBlock key={column} className="h-4" />)}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonPage = ({ cards = 0, rows = 6, columns = 5 }) => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading">
    {cards ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: cards }).map((_, index) => <SkeletonCard key={index} />)}</div> : null}
    <SkeletonTable rows={rows} columns={columns} />
  </div>
);

export default SkeletonBlock;
