import type { AnalyticsData } from "@/lib/types";

type AnalyticsChartsProps = {
  data: AnalyticsData;
  tableLabel: string;
  hasLocation: boolean;
  hasCategory: boolean;
};

function BarChart({
  title,
  items,
  color = "#3b82f6",
}: {
  title: string;
  items: { label: string; value: number; color?: string }[];
  color?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        <p className="mt-4 text-sm text-slate-400">No data available</p>
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="text-sm font-bold text-slate-700">{title}</h4>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="truncate font-medium capitalize text-slate-600">
                {item.label}
              </span>
              <span className="ml-2 font-bold text-slate-800">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color ?? color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        <p className="mt-4 text-sm text-slate-400">No data available</p>
      </div>
    );
  }

  let offset = 0;
  const segments = items.map((item) => {
    const pct = (item.value / total) * 100;
    const segment = { ...item, pct, offset };
    offset += pct;
    return segment;
  });

  const gradient = segments
    .map(
      (seg) =>
        `${seg.color} ${seg.offset}% ${seg.offset + seg.pct}%`
    )
    .join(", ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="text-sm font-bold text-slate-700">{title}</h4>

      <div className="mt-4 flex items-center gap-6">
        <div
          className="h-28 w-28 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="capitalize text-slate-600">{item.label}</span>
              <span className="font-bold text-slate-800">
                {item.value} ({Math.round((item.value / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsCharts({
  data,
  tableLabel,
  hasLocation,
  hasCategory,
}: AnalyticsChartsProps) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-slate-800">
        {tableLabel} Analytics
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DonutChart title="Status Breakdown" items={data.statusBreakdown} />

        {hasLocation && (
          <BarChart
            title="By Location"
            items={data.locationBreakdown}
            color="#10b981"
          />
        )}

        {hasCategory && (
          <BarChart
            title="By Category"
            items={data.categoryBreakdown}
            color="#8b5cf6"
          />
        )}
      </div>
    </div>
  );
}
