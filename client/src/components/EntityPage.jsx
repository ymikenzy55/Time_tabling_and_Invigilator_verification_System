import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import {
  Plus, Loader2, Search, Pencil, Trash2, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/cn';

export const EntityPage = ({
  title,
  description,
  queryKey,
  api,
  columns,
  FormFields,
  createSchema,
  updateSchema,
  createDefaultValues = {},
  searchPlaceholder = 'Search...',
  emptyTitle = 'No records yet',
  emptyDescription = 'Create a record to get started.',
  createModalTitle = 'Create',
  editModalTitle = 'Edit',
  canEdit = true,
  canDelete = true,
  canCreate = true,
}) => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selected, setSelected] = useState(null);

  const listQuery = useQuery({
    queryKey: [queryKey, { q: search }],
    queryFn: () => api.list({ q: search }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: api.create,
    onSuccess: () => {
      toast.success(`${title} created.`);
      qc.invalidateQueries({ queryKey: [queryKey] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || `Failed to create ${title.toLowerCase()}.`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.update(id, payload),
    onSuccess: () => {
      toast.success(`${title} updated.`);
      qc.invalidateQueries({ queryKey: [queryKey] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || `Failed to update ${title.toLowerCase()}.`),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [queryKey] });
      const previous = qc.getQueriesData({ queryKey: [queryKey] });
      qc.setQueriesData({ queryKey: [queryKey] }, (prev) =>
        Array.isArray(prev) ? prev.filter((item) => item.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      toast.error(err.message || `Failed to delete ${title.toLowerCase()}.`);
    },
    onSuccess: () => {
      toast.success(`${title} deleted.`);
    },
  });

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm({
    resolver: zodResolver(modalMode === 'create' ? createSchema : updateSchema),
    defaultValues: createDefaultValues,
  });

  useEffect(() => {
    if (modalOpen && modalMode === 'edit' && selected) {
      reset(selected);
    } else if (modalOpen && modalMode === 'create') {
      reset(createDefaultValues);
    }
  }, [modalOpen, modalMode, selected, reset, createDefaultValues]);

  const openCreate = () => {
    if (!canCreate) return;
    setModalMode('create');
    setSelected(null);
    reset(createDefaultValues);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setModalMode('edit');
    setSelected(item);
    reset(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    reset(createDefaultValues);
  };

  const onSubmit = (values) => {
    if (modalMode === 'create') {
      createMutation.mutate(values);
    } else {
      updateMutation.mutate({ id: selected.id, payload: values });
    }
  };

  const items = listQuery.data || [];
  const isLoading = listQuery.isLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={canCreate ? (
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add {title}
          </button>
        ) : null}
      />

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-3 bg-surface-subtle">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={cn('text-left font-bold px-4 py-3', col.className)}>
                      {col.label}
                    </th>
                  ))}
                  <th className="text-right font-bold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        <div className="h-4 rounded bg-surface-border animate-pulse" style={{ width: `${60 + ((i * 13) % 30)}%` }} />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-7 w-16 rounded bg-surface-border animate-pulse" />
                        <div className="h-7 w-16 rounded bg-surface-border animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={canCreate ? (
                <button className="btn-primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add {title}
                </button>
              ) : null}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={cn('text-left font-bold px-4 py-3', col.className)}>
                      {col.label}
                    </th>
                  ))}
                  <th className="text-right font-bold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {items.map((item) => {
                  const allowEdit = typeof canEdit === 'function' ? canEdit(item) : canEdit;
                  const allowDelete = typeof canDelete === 'function' ? canDelete(item) : canDelete;

                  return (
                    <tr key={item.id} className="hover:bg-surface-subtle">
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3', col.className)}>
                          {col.render ? col.render(item[col.key], item) : item[col.key]}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {allowEdit && (
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => openEdit(item)}
                              disabled={isSubmitting}
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                          )}
                          {allowDelete && (
                            <button
                              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                              onClick={() => {
                                confirm({
                                  title: `Delete this ${title.toLowerCase()}?`,
                                  description: 'This action cannot be undone.',
                                  confirmText: 'Delete',
                                  tone: 'danger',
                                  onConfirm: () => removeMutation.mutate(item.id),
                                });
                              }}
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? createModalTitle : editModalTitle}
        description={modalMode === 'create' ? `Add a new ${title.toLowerCase()}.` : `Update ${title.toLowerCase()} details.`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormFields register={register} errors={errors} isEdit={modalMode === 'edit'} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {modalMode === 'create' ? `Create ${title}` : `Save changes`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
