import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiUsers } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeletons";
import RequestState from "../../components/common/RequestState";
import { useSelector } from "react-redux";
import { useSocket } from "../../context/SocketContext";
import StatCard from "../../components/admin/StatCard";
import StaffStats from "../../components/admin/staff/StaffStats";
import StaffCommandCenter from "../../components/admin/staff/StaffCommandCenter";
import StaffToolbar from "../../components/admin/staff/StaffToolbar";
import StaffTable from "../../components/admin/staff/StaffTable";
import StaffCard from "../../components/admin/staff/StaffCard";
import StaffForm from "../../components/admin/staff/StaffForm";
import StaffDetailsDrawer from "../../components/admin/staff/StaffDetailsDrawer";
import DeleteStaffDialog from "../../components/admin/staff/DeleteStaffDialog";
import { getActiveStaff, getStaff, getStaffById, getStaffStats, createStaff, updateStaff, updateStaffStatus, deleteStaff } from "../../services/staffService";

const defaultFilters = { search: "", role: "", status: "", department: "", page: 1, limit: 20 };

const formatJoinDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
};

const StaffManagement = () => {
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const socket = useSocket();
  const currentUser = useSelector((state) => state.auth.user);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await getStaffStats();
      setStats(data.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load staff stats");
    } finally {
      setLoadingStats(false);
    }
  };

  const loadStaff = async (nextFilters = filters) => {
    setLoadingStaff(true);
    setStaffError("");
    try {
      const params = {
        search: nextFilters.search || undefined,
        role: nextFilters.role || undefined,
        status: nextFilters.status || undefined,
        department: nextFilters.department || undefined,
        page: nextFilters.page,
        limit: nextFilters.limit,
      };

      const { data } = await getStaff(params);
      const mapped = (data.data || []).map((item) => ({
        ...item,
        fullName: item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim(),
        joiningDateLabel: formatJoinDate(item.joiningDate),
        currentShift: item.shift?.name || item.currentShift || "Not available",
      }));

      setStaff(mapped);
      setPagination(data.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load staff");
      setStaff([]);
      setStaffError(error?.response?.data?.message || "Unable to load staff");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadStaff(defaultFilters);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => loadStaff(filters), 250);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      loadStaff(filtersRef.current);
      loadStats();
      getActiveStaff().catch(() => {});
    };

    socket.on("staff:created", refresh);
    socket.on("staff:updated", refresh);
    socket.on("staff:statusChanged", refresh);

    return () => {
      socket.off("staff:created", refresh);
      socket.off("staff:updated", refresh);
      socket.off("staff:statusChanged", refresh);
    };
  }, [socket]);

  const updateFilters = (nextFilters) => {
    setFilters((prev) => ({ ...prev, ...nextFilters }));
  };

  const openCreate = () => {
    setEditingStaff(null);
    setFormOpen(true);
  };

  const openEdit = async (item) => {
    setSaving(true);
    try {
      const { data } = await getStaffById(item._id);
      setEditingStaff(data.data);
      setFormOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load staff profile");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (item) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const { data } = await getStaffById(item._id);
      setSelectedStaff(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load staff profile");
      setSelectedStaff(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitForm = async (payload) => {
    setSaving(true);
    try {
      if (editingStaff?._id) {
        await updateStaff(editingStaff._id, payload);
        toast.success("Staff member updated successfully.");
      } else {
        await createStaff(payload);
        toast.success("Staff member created successfully.");
      }
      setFormOpen(false);
      setEditingStaff(null);
      await Promise.all([loadStaff(filtersRef.current), loadStats()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save staff member");
    } finally {
      setSaving(false);
    }
  };

  const submitStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = String(statusTarget.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setSaving(true);
    try {
      await updateStaffStatus(statusTarget._id, nextStatus);
      toast.success("Staff status updated successfully.");
      setStatusTarget(null);
      await Promise.all([loadStaff(filtersRef.current), loadStats()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update staff status");
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      await deleteStaff(deleteTarget._id);
      toast.success("Staff member deleted successfully.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await Promise.all([loadStaff(filtersRef.current), loadStats()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "This staff member cannot be permanently deleted.");
    } finally {
      setSaving(false);
    }
  };

  const cards = useMemo(() => [
    { key: "totalStaff", label: "Total Staff", value: stats?.totalStaff || 0 },
    { key: "activeStaff", label: "Active Staff", value: stats?.activeStaff || 0 },
    { key: "inactiveStaff", label: "Inactive Staff", value: stats?.inactiveStaff || 0 },
    { key: "chefs", label: "Chefs", value: stats?.chefs || 0 },
    { key: "waiters", label: "Waiters", value: stats?.waiters || 0 },
    { key: "deliveryStaff", label: "Delivery Staff", value: stats?.deliveryStaff || 0 },
  ], [stats]);

  const canDelete = currentUser?.role === "admin";
  const emptyTitle = filters.search ? "No staff members match your search" : "No staff members yet";
  const emptyDescription = filters.search
    ? "Try clearing the search filters to view your restaurant staff."
    : "Add chefs, waiters, managers and delivery staff to manage your restaurant.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Staff Command Center</h2>
          <p className="mt-1 text-sm text-slate-500">Manage staff records while monitoring live shifts, assignments and operational workload.</p>
        </div>
      </div>

      <StaffStats stats={stats} loading={loadingStats} />

      <StaffCommandCenter />

      <StaffToolbar filters={filters} onChange={updateFilters} onCreate={openCreate} />

      {staff.length ? (
        <>
          <StaffTable
            staff={staff}
            loading={loadingStaff}
            onView={openDetails}
            onEdit={openEdit}
            onStatus={setStatusTarget}
            onDelete={(item) => { setDeleteTarget(item); setDeleteOpen(true); }}
            canDelete={canDelete}
          />

          <div className="grid gap-4 md:hidden">
            {staff.map((item) => (
              <StaffCard
                key={item._id}
                staff={item}
                onView={openDetails}
                onEdit={openEdit}
                onStatus={setStatusTarget}
                onDelete={(record) => { setDeleteTarget(record); setDeleteOpen(true); }}
                canDelete={canDelete}
              />
            ))}
          </div>
        </>
      ) : loadingStaff ? (
        <SkeletonList count={6} className="h-20" />
      ) : staffError ? (
        <RequestState message={staffError} onRetry={() => loadStaff(filtersRef.current)} />
      ) : (
        <EmptyState
          icon={<FiUsers className="h-10 w-10" />}
          title={emptyTitle}
          description={emptyDescription}
          action={!filters.search ? <button onClick={openCreate} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white">+ Add Staff</button> : null}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
        <p>
          Showing {(pagination.page - 1) * pagination.limit + (staff.length ? 1 : 0)}-{(pagination.page - 1) * pagination.limit + staff.length} of {pagination.total} staff members
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => updateFilters({ page: pagination.page - 1 })} disabled={pagination.page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Previous</button>
          {Array.from({ length: Math.min(pagination.totalPages || 1, 5) }).map((_, idx) => {
            const page = idx + 1;
            return <button key={page} onClick={() => updateFilters({ page })} className={`rounded border px-2 py-1 ${pagination.page === page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300"}`}>{page}</button>;
          })}
          <button onClick={() => updateFilters({ page: pagination.page + 1 })} disabled={pagination.page >= (pagination.totalPages || 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Next</button>
        </div>
      </div>

      <StaffForm
        open={formOpen}
        loading={saving}
        initialData={editingStaff}
        onClose={() => {
          setFormOpen(false);
          setEditingStaff(null);
        }}
        onSubmit={submitForm}
      />

      <StaffDetailsDrawer
        open={detailsOpen}
        loading={detailsLoading}
        staff={selectedStaff}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedStaff(null);
        }}
      />

      <DeleteStaffDialog
        open={deleteOpen}
        loading={saving}
        staff={deleteTarget}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={submitDelete}
      />

      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Update Staff Status</h3>
            <p className="mt-1 text-sm text-slate-500">{statusTarget.fullName}</p>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to {String(statusTarget.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "deactivate" : "reactivate"} this staff member?</p>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setStatusTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitStatus} disabled={saving} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-70">{saving ? "Saving..." : String(statusTarget.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "Deactivate" : "Reactivate"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
