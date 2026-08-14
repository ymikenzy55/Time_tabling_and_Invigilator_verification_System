import { useState } from 'react';
import { Modal } from './Modal';
import { Loader2, Upload, AlertCircle } from 'lucide-react';

/**
 * Reusable import preview modal.
 * Shows parsed rows in a table before the user confirms import.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: string
 *   columns: { key: string, label: string }[]
 *   rows: Record<string, any>[]
 *   onConfirm: () => Promise<void>
 *   loading: boolean
 */
export const ImportPreviewModal = ({ open, onClose, title, columns, rows, onConfirm, loading }) => {
  const maxRows = 50;
  const displayRows = rows.slice(0, maxRows);
  const remaining = rows.length - displayRows.length;

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            No valid rows found. Check your file columns and try again.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Upload className="w-4 h-4" />
              <span>
                <strong>{rows.length}</strong> row{rows.length === 1 ? '' : 's'} ready to import.
                {remaining > 0 && <span className="text-ink-400"> Showing first {maxRows}.</span>}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-surface-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-xs uppercase text-ink-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider">
                  {displayRows.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-subtle/50">
                      <td className="px-3 py-2 text-ink-400 text-xs">{i + 1}</td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-2 text-ink-800">
                          {row[col.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={loading || rows.length === 0}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};
