import {
  PAGE_SIZE_OPTIONS,
  TABLE_META,
} from "@/lib/table-config";
import type { TableKey } from "@/lib/types";

type TableToolbarProps = {
  table: TableKey;
  search: string;
  statusFilter: string;
  categoryFilter: string;
  locationFilter: string;
  pageSize: number;
  locations: string[];
  categories: string[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onRefresh: () => void;
  onCreate: () => void;
};

export default function TableToolbar({
  table,
  search,
  statusFilter,
  categoryFilter,
  locationFilter,
  pageSize,
  locations,
  categories,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onLocationChange,
  onPageSizeChange,
  onRefresh,
  onCreate,
}: TableToolbarProps) {
  const meta = TABLE_META[table];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">{meta.label}</h2>
          <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter records..."
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 lg:col-span-2"
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>

        {meta.categoryField && (
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-600"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        {meta.locationField && (
          <select
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-600"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
