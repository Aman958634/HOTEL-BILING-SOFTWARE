import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  updateTableStatus,
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
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
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

  const floorOptions = useMemo(
    () => [...new Set(tables.map((table) => table.floor).filter(Boolean))],
    [tables]
  );

  const sectionOptions = useMemo(
    () => [...new Set(tables.map((table) => table.section).filter(Boolean))],
    [tables]
  );

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await getTableStats();
      setStats(data.data || {});
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load table statistics"));
    } finally {
      setLoadingStats(false);
    }
  };

  const loadTables = async (appliedFilters = filters) => {
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
      setTables(data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load tables"));
      setTablesError(getErrorMessage(error, "Unable to load tables"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTables(filters);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    if (!socket) return;

    const onStatusChanged = (payload) => {
      setTables((prev) =>
        prev.map((table) =>
          table._id === payload.tableId
            ? {
                ...table,
                status: payload.status,
                ...(payload.activeOrderCount != null
                  ? { activeOrderCount: payload.activeOrderCount }
                  : {}),
                ...(payload.currentOrder !== undefined
                  ? { currentOrder: payload.currentOrder }
                  : {}),
              }
            : table
        )
      );
      loadStats();
    };

    socket.on("table:statusChanged", onStatusChanged);

    return () => {
      socket.off("table:statusChanged", onStatusChanged);
    };
  }, [socket]);

  const openCreate = () => {
    setEditingTable(null);
    setFormOpen(true);
  };

  const openEdit = async (table) => {
    setSaving(true);
    try {
      const { data } = await getTableById(table._id);
      setEditingTable(data.data);
      setFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to fetch table details for edit"));
    } finally {
      setSaving(false);
    }
  };

  const submitTable = async (payload) => {
    setSaving(true);
    try {
      if (editingTable?._id) {
        await updateTable(editingTable._id, payload);
        toast.success("Table updated successfully");
      } else {
        await createTable(payload);
        toast.success("Table created successfully");
      }

      setFormOpen(false);
      setEditingTable(null);
      await Promise.all([loadTables(), loadStats()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save table"));
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (table) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const { data } = await getTableById(table._id);
      setSelectedTable(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load table details"));
      setSelectedTable(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const requestDelete = (table) => {
    setDeleteTarget(table);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;

    setSaving(true);
    try {
      await deleteTable(deleteTarget._id);
      toast.success("Table deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
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
  };

  const changeTableStatus = async (table, status) => {
    setStatusUpdatingId(table._id);
    try {
      const { data } = await updateTableStatus(table._id, status);
      const updated = data.data;
      setTables((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setStats((prev) => {
        if (!prev) return prev;
        const previousStatus = String(table.status || "").toLowerCase();
        const nextStatus = String(updated.status || "").toLowerCase();

        const next = { ...prev };
        if (previousStatus === "available") next.available = Math.max((next.available || 0) - 1, 0);
        if (previousStatus === "occupied") next.occupied = Math.max((next.occupied || 0) - 1, 0);
        if (previousStatus === "reserved") next.reserved = Math.max((next.reserved || 0) - 1, 0);
        if (previousStatus === "maintenance") next.maintenance = Math.max((next.maintenance || 0) - 1, 0);

        if (nextStatus === "available") next.available = (next.available || 0) + 1;
        if (nextStatus === "occupied") next.occupied = (next.occupied || 0) + 1;
        if (nextStatus === "reserved") next.reserved = (next.reserved || 0) + 1;
        if (nextStatus === "maintenance") next.maintenance = (next.maintenance || 0) + 1;

        return next;
      });
      toast.success("Table status updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update table status"));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const handleTableClick = (table) => {
    // A table can always host another DINE_IN order, whether AVAILABLE or
    // OCCUPIED. Selecting it opens the Create Order flow pre-targeted at it.
    navigate("/dashboard/admin/orders", { state: { tableId: table._id, fromTable: true } });
  };

  const handleSelectTable = (table) => {
    if (!table?._id) return;
    setSelectedId(table._id);
    openDetails(table);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Table Management</h2>
          <p className="mt-1 text-sm text-slate-500">Manage restaurant tables, availability, reservations and occupancy.</p>
        </div>
      </div>

      <TableStats stats={stats} loading={loadingStats} />

      <TableToolbar
        filters={filters}
        onChange={setFilters}
        onAdd={openCreate}
        floors={floorOptions}
        sections={sectionOptions}
      />

      {tablesError ? <RequestState message={tablesError} onRetry={() => loadTables(filters)} /> : <TableGrid
        tables={tables}
        loading={loading}
        onEdit={openEdit}
        onView={openDetails}
        onDelete={requestDelete}
        onStatusChange={changeTableStatus}
        onAddFirst={openCreate}
        statusUpdatingId={statusUpdatingId}
        onTableClick={handleTableClick}
        onSelect={handleSelectTable}
        selectedId={selectedId}
      />}

      <TableForm
        open={formOpen}
        loading={saving}
        initialData={editingTable}
        onClose={() => {
          setFormOpen(false);
          setEditingTable(null);
        }}
        onSubmit={submitTable}
      />

      <TableDetails
        open={detailsOpen}
        loading={detailsLoading}
        table={selectedTable}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedTable(null);
        }}
      />

      <DeleteTableDialog
        open={deleteOpen}
        loading={saving}
        table={deleteTarget}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default TableManagement;
