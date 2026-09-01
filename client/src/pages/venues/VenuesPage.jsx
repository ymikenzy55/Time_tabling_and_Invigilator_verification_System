import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Loader2, Plus, Pencil, Trash2, MapPin, Users, AlertCircle, Building, Search, Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ImportPreviewModal } from '@/components/ui/ImportPreviewModal';
import { venuesApi } from '@/features/venues/venuesApi';
import { parseSpreadsheet, rowsToVenues } from '@/utils/fileImport';

const PAGE_SIZE = 10;

const schema = z.object({
  name: z.string().min(1, 'Venue name is required.').max(120),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.'),
  location: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
});

const MIN_VENUES = 3;

export const VenuesPage = () => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState(null);

  const listQuery = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.list(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', capacity: 100, location: '', isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: (values) => (selected
      ? venuesApi.update(selected.id, values)
      : venuesApi.create(values)),
    onMutate: async (values) => {
      await qc.cancelQueries({ queryKey: ['venues'] });
      const prev = qc.getQueryData(['venues']);
      if (selected) {
        qc.setQueryData(['venues'], (old) =>
          Array.isArray(old) ? old.map((v) => v.id === selected.id ? { ...v, ...values } : v) : old
        );
      }
      return { prev };
    },
    onError: (err, _values, ctx) => {
      if (ctx?.prev) qc.setQueryData(['venues'], ctx.prev);
      toast.error(err.message || 'Failed to save venue.');
    },
    onSuccess: (venue) => {
      toast.success(selected ? 'Venue updated.' : 'Venue added.');
      qc.setQueryData(['venues'], (prev) => {
        if (!Array.isArray(prev)) return [venue];
        const without = prev.filter((v) => v.id !== venue.id);
        return [venue, ...without];
      });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => venuesApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['venues'] });
      const prev = qc.getQueryData(['venues']);
      qc.setQueryData(['venues'], (old) =>
        Array.isArray(old) ? old.filter((v) => v.id !== id) : old
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['venues'], ctx.prev);
      toast.error(err.message || 'Failed to delete venue.');
    },
    onSuccess: () => {
      toast.success('Venue deleted.');
      setDeleting(null);
    },
  });

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseSpreadsheet(file);
      const venues = rowsToVenues(rows);
      if (venues.length === 0) {
        toast.error('No valid venue rows found. Ensure columns: name, capacity, location (optional).');
        return;
      }
      setPreviewRows(venues);
    } catch (err) {
      toast.error(err.message || 'Failed to parse file.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const result = await venuesApi.bulkImport(previewRows);
      toast.success(`Imported ${result.created} venue(s)${result.skipped > 0 ? `, skipped ${result.skipped} duplicate(s)` : ''}.`);
      qc.invalidateQueries({ queryKey: ['venues'] });
      setPreviewRows(null);
    } catch (err) {
      toast.error(err.message || 'Failed to import venues.');
    } finally {
      setImporting(false);
    }
  };

  const openCreate = () => {
    setSelected(null);
    reset({ name: '', capacity: 100, location: '', isActive: true });
    setModalOpen(true);
  };

  const openEdit = (venue) => {
    setSelected(venue);
    reset({
      name: venue.name,
      capacity: venue.capacity,
      location: venue.location || '',
      isActive: venue.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    reset();
  };

  const onSubmit = (values) => saveMutation.mutate(values);

  const allVenues = listQuery.data || [];
  const venues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allVenues;
    return allVenues.filter((v) =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.location || '').toLowerCase().includes(q) ||
      String(v.capacity).includes(q)
    );
  }, [allVenues, search]);
  const activeCount = allVenues.filter((v) => v.isActive).length;

  const totalPages = Math.ceil(venues.length / PAGE_SIZE);
  const paginatedVenues = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return venues.slice(start, start + PAGE_SIZE);
  }, [venues, page]);

  return (
    <>
      <PageHeader
        title="Venues"
        description="Manage examination venues and their seating capacities. At least 3 active venues are required before generating a timetable."
        actions={(
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import CSV/Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Add venue
            </button>
          </div>
        )}
      />

      {activeCount < MIN_VENUES && !listQuery.isLoading && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            You have <span className="font-bold">{activeCount}</span> active venue{activeCount === 1 ? '' : 's'}.
            Add at least <span className="font-bold">{MIN_VENUES - activeCount}</span> more before timetable generation is enabled.
          </p>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search venues by name, location, or capacity..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        {listQuery.isLoading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : venues.length === 0 ? (
          <EmptyState
            icon={Building}
            title="No venues yet"
            description="Add examination venues with their seating capacities to enable timetable generation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Venue</th>
                  <th className="text-left font-medium px-4 py-3">Location</th>
                  <th className="text-left font-medium px-4 py-3">Capacity</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {paginatedVenues.map((venue) => (
                  <tr key={venue.id} className="hover:bg-surface-subtle/60">
                    <td className="px-4 py-3 font-medium text-ink-900">{venue.name}</td>
                    <td className="px-4 py-3 text-ink-700">
                      {venue.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-ink-400" /> {venue.location}
                        </span>
                      ) : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-ink-400" /> {venue.capacity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${venue.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-subtle text-ink-500'}`}>
                        {venue.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-md text-ink-500 hover:text-primary-700 hover:bg-primary-50"
                          onClick={() => openEdit(venue)}
                          aria-label={`Edit ${venue.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-ink-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => setDeleting(venue)}
                          aria-label={`Delete ${venue.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={venues.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selected ? 'Edit venue' : 'Add venue'}
        description={selected ? 'Update venue details.' : 'Add an examination venue with its seating capacity.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="label">Venue name</label>
            <input className="input" placeholder="e.g. Main Auditorium" {...register('name')} />
            {errors.name && <p className="field-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Seating capacity</label>
            <input type="number" min="1" className="input" placeholder="e.g. 300" {...register('capacity')} />
            {errors.capacity && <p className="field-error">{errors.capacity.message}</p>}
          </div>
          <div>
            <label className="label">Location <span className="text-ink-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="e.g. Science Block, Ground Floor" {...register('location')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...register('isActive')} />
            Active (available for timetable generation)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {selected ? 'Save changes' : 'Add venue'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete venue"
        description={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
          <button
            type="button"
            className="btn bg-rose-600 text-white hover:bg-rose-700 btn-md"
            onClick={() => deleteMutation.mutate(deleting.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </Modal>

      <ImportPreviewModal
        open={!!previewRows}
        onClose={() => setPreviewRows(null)}
        title="Preview Venue Import"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'capacity', label: 'Capacity' },
          { key: 'location', label: 'Location' },
          { key: 'isActive', label: 'Active' },
        ]}
        rows={previewRows || []}
        onConfirm={confirmImport}
        loading={importing}
      />
    </>
  );
};
