"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
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
  DEFAULT_PAGE_SIZE,
  TABLE_META,
} from "@/lib/table-config";
import type {
  EditorMode,
  RecordItem,
  SortDirection,
  TableKey,
  TableStats,
} from "@/lib/types";

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
  const [activeTab, setActiveTab] = useState<TableKey>("events");
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

  const meta = TABLE_META[activeTab];
  const fields = TABLE_FIELDS[activeTab];
  const columns = meta.displayColumns;

  const analytics = useMemo(
    () => computeAnalytics(activeTab, analyticsRecords),
    [activeTab, analyticsRecords]
  );

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

  const loadRecords = useCallback(async () => {
    if (!getApiUrl()) {
      setError("Missing NEXT_PUBLIC_POSTGREST_URL in .env.local");
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
    loadFilterOptions(activeTab);
    loadAnalytics(activeTab);
  }, [activeTab, loadFilterOptions, loadAnalytics]);

  function resetEditor() {
    setEditorMode(null);
    setFormData({});
  }

  function handleTabChange(table: TableKey) {
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
    setEditorMode("create");
    setFormData(getDefaultFormData(activeTab));
  }

  function handleEdit(record: RecordItem) {
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

    try {
      setDeleting(true);
      await deleteRecord(activeTab, deleteTarget.id);
      showToast("success", "Record deleted successfully.");
      setDeleteTarget(null);
      await Promise.all([loadRecords(), loadStats(), loadAnalytics(activeTab)]);
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
      loadFilterOptions(activeTab),
      loadAnalytics(activeTab),
    ]);
  }

  const supportsGooglePlaces =
    activeTab === "restaurants" || activeTab === "places";

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
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
              {deleteTarget ? getRecordLabel(activeTab, deleteTarget) : ""}
              &rdquo;
            </span>{" "}
            from {meta.label}? This action cannot be undone.
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
            ? `Add a new record to ${meta.label}.`
            : `Update this ${meta.label.toLowerCase()} record.`
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
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                PostgREST Admin Dashboard
              </p>
              <h1 className="text-3xl font-bold md:text-4xl">
                ARAM Database Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Manage travel content with search, filters, analytics, image
                uploads, and Google Places integration.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-6 py-5 backdrop-blur">
              <p className="text-sm text-slate-300">Active Table</p>
              <p className="mt-1 text-2xl font-bold">{meta.label}</p>
              <p className="mt-1 text-sm text-slate-300">
                {total.toLocaleString()} matching records
              </p>
            </div>
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

        <AnalyticsCharts
          data={analytics}
          tableLabel={meta.label}
          hasLocation={!!meta.locationField}
          hasCategory={!!meta.categoryField}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TABLE_META) as TableKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-blue-700 text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {TABLE_META[tab].label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
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
                  debouncedSearch ||
                  statusFilter ||
                  categoryFilter ||
                  locationFilter
                    ? undefined
                    : "+ Add New Record"
                }
                onAction={
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
