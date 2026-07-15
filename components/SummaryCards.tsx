import {
  Calendar,
  Compass,
  Hotel,
  MapPin,
  UtensilsCrossed,
} from "lucide-react";
import { TABLE_META } from "@/lib/table-config";
import type { DashboardTab, TableKey, TableStats } from "@/lib/types";

type SummaryCardsProps = {
  stats: TableStats;
  activeTab: DashboardTab;
  onSelect: (table: TableKey) => void;
};

const TABLE_COLORS: Record<TableKey, string> = {
  events: "from-violet-500 to-purple-600",
  places: "from-emerald-500 to-teal-600",
  restaurants: "from-orange-500 to-red-500",
  stays: "from-blue-500 to-indigo-600",
  tours: "from-cyan-500 to-blue-600",
};

const TABLE_RING: Record<TableKey, string> = {
  events: "ring-violet-200 border-violet-300 bg-violet-50/60",
  places: "ring-emerald-200 border-emerald-300 bg-emerald-50/60",
  restaurants: "ring-orange-200 border-orange-300 bg-orange-50/60",
  stays: "ring-blue-200 border-blue-300 bg-blue-50/60",
  tours: "ring-cyan-200 border-cyan-300 bg-cyan-50/60",
};

const TABLE_ICONS: Record<TableKey, typeof Calendar> = {
  events: Calendar,
  places: MapPin,
  restaurants: UtensilsCrossed,
  stays: Hotel,
  tours: Compass,
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
          const Icon = TABLE_ICONS[table];

          return (
            <button
              key={table}
              type="button"
              onClick={() => onSelect(table)}
              className={`group relative overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isActive
                  ? `${TABLE_RING[table]} ring-2 shadow-md`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${TABLE_COLORS[table]}`}
              >
                <Icon className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {(stats[table] ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {meta.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
