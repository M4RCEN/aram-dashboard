"use client";

import {
  Calendar,
  Compass,
  Hotel,
  LayoutGrid,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import PlaceSearch from "@/components/PlaceSearch";
import RecordForm from "@/components/RecordForm";
import SummaryCards from "@/components/SummaryCards";
import TableToolbar from "@/components/TableToolbar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import FormModal from "@/components/ui/FormModal";
import LoadingSkeleton, { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import Toast from "@/components/ui/Toast";
import { computeAnalytics } from "@/lib/analytics";
import {
  getDefaultFormData,
  getRecordLabel,
  preparePayload,
  TABLE_FIELDS,
} from "@/lib/field-configs";
import {
  createRecord,
  deleteRecord,
  fetchAllTableStats,
  fetchAnalyticsData,
  fetchFilterOptions,
  fetchGooglePlaceDetails,
  fetchRecordsPaginated,
  getApiUrl,
  updateRecord,
} from "@/lib/postgrest";
import {
  ALL_TABLES,
  DEFAULT_PAGE_SIZE,
  TABLE_META,
} from "@/lib/table-config";
import type {
  DashboardTab,
  EditorMode,
  RecordItem,
  SortDirection,
  TableKey,
  TableStats,
} from "@/lib/types";

const ALL_VIEW_COLUMNS = [
  "record_type",
  "record_name",
  "status",
  "image_url",
  "created_at",
];
const ALL_VIEW_FETCH_SIZE = 500;

const TAB_ICONS: Record<TableKey, typeof Calendar> = {
  events: Calendar,
  places: MapPin,
  restaurants: UtensilsCrossed,
  stays: Hotel,
  tours: Compass,
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const EMPTY_STATS: TableStats = {
  events: 0,
  places: 0,
  restaurants: 0,
  stays: 0,
  tours: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("events");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableStats, setTableStats] = useState<TableStats>(EMPTY_STATS);
  const [analyticsRecords, setAnalyticsRecords] = useState<RecordItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    locations: string[];
    categories: string[];
  }>({ locations: [], categories: [] });

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [fetchingPlace, setFetchingPlace] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RecordItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const isAllTab = activeTab === "all";
  const meta = isAllTab ? null : TABLE_META[activeTab];
  const fields = isAllTab ? [] : TABLE_FIELDS[activeTab];
  const columns = isAllTab ? ALL_VIEW_COLUMNS : meta!.displayColumns;

  const analytics = useMemo(
    () => (isAllTab ? null : computeAnalytics(activeTab, analyticsRecords)),
    [activeTab, isAllTab, analyticsRecords]
  );

  function resolveTable(record: RecordItem): TableKey {
    const source = record._sourceTable;
    if (typeof source === "string" && (ALL_TABLES as string[]).includes(source)) {
      return source as TableKey;
    }
    return activeTab === "all" ? "events" : activeTab;
  }

  function showToast(type: ToastState["type"], message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const stats = await fetchAllTableStats();
      setTableStats(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadFilterOptions = useCallback(async (table: TableKey) => {
    try {
      const options = await fetchFilterOptions(table);
      setFilterOptions(options);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadAnalytics = useCallback(async (table: TableKey) => {
    try {
      const data = await fetchAnalyticsData(table);
      setAnalyticsRecords(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadAllRecords = useCallback(async () => {
    const perTable = await Promise.all(
      ALL_TABLES.map(async (table) => {
        const result = await fetchRecordsPaginated(table, {
          search: debouncedSearch,
          status: statusFilter || undefined,
          sortBy: "created_at",
          sortDir: "desc",
          page: 1,
          pageSize: ALL_VIEW_FETCH_SIZE,
        });

        return result.records.map((record) => ({
          ...record,
          _sourceTable: table,
          record_type: TABLE_META[table].label,
          record_name: getRecordLabel(table, record),
        }));
      })
    );

    let merged: RecordItem[];

    if (sortBy === "created_at") {
      // Interleave round-robin across tables (each table's own list is
      // already newest-first) so one table's bulk insert can't crowd
      // every other table off the first page.
      merged = [];
      const maxLength = Math.max(...perTable.map((records) => records.length));
      for (let i = 0; i < maxLength; i++) {
        for (const tableRecords of perTable) {
          if (tableRecords[i]) merged.push(tableRecords[i]);
        }
      }
      if (sortDir === "asc") merged.reverse();
    } else {
      merged = perTable.flat();
      merged.sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (av == null && bv == null) return 0;
        if (av == null) return sortDir === "asc" ? -1 : 1;
        if (bv == null) return sortDir === "asc" ? 1 : -1;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const totalCount = merged.length;
    const start = (page - 1) * pageSize;

    setRecords(merged.slice(start, start + pageSize));
    setTotal(totalCount);
    setTotalPages(Math.max(1, Math.ceil(totalCount / pageSize)));
  }, [debouncedSearch, statusFilter, sortBy, sortDir, page, pageSize]);

  const loadRecords = useCallback(async () => {
    if (!getApiUrl()) {
      setError("Failed to reach the database API. Check that PostgREST is running.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (activeTab === "all") {
        await loadAllRecords();
        return;
      }

      const result = await fetchRecordsPaginated(activeTab, {
        search: debouncedSearch,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        location: locationFilter || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      });

      setRecords(result.records);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error(err);
      setError("Failed to load records. Check that PostgREST is running.");
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    loadAllRecords,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    locationFilter,
    sortBy,
    sortDir,
    page,
    pageSize,
  ]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [
    activeTab,
    debouncedSearch,
    statusFilter,
    categoryFilter,
    locationFilter,
    pageSize,
  ]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (activeTab === "all") return;
    loadFilterOptions(activeTab);
    loadAnalytics(activeTab);
  }, [activeTab, loadFilterOptions, loadAnalytics]);

  function resetEditor() {
    setEditorMode(null);
    setFormData({});
  }

  function handleTabChange(table: DashboardTab) {
    setActiveTab(table);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setLocationFilter("");
    setSortBy("created_at");
    setSortDir("desc");
    resetEditor();
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function handleCreate() {
    if (activeTab === "all") return;
    setEditorMode("create");
    setFormData(getDefaultFormData(activeTab));
  }

  function handleEdit(record: RecordItem) {
    const table = resolveTable(record);
    if (activeTab === "all") {
      setActiveTab(table);
    }
    setEditorMode("edit");
    setFormData({ ...record });
  }

  function handleFieldChange(key: string, value: unknown) {
    const field = fields.find((f) => f.key === key);
    if (field?.type === "json") {
      try {
        if (
          typeof value === "string" &&
          (value.startsWith("{") || value.startsWith("["))
        ) {
          setFormData((prev) => ({ ...prev, [key]: JSON.parse(value) }));
          return;
        }
      } catch {
        setFormData((prev) => ({ ...prev, [key]: value }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm(): string | null {
    for (const field of fields.filter((f) => !f.autoGenerated)) {
      if (!field.required) continue;
      const value = formData[field.key];
      if (value === "" || value === undefined || value === null) {
        return `${field.label} is required.`;
      }
    }
    return null;
  }

  async function handleSave() {
    if (activeTab === "all") return;

    const validationError = validateForm();
    if (validationError) {
      showToast("error", validationError);
      return;
    }

    try {
      setSaving(true);
      const payload = preparePayload(activeTab, formData, editorMode!);

      if (editorMode === "create") {
        await createRecord(activeTab, payload);
        showToast("success", "Record created successfully.");
      } else if (editorMode === "edit" && formData.id) {
        await updateRecord(activeTab, formData.id as string | number, payload);
        showToast("success", "Record updated successfully.");
      }

      resetEditor();
      await Promise.all([loadRecords(), loadStats(), loadAnalytics(activeTab)]);
    } catch (err) {
      console.error(err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save record."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?.id) return;
    const table = resolveTable(deleteTarget);

    try {
      setDeleting(true);
      await deleteRecord(table, deleteTarget.id);
      showToast("success", "Record deleted successfully.");
      setDeleteTarget(null);
      await Promise.all([
        loadRecords(),
        loadStats(),
        ...(activeTab === "all" ? [] : [loadAnalytics(activeTab)]),
      ]);
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to delete record.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleFetchGooglePlace() {
    const placeId = formData.google_place_id;
    if (!placeId || typeof placeId !== "string") {
      showToast("error", "Enter a Google Place ID first.");
      return;
    }

    try {
      setFetchingPlace(true);
      const details = await fetchGooglePlaceDetails(placeId);

      setFormData((prev) => {
        const updated = { ...prev };

        if (activeTab === "places") {
          if (details.name) updated.title = details.name;
        } else if (details.name) {
          updated.name = details.name;
        }

        if (details.address) updated.address = details.address;
        if (details.latitude != null) updated.latitude = details.latitude;
        if (details.longitude != null) updated.longitude = details.longitude;
        if (details.rating != null) updated.rating = details.rating;
        if (details.image_url) updated.image_url = details.image_url;
        if (details.website) updated.website = details.website;

        if (activeTab === "restaurants" && details.menu_images.length) {
          updated.menu_images = details.menu_images;
        }

        return updated;
      });

      showToast("success", "Place details loaded from Google.");
    } catch (err) {
      console.error(err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to fetch place details."
      );
    } finally {
      setFetchingPlace(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([
      loadRecords(),
      loadStats(),
      ...(activeTab === "all"
        ? []
        : [loadFilterOptions(activeTab), loadAnalytics(activeTab)]),
    ]);
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const supportsGooglePlaces =
    activeTab === "restaurants" || activeTab === "places";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 p-4 text-slate-900 sm:p-6 lg:p-8">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Record"
        variant="danger"
        confirmLabel="Delete"
        loading={deleting}
        message={
          <>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-slate-900">
              &ldquo;
              {deleteTarget
                ? getRecordLabel(resolveTable(deleteTarget), deleteTarget)
                : ""}
              &rdquo;
            </span>{" "}
            from {deleteTarget ? TABLE_META[resolveTable(deleteTarget)].label : ""}?
            This action cannot be undone.
          </>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <FormModal
        open={!!editorMode}
        title={editorMode === "create" ? "New Record" : "Edit Record"}
        description={
          editorMode === "create"
            ? `Add a new record to ${meta?.label ?? "this table"}.`
            : `Update this ${(meta?.label ?? "record").toLowerCase()} record.`
        }
        onClose={() => !saving && resetEditor()}
      >
        <RecordForm
          fields={fields}
          formData={formData}
          mode={editorMode!}
          saving={saving}
          onFieldChange={handleFieldChange}
          onSave={handleSave}
          onCancel={resetEditor}
          onFetchGooglePlace={
            supportsGooglePlaces ? handleFetchGooglePlace : undefined
          }
          fetchingPlace={fetchingPlace}
        />
      </FormModal>

      <section className="mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 20%, rgba(59,130,246,0.5), transparent 40%), radial-gradient(circle at 85% 80%, rgba(124,58,237,0.4), transparent 45%)",
            }}
          />

          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Admin
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                ARAM&rsquo;s Data Dashboard
              </h1>
              <p className="mt-2 max-w-md text-sm text-slate-300">
                Manage events, places, restaurants, stays, and tours in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              {loggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>

        {statsLoading ? (
          <CardSkeleton count={5} />
        ) : (
          <SummaryCards
            stats={tableStats}
            activeTab={activeTab}
            onSelect={handleTabChange}
          />
        )}

        {!isAllTab && meta && analytics && (
          <AnalyticsCharts
            data={analytics}
            tableLabel={meta.label}
            hasLocation={!!meta.locationField}
            hasCategory={!!meta.categoryField}
          />
        )}

        <div className="sticky top-4 z-20 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === "all"
                  ? "bg-blue-700 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={2} />
              All
            </button>

            {(Object.keys(TABLE_META) as TableKey[]).map((tab) => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-blue-700 text-white shadow-md"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {TABLE_META[tab].label}
                </button>
              );
            })}
          </div>
        </div>

        {!isAllTab && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <PlaceSearch
              table={activeTab}
              onImported={handleRefresh}
              onError={(message) => showToast("error", message)}
              onSuccess={(message) => showToast("success", message)}
            />
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            {isAllTab ? (
              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="text-2xl font-bold">All Records</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Every record across all tables, newest first.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={2} />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search records..."
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            ) : (
              <TableToolbar
                table={activeTab}
                search={search}
                statusFilter={statusFilter}
                categoryFilter={categoryFilter}
                locationFilter={locationFilter}
                pageSize={pageSize}
                locations={filterOptions.locations}
                categories={filterOptions.categories}
                onSearchChange={setSearch}
                onStatusChange={setStatusFilter}
                onCategoryChange={setCategoryFilter}
                onLocationChange={setLocationFilter}
                onPageSizeChange={setPageSize}
                onRefresh={handleRefresh}
                onCreate={handleCreate}
              />
            )}
          </div>

          <div className="p-6">
            {loading ? (
              <LoadingSkeleton rows={8} columns={columns.length + 1} />
            ) : error ? (
              <ErrorState message={error} onRetry={handleRefresh} />
            ) : records.length === 0 ? (
              <EmptyState
                message={
                  debouncedSearch ||
                  statusFilter ||
                  categoryFilter ||
                  locationFilter
                    ? "No records match your current filters. Try adjusting your search or filters."
                    : "Get started by creating your first record."
                }
                actionLabel={
                  isAllTab ||
                  debouncedSearch ||
                  statusFilter ||
                  categoryFilter ||
                  locationFilter
                    ? undefined
                    : "+ Add New Record"
                }
                onAction={
                  isAllTab ||
                  debouncedSearch ||
                  statusFilter ||
                  categoryFilter ||
                  locationFilter
                    ? undefined
                    : handleCreate
                }
              />
            ) : (
              <>
                <DataTable
                  columns={columns}
                  records={records}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                />

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
