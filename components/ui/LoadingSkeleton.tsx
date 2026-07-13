type LoadingSkeletonProps = {
  rows?: number;
  columns?: number;
};

export default function LoadingSkeleton({
  rows = 8,
  columns = 6,
}: LoadingSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-4 flex-1 animate-pulse rounded bg-slate-200"
            />
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4 p-4">
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={col}
                className="h-4 flex-1 animate-pulse rounded bg-slate-100"
                style={{ animationDelay: `${(row + col) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="h-3 w-16 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-12 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
