import { TABLE_META } from "./table-config";
import type { AnalyticsData, RecordItem, TableKey } from "./types";

export function computeAnalytics(
  table: TableKey,
  records: RecordItem[]
): AnalyticsData {
  const meta = TABLE_META[table];
  const statusCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const record of records) {
    const status = String(record.status ?? "unknown");
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    if (meta.locationField) {
      const loc = String(record[meta.locationField] || "Unknown");
      locationCounts[loc] = (locationCounts[loc] ?? 0) + 1;
    }

    if (meta.categoryField) {
      const cat = String(record[meta.categoryField] || "Unknown");
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
  }

  const statusColors: Record<string, string> = {
    published: "#16a34a",
    draft: "#d97706",
  };

  return {
    statusBreakdown: Object.entries(statusCounts).map(([label, value]) => ({
      label,
      value,
      color: statusColors[label] ?? "#64748b",
    })),
    locationBreakdown: Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
    categoryBreakdown: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
  };
}
