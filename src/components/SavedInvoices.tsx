import { SavedInvoice, formatMoney } from '@/lib/invoice';
import { FileText, Copy, Trash2, Pencil, Plus, Archive, AlertCircle } from 'lucide-react';

export default function SavedInvoices({
  saved,
  activeId,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
}: {
  saved: SavedInvoice[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <Archive className="h-4 w-4 text-sky-400" />
          Saved Invoices
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      <p className="mb-3 rounded-lg border border-white/5 bg-black/20 p-2.5 text-[11px] leading-relaxed text-white/40">
        Drafts are stored in this browser only. They won't sync across devices and can be lost if browser data is cleared.
      </p>

      {saved.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
          <FileText className="mx-auto mb-2 h-6 w-6 text-white/20" />
          <p className="text-xs text-white/40">No saved invoices yet.</p>
          <p className="mt-1 text-[11px] text-white/30">Click "Save Draft" to store one here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {saved.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-3 transition-colors ${
                s.id === activeId
                  ? 'border-emerald-400/40 bg-emerald-400/5'
                  : 'border-white/5 bg-black/20 hover:border-white/15'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onOpen(s.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-white/90">{s.invoiceNumber || 'Untitled'}</p>
                  <p className="truncate text-xs text-white/40">
                    {s.clientName || 'No client'} · {formatMoney(s.total, s.currency)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/25">
                    {new Date(s.updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                </button>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onOpen(s.id)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Open"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDuplicate(s.id)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141416] p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <AlertCircle className="h-5 w-5 text-amber-400" />
          {title}
        </div>
        <p className="mb-5 text-sm text-white/60">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
