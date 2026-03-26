import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import {
  PlusCircleIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ─── Field descriptor ────────────────────────────────────────────────────────

export interface ConfirmField {
  /** Column / property label shown on the left */
  label: string;
  /** The value that will be persisted (null/undefined/'' → show placeholder) */
  value: string | number | boolean | null | undefined;
  /** Render value in a monospace code badge (IDs, codes, keys) */
  mono?: boolean;
  /** When true, an empty value shows "empty (optional)" instead of "—" */
  optional?: boolean;
  /** Skip this field entirely from the summary */
  hidden?: boolean;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  /** 'add' → emerald accent  ·  'edit' → amber accent */
  mode: 'add' | 'edit';
  /** Human-readable table/entity name shown in the header, e.g. "Agency" */
  tableName: string;
  /** Fields to display in the summary grid */
  fields: ConfirmField[];
  onConfirm: () => void;
  onClose: () => void;
  /** Disables the confirm button and shows a spinner while a request is in-flight */
  loading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function display(value: ConfirmField['value']): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// ─── Component ───────────────────────────────────────────────────────────────

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, mode, tableName, fields, onConfirm, onClose, loading = false,
}) => {
  const isAdd = mode === 'add';

  const theme = isAdd
    ? { icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { icon: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200'       };

  const Icon     = isAdd ? PlusCircleIcon : PencilSquareIcon;
  const title    = isAdd ? `Add New ${tableName}` : `Save Changes to ${tableName}`;
  const subtitle = isAdd
    ? `Review the details below before confirming the new ${tableName.toLowerCase()} record.`
    : `Review the changes below before saving to this ${tableName.toLowerCase()} record.`;

  const visible = fields.filter(f => !f.hidden);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white rounded-lg shadow-xl">

          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 flex-shrink-0 ${theme.icon}`} />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {title}
              </DialogTitle>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* ── Body ─────────────────────────────────────────── */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-500">{subtitle}</p>

            {/* Field summary */}
            {visible.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No fields to preview.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-md border border-gray-200 overflow-hidden text-sm">
                {visible.map((field, i) => {
                  const raw   = display(field.value);
                  const empty = raw === '';
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                      <span className="w-32 flex-shrink-0 text-xs font-medium text-gray-500">
                        {field.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        {empty ? (
                          <span className="text-xs text-gray-300 italic">
                            {field.optional ? 'empty (optional)' : '—'}
                          </span>
                        ) : field.mono ? (
                          <span className={`font-mono text-xs px-2 py-0.5 rounded border ${theme.badge}`}>{raw}</span>
                        ) : (
                          <span className="text-sm text-gray-900 break-words">{raw}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Warning note (edit mode only) */}
            {!isAdd && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>This will overwrite the existing record. You can reverse it by editing again.</span>
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <Button type="button" color="zinc" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              color={isAdd ? 'emerald' : 'amber'}
              onClick={onConfirm}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isAdd ? 'Confirm Add' : 'Save Changes'}
            </Button>
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ConfirmDialog;
