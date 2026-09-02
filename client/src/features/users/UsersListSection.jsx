import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Users as UsersIcon, CheckCircle2, Loader2, Trash2, Ban, CheckCircle, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from './usersApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 10;

const formatDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

/**
 * Reusable users listing used by Department Heads / Invigilators / etc.
 * - Client-side search
 * - Shows "Registered" indicator when at least one user exists for the role
 */
export const UsersListSection = ({ role, emptyTitle, emptyDescription }) => {
  const [q, setQ] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user: me } = useAuth();

  const query = useQuery({
    queryKey: ['users', { role }],
    queryFn: () => usersApi.list({ role }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const deptsQuery = useQuery({
    queryKey: ['departments', 'names'],
    queryFn: () => departmentsApi.listNames(),
    staleTime: 5 * 60_000,
    enabled: role === 'DEPARTMENT_HEAD',
  });

  const removeMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['users'] });
      const previous = qc.getQueriesData({ queryKey: ['users'] });
      qc.setQueriesData({ queryKey: ['users'] }, (prev) =>
        Array.isArray(prev) ? prev.filter((u) => u.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to delete user.');
    },
    onSuccess: () => {
      toast.success('User deleted.');
      qc.invalidateQueries({ queryKey: ['invigilations'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => usersApi.setStatus(id, { status }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'ACTIVE' ? 'User enabled.' : 'User restricted.');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update user status.'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }) => {
      const results = await Promise.allSettled(ids.map((id) => usersApi.setStatus(id, { status })));
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (failed > 0) throw new Error(`${failed} operation(s) failed.`);
      return succeeded;
    },
    onSuccess: (count, { status }) => {
      toast.success(`${count} user(s) ${status === 'ACTIVE' ? 'enabled' : 'suspended'}.`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.message || 'Bulk operation failed.'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => usersApi.remove(id)));
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (failed > 0) throw new Error(`${failed} deletion(s) failed.`);
      return succeeded;
    },
    onSuccess: (count) => {
      toast.success(`${count} user(s) deleted.`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err) => toast.error(err.message || 'Bulk deletion failed.'),
  });

  const users = query.data || [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (deptFilter) {
        const userDept = u.departmentName || u.department?.name || '';
        if (userDept !== deptFilter) return false;
      }
      if (!s) return true;
      return [u.fullName, u.email, u.staffId, u.phone, u.departmentName, u.department?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [users, q, deptFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const allIds = paginatedFiltered.map((u) => u.id);
      const allSelected = allIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const renderRow = (u, isSub) => (
    <tr key={u.id} className={`hover:bg-surface-subtle/50 ${isSub ? 'bg-surface-subtle/30' : ''}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          className="rounded border-surface-border text-primary-600 focus:ring-primary-500"
          checked={selected.has(u.id)}
          onChange={() => toggleSelect(u.id)}
          disabled={u.id === me?.id}
        />
      </td>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-3 ${isSub ? 'pl-6' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold shrink-0">
            {(u.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-ink-900 ${isSub ? 'font-medium' : 'font-medium'}`}>{u.fullName}</span>
            {isSub && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                Sub-Head
              </span>
            )}
            {isSub && u.createdBy && (
              <span className="text-[11px] text-ink-400">
                added by {u.createdBy.fullName}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-700">{u.email}</td>
      <td className="px-4 py-3 text-ink-700">{u.staffId || '—'}</td>
      <td className="px-4 py-3 text-ink-700">{u.departmentName || u.department?.name || '—'}</td>
      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
      <td className="px-4 py-3 text-ink-500">{formatDate(u.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {u.status === 'ACTIVE' ? (
            <button
              type="button"
              disabled={u.id === me?.id || statusMutation.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Restrict this user?',
                  description: `${u.fullName} will be suspended and unable to sign in until re-enabled.`,
                  confirmText: 'Suspend',
                  tone: 'warning',
                });
                if (ok) statusMutation.mutate({ id: u.id, status: 'SUSPENDED' });
              }}
              className="btn btn-sm text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50"
              title="Suspend"
            >
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Suspend</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={u.id === me?.id || statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
              className="btn btn-sm text-emerald-700 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
              title="Enable"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Enable</span>
            </button>
          )}
          <button
            type="button"
            disabled={u.id === me?.id}
            onClick={() => {
              confirm({
                title: 'Delete this user?',
                description: `${u.fullName} (${u.email}) will be permanently removed. This cannot be undone.`,
                confirmText: 'Delete',
                tone: 'danger',
                onConfirm: () => removeMutation.mutate(u.id),
              });
            }}
            className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, email, staff ID..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        {role === 'DEPARTMENT_HEAD' && deptsQuery.data && (
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select
              className="input pl-9 pr-8 appearance-none cursor-pointer"
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Departments</option>
              {deptsQuery.data.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="neutral">
            Total: {users.length}
          </Badge>
          {users.length > 0 && (
            <Badge variant="success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Registered
            </Badge>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="panel p-3 flex items-center gap-3 flex-wrap bg-primary-50/50 border-primary-200">
          <span className="text-sm font-medium text-primary-800">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              className="btn btn-sm text-emerald-700 border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
              disabled={bulkStatusMutation.isPending || bulkDeleteMutation.isPending}
              onClick={() => bulkStatusMutation.mutate({ ids: [...selected], status: 'ACTIVE' })}
            >
              <CheckCircle className="w-4 h-4" /> Enable Selected
            </button>
            <button
              className="btn btn-sm text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50"
              disabled={bulkStatusMutation.isPending || bulkDeleteMutation.isPending}
              onClick={() => {
                confirm({
                  title: 'Suspend selected users?',
                  description: `${selected.size} user(s) will be suspended and unable to sign in.`,
                  confirmText: 'Suspend All',
                  tone: 'warning',
                  onConfirm: () => bulkStatusMutation.mutate({ ids: [...selected], status: 'SUSPENDED' }),
                });
              }}
            >
              <Ban className="w-4 h-4" /> Suspend Selected
            </button>
            <button
              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-50"
              disabled={bulkStatusMutation.isPending || bulkDeleteMutation.isPending}
              onClick={() => {
                confirm({
                  title: 'Delete selected users?',
                  description: `${selected.size} user(s) will be permanently removed. This cannot be undone.`,
                  confirmText: 'Delete All',
                  tone: 'danger',
                  onConfirm: () => bulkDeleteMutation.mutate([...selected]),
                });
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {query.isLoading && (
        <SkeletonTable rows={6} cols={7} label="Loading users…" />
      )}

      {query.isError && (
        <div className="panel p-6 text-sm text-rose-600">
          {query.error?.message || 'Failed to load users.'}
        </div>
      )}

      {!query.isLoading && !query.isError && filtered.length === 0 && (
        <EmptyState
          icon={UsersIcon}
          title={users.length === 0 ? emptyTitle : 'No matching users found'}
          description={users.length === 0
            ? emptyDescription
            : `No users match "${q}"${deptFilter ? ` in ${deptFilter}` : ''}. Try a different search term or clear filters.`}
        />
      )}

      {!query.isLoading && filtered.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-surface-border text-primary-600 focus:ring-primary-500"
                      checked={paginatedFiltered.length > 0 && paginatedFiltered.every((u) => selected.has(u.id))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Staff ID</th>
                  <th className="text-left font-medium px-4 py-3">Department</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Joined</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {(() => {
                  if (role !== 'DEPARTMENT_HEAD') {
                    return paginatedFiltered.map((u) => renderRow(u, false));
                  }
                  // Group: primary heads (no createdById) with their sub-heads nested
                  const primaries = paginatedFiltered.filter((u) => !u.createdById);
                  const subsByParent = {};
                  for (const u of paginatedFiltered) {
                    if (u.createdById) {
                      if (!subsByParent[u.createdById]) subsByParent[u.createdById] = [];
                      subsByParent[u.createdById].push(u);
                    }
                  }
                  const rows = [];
                  for (const primary of primaries) {
                    rows.push(renderRow(primary, false));
                    const subs = subsByParent[primary.id] || [];
                    for (const sub of subs) {
                      rows.push(renderRow(sub, true));
                    }
                  }
                  // Also show subs whose parent isn't in the current filtered set
                  const primaryIds = new Set(primaries.map((p) => p.id));
                  const orphanSubs = paginatedFiltered.filter((u) => u.createdById && !primaryIds.has(u.createdById));
                  for (const sub of orphanSubs) {
                    rows.push(renderRow(sub, true));
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};
