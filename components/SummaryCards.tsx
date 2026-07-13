import { TABLE_META } from "@/lib/table-config";
import type { TableKey, TableStats } from "@/lib/types";

type SummaryCardsProps = {
  stats: TableStats;
  activeTab: TableKey;
  onSelect: (table: TableKey) => void;
};

const TABLE_COLORS: Record<TableKey, string> = {
  events: "from-violet-500 to-purple-600",
  places: "from-emerald-500 to-teal-600",
  restaurants: "from-orange-500 to-red-500",
  stays: "from-blue-500 to-indigo-600",
  tours: "from-cyan-500 to-blue-600",
};

export default function SummaryCards({
  stats,
  activeTab,
  onSelect,
}: SummaryCardsProps) {
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Overview</h2>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
          {total.toLocaleString()} total records
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(TABLE_META) as TableKey[]).map((table) => {
          const meta = TABLE_META[table];
          const isActive = activeTab === table;

          return (
            <button
              key={table}
              type="button"
              onClick={() => onSelect(table)}
              className={`rounded-2xl border p-5 text-left transition ${
                isActive
                  ? "border-blue-300 bg-blue-50 shadow-md ring-2 ring-blue-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`mb-3 inline-flex rounded-lg bg-gradient-to-br px-2.5 py-1 text-xs font-bold text-white ${TABLE_COLORS[table]}`}
              >
                {meta.label}
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {(stats[table] ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">records</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
