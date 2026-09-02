import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import toast from "react-hot-toast";
import { useSocket } from "../../context/SocketContext";
import DeleteTableDialog from "../../components/admin/tables/DeleteTableDialog";
import TableDetails from "../../components/admin/tables/TableDetails";
import TableForm from "../../components/admin/tables/TableForm";
import TableGrid from "../../components/admin/tables/TableGrid";
import TableStats from "../../components/admin/tables/TableStats";
import TableToolbar from "../../components/admin/tables/TableToolbar";
import RequestState from "../../components/common/RequestState";
import {
  createTable,
  deleteTable,
  getTableById,
  getTables,
  getTableStats,
  updateTable,
} from "../../services/tableService";

const defaultFilters = {
  search: "",
  floor: "",
  section: "",
  status: "",
  capacity: "",
  sortBy: "tableNumber",
  order: "asc",
};

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 401) return "Your session expired. Please login again.";
  if (status === 403) return "You do not have permission to manage tables.";
  if (status === 404) return "Requested table record was not found.";
  if (status === 409) return message || "Table number already exists.";
  if (status === 422) return message || "Please review entered table details.";
  if (status === 500) return "Server error occurred while processing table request.";

  return message || fallback;
};

const TableManagement = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tablesError, setTablesError] = useState("");
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const socket = useSocket();
  const filtersRef = useRef(filters);
  const detailsRequestRef = useRef(0);
  const tableRequestRef = useRef(0);
  const statsRefreshTimerRef = useRef(null);

  filtersRef.current = filters;

  const floorOptions = useMemo(
    () => [...new Set(tables.map((table) => table.floor).filter(Boolean))],
    [tables]
  );

  const sectionOptions = useMemo(
    () => [...new Set(tables.map((table) => table.section).filter(Boolean))],
    [tables]
  );

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await getTableStats();
      setStats(data.data || {});
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load table statistics"));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadTables = useCallback(async (appliedFilters = filtersRef.current) => {
    const requestId = tableRequestRef.current + 1;
    tableRequestRef.current = requestId;
    setLoading(true);
    setTablesError("");
    try {
      const params = {
        limit: 100,
        search: appliedFilters.search || undefined,
        floor: appliedFilters.floor || undefined,
        section: appliedFilters.section || undefined,
        status: appliedFilters.status || undefined,
        capacity: appliedFilters.capacity || undefined,
        sortBy: appliedFilters.sortBy,
        order: appliedFilters.order,
      };

      const { data } = await getTables(params);
      if (tableRequestRef.current === requestId) setTables(data.data || []);
    } catch (error) {
      if (tableRequestRef.current === requestId) {
        toast.error(getErrorMessage(error, "Unable to load tables"));
        setTablesError(getErrorMessage(error, "Unable to load tables"));
      }
    } finally {
      if (tableRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTables(filters);
  }, [filters, loadTables]);

  const scheduleStatsRefresh = useCallback(() => {
    window.clearTimeout(statsRefreshTimerRef.current);
    statsRefreshTimerRef.current = window.setTimeout(loadStats, 250);
  }, [loadStats]);

  useEffect(() => () => window.clearTimeout(statsRefreshTimerRef.current), []);

  const onStatusChanged = useCallback((payload) => {
    setTables((prev) => {
      const tableIndex = prev.findIndex((table) => table._id === payload.tableId);
      if (tableIndex === -1) return prev;

      const current = prev[tableIndex];
      const next = {
        ...current,
        status: payload.status,
        ...(payload.activeOrderCount != null
          ? { activeOrderCount: payload.activeOrderCount }
          : {}),
        ...(payload.currentOrder !== undefined
          ? { currentOrder: payload.currentOrder }
          : {}),
      };

      if (
        current.status === next.status &&
        current.activeOrderCount === next.activeOrderCount &&
        current.currentOrder === next.currentOrder
      ) {
        return prev;
      }

      const updated = [...prev];
      updated[tableIndex] = next;
      return updated;
    });
    scheduleStatsRefresh();
  }, [scheduleStatsRefresh]);

  useEffect(() => {
    if (!socket) return;

    socket.on("table:statusChanged", onStatusChanged);

    return () => {
      socket.off("table:statusChanged", onStatusChanged);
    };
  }, [socket, onStatusChanged]);

  const openCreate = useCallback(() => {
    setEditingTable(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingTable(null);
  }, []);

  const openEdit = useCallback((table) => {
    // The list response contains all editable fields. Opening from this data
    // keeps the click-to-modal path free of a network round trip.
    setEditingTable(table);
    setFormOpen(true);
  }, []);

  const submitTable = useCallback(async (payload) => {
    setSaving(true);
    try {
      if (editingTable?._id) {
        await updateTable(editingTable._id, payload);
        toast.success("Table updated successfully");
      } else {
        await createTable(payload);
        toast.success("Table created successfully");
      }

      closeForm();
      await Promise.all([loadTables(), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save table"));
    } finally {
      setSaving(false);
    }
  }, [closeForm, editingTable?._id, loadStats, loadTables]);

  const closeDetails = useCallback(() => {
    detailsRequestRef.current += 1;
    setDetailsOpen(false);
    setSelectedTable(null);
  }, []);

  const openDetails = useCallback(async (table) => {
    const requestId = detailsRequestRef.current + 1;
    detailsRequestRef.current = requestId;
    // Render known table data first. The detail request enriches the modal
    // after its initial paint rather than delaying the user's click.
    setSelectedTable(table);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const { data } = await getTableById(table._id);
      if (detailsRequestRef.current === requestId) setSelectedTable(data.data);
    } catch (error) {
      if (detailsRequestRef.current === requestId) {
        toast.error(getErrorMessage(error, "Unable to load table details"));
      }
    } finally {
      if (detailsRequestRef.current === requestId) setDetailsLoading(false);
    }
  }, []);

  const requestDelete = useCallback((table) => {
    setDeleteTarget(table);
    setDeleteOpen(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteOpen(false);
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?._id) return;

    setSaving(true);
    try {
      await deleteTable(deleteTarget._id);
      toast.success("Table deleted successfully");
      cancelDelete();
      await Promise.all([loadTables(), loadStats()]);
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      if (backendMessage?.includes("active order or reservation")) {
        toast.error("This table cannot be deleted because it has an active order or reservation.");
      } else {
        toast.error(getErrorMessage(error, "Unable to delete table"));
      }
    } finally {
      setSaving(false);
    }
  }, [cancelDelete, deleteTarget?._id, loadStats, loadTables]);

  const handleTableClick = useCallback((table) => {
    // A table can always host another DINE_IN order, whether AVAILABLE or
    // OCCUPIED. Selecting it opens the Create Order flow pre-targeted at it.
    navigate("/dashboard/admin/orders", { state: { tableId: table._id, fromTable: true } });
  }, [navigate]);

  const handleSelectTable = useCallback((table) => {
    if (!table?._id) return;
    setSelectedId(table._id);
    openDetails(table);
  }, [openDetails]);

  const retryTables = useCallback(() => loadTables(), [loadTables]);
  const clearFilters = useCallback(() => setFilters(defaultFilters), []);

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Tables</h2>
          <p className="mt-1 text-sm text-slate-500">Scan availability, occupied tables and their active order context.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto"><FiPlus className="h-4 w-4" aria-hidden="true" />Add Table</button>
      </div>

      <TableStats stats={stats} loading={loadingStats} />

      <TableToolbar
        filters={filters}
        onChange={setFilters}
        floors={floorOptions}
        sections={sectionOptions}
      />

      {tablesError ? <RequestState message={tablesError} onRetry={retryTables} /> : <TableGrid
        tables={tables}
        loading={loading}
        onEdit={openEdit}
        onDelete={requestDelete}
        onAddFirst={openCreate}
        hasFilters={Boolean(filters.search || filters.floor || filters.section || filters.status || filters.capacity)}
        onClearFilters={clearFilters}
        onTableClick={handleTableClick}
        onSelect={handleSelectTable}
        selectedId={selectedId}
      />}

      <TableForm
        open={formOpen}
        loading={saving}
        initialData={editingTable}
        onClose={closeForm}
        onSubmit={submitTable}
      />

      <TableDetails
        open={detailsOpen}
        loading={detailsLoading}
        table={selectedTable}
        onClose={closeDetails}
      />

      <DeleteTableDialog
        open={deleteOpen}
        loading={saving}
        table={deleteTarget}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default TableManagement;
