"use client";

import type { RecordItem } from "@/lib/types";
import type { SortDirection } from "@/lib/types";
import { displayValue, formatLabel } from "@/lib/table-config";

type DataTableProps = {
  columns: string[];
  records: RecordItem[];
  sortBy: string;
  sortDir: SortDirection;
  onSort: (column: string) => void;
  onEdit: (record: RecordItem) => void;
  onDelete: (record: RecordItem) => void;
};

function SortIcon({
  column,
  sortBy,
  sortDir,
}: {
  column: string;
  sortBy: string;
  sortDir: SortDirection;
}) {
  if (sortBy !== column) {
    return (
      <span className="ml-1 text-slate-300">↕</span>
    );
  }
  return (
    <span className="ml-1 text-blue-600">
      {sortDir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function CellContent({ column, value }: { column: string; value: unknown }) {
  if (column === "image_url" && value && typeof value === "string") {
    return (
      <div className="flex items-center gap-2">
        <img
          src={value}
          alt=""
          className="h-8 w-8 rounded-lg object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="truncate text-xs text-slate-500">{value}</span>
      </div>
    );
  }

  if (column === "status") {
    const status = String(value ?? "");
    const colors: Record<string, string> = {
      published: "bg-green-100 text-green-800",
      draft: "bg-amber-100 text-amber-800",
    };
    return (
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
          colors[status] ?? "bg-slate-100 text-slate-700"
        }`}
      >
        {status || "-"}
      </span>
    );
  }

  return <span>{displayValue(value)}</span>;
}

export default function DataTable({
  columns,
  records,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => onSort(column)}
                  className="cursor-pointer whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-bold capitalize text-slate-700 hover:bg-slate-200/60"
                >
                  {formatLabel(column)}
                  <SortIcon
                    column={column}
                    sortBy={sortBy}
                    sortDir={sortDir}
                  />
                </th>
              ))}

              <th className="sticky right-0 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-bold text-slate-700">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {records.map((record, index) => (
              <tr
                key={String(record.id ?? index)}
                className="border-b border-slate-100 hover:bg-blue-50/50"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className="max-w-[260px] truncate px-4 py-3 text-slate-700"
                    title={displayValue(record[column])}
                  >
                    <CellContent column={column} value={record[column]} />
                  </td>
                ))}

                <td className="sticky right-0 bg-white px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => onDelete(record)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
